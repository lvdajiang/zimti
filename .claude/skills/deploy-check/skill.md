---
name: deploy-check
description: 部署检查 - 硬编码+影响分析+冒烟测试+构建验证
origin: project
---

# 部署前检查 `/deploy-check`

> **使用场景**：在执行部署（bushu）之前调用。
> **目标**：确保部署不会引入新问题，防止"修A坏B"。

## 执行方式（Subagent 模式）

本技能通过 Subagent 执行分析，不占用主对话上下文。

**必须使用 Agent tool** 启动分析代理，传入以下参数：
- subagent_type: "general-purpose"
- prompt: 包含下方检查清单 + 项目路径

代理在独立上下文中读取配置和代码、逐项检查，**只返回检查结果摘要给主对话**。禁止在主窗口中读取和分析代码。

当用户调用 `/deploy-check` 时，按以下清单逐项检查。**全部通过后才允许部署**。

---

## 检查清单

### 第1项：硬编码扫描（5秒）

搜索前端代码中不应出现的硬编码值：

```bash
# 禁止：API文件中出现 localhost
grep -rn "localhost" frontend/src/api/ --include="*.ts"

# 禁止：API文件中出现 8000/8888 端口
grep -rn ":[0-9]\{4,5\}/api" frontend/src/api/ --include="*.ts"

# 警告：console.log 残留
grep -rn "console.log" frontend/src/ --include="*.vue" --include="*.ts" | grep -v "node_modules"
```

**通过条件**：
- `grep "localhost" frontend/src/api/` 无结果
- `grep ":[0-9]\{4,5\}/api" frontend/src/api/` 无结果
- console.log 残留 ≤ 3条（仅开发调试用）

**失败处理**：修复所有硬编码后再部署。

---

### 第6项：桩端点扫描（10秒）

搜索未标记的桩端点：

```bash
# 检查返回硬编码 pending 但没有 markStub 标记的路由
grep -rn "status: 'pending'" packages/server/src/routes/ --include="*.ts" | grep -v "markStub"
# 检查 TODO 中含"接入"的桩代码
grep -rn "TODO: 接入" packages/server/src/routes/ --include="*.ts" | grep -v "markStub"
```

**通过条件**：
- 所有返回 `{ status: 'pending' }` 的端点有 `markStub()` 调用
- TODO 注释中含"接入"的端点有桩标记

**失败处理**：标记为桩或实现真实逻辑后再部署。

---

### 第2项：本次改动影响分析（30秒）

```bash
# 查看未提交的改动
git diff --name-only

# 查看已暂存但未提交的改动
git diff --cached --name-only
```

根据改动文件，判断影响范围：

| 改动类型 | 需要额外检查 |
|---------|------------|
| `config.py` / `main.py` | CORS、数据库连接、环境变量 |
| `vite.config.ts` | 代理配置、端口 |
| `request.ts` / axios 配置 | 所有API调用 |
| admin下某个Table组件 | 其他5个admin Table组件是否有相同模式 |
| 某个service.py | 调用该service的所有API端点 |
| 某个API endpoint | 前端对应调用方 |
| model/schema | 所有依赖该字段的service和API |

**输出**：
```
📋 影响分析
本次改动文件：
- [文件1] → 影响：[影响的范围]
- [文件2] → 影响：[影响的范围]

需要额外验证：[列出具体页面/功能]
```

---

### 第3项：排序黄金法则验证（10秒）

```bash
# 检查所有API排序是否使用 task_start_time 升序
grep -rn "order_by\|sorted\|\.sort" backend/app/services/ --include="*.py"
```

**通过条件**：
- 所有调度管道服务（deduplication、splitting、combination、connection、dispatch）的输出排序使用 `datetime` 对象（非字符串lambda）
- 所有API端点使用 `task_start_time ASC`

**警告**：发现使用 `lambda t: t.get('task_start_time', '')` 字符串排序的，标记为需要优化。

---

### 第4项：核心流程冒烟测试（60秒）

如果后端服务正在运行，执行以下API调用验证核心流程：

```bash
# 1. 认证
curl -s http://localhost:8000/api/v1/auth/login | head -c 200

# 2. 原始订单（检查排序）
curl -s http://localhost:8000/api/v1/orders/?skip=0\&limit=3 -H "Authorization: Bearer $TOKEN" | head -c 500

# 3. 任务列表（检查排序和格式）
curl -s http://localhost:8000/api/v1/tasks/?skip=0\&limit=3 -H "Authorization: Bearer $TOKEN" | head -c 500
```

**通过条件**：
- API返回200状态码
- 返回数据按 `task_start_time` 升序
- 日期格式统一为 `YYYY-MM-DD HH:MM:SS`

---

### 第5项：前端构建验证（30秒）

```bash
cd frontend && npm run build 2>&1 | tail -20
```

**通过条件**：
- 构建成功，无 TypeScript 错误
- 无 Vue 编译警告（允许不超过5个 deprecation 警告）

---

## 输出汇总

```
🚀 部署前检查报告

[✅/❌] 1. 硬编码扫描
[✅/❌] 2. 影响分析
[✅/❌] 3. 排序黄金法则
[✅/❌] 4. 核心流程冒烟
[✅/❌] 5. 前端构建
[✅/❌] 6. 桩端点扫描

结论：[全部通过，可以部署 / 存在N项问题，需要修复后再部署]
问题清单：
  1. [具体问题和修复建议]
```

---

## 与 `/xgbug` 的关系

- `/xgbug` 负责修bug的过程质量
- `/deploy-check` 负责部署前的最终把关
- 两者独立使用，但组合使用效果最佳：`/xgbug` 修完bug后，`/deploy-check` 部署前再检查一遍
