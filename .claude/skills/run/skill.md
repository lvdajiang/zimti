---
name: run
description: 启动服务 - 后端+前端+小程序（/run admin|client|mini|all）
origin: project
---

# 启动服务 `/run`

> **使用场景**：需要启动开发环境时。
> **目标**：一条命令搞定，不用记住每个端口和启动命令。

## 用法

```
/run                          # 启动后端 + 着陆页
/run admin                    # 启动后端 + 主控后台
/run client                   # 启动后端 + 客户端
/run agency                   # 启动后端 + 旅行社端
/run mini                     # 启动后端 + 着陆页（打开4个小程序页面）
/run all                      # 启动所有前端 + 后端 + 打开所有页面
/run backend                  # 仅启动后端
/run stop                     # 停止所有服务
```

## 端口映射（固定，禁止修改）

| 服务 | 端口 | 启动命令 |
|------|------|---------|
| 后端 API | 8000 | `cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload` |
| 着陆页 | 3000 | `cd frontend && npm run dev:landing` |
| 旅行社端 | 3001 | `cd frontend && npm run dev:agency` |
| 客户端 | 3002 | `cd frontend && npm run dev:client` |
| 主控后台 | 3003 | `cd frontend && npm run dev:admin` |

## 小程序页面（通过着陆页端口访问）

| 小程序 | 地址 |
|--------|------|
| 司机端 | http://localhost:3000/miniprogram/driver/orders |
| 旅行社端 | http://localhost:3000/miniprogram/agency/ocr |
| 游客端 | http://localhost:3000/miniprogram/tourist/home |
| 服务端 | http://localhost:3000/miniprogram/service/home |
| 车队管理 | http://localhost:3000/miniprogram/fleet/tasks |

## 执行步骤

### 1. 检查端口占用

```bash
netstat -ano | grep -E ":(8000|3000|3001|3002|3003) " || echo "所有端口空闲"
```

如果端口被占用：
- 提示用户哪个端口被占用
- 询问是终止旧进程还是跳过

### 2. 启动后端（如果需要）

```bash
cd d:/project-lvyou/backend && source ../.venv/Scripts/activate && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- 后端使用 `run_in_background` 参数后台运行
- 启动后等待8秒，检查是否成功：`curl -s http://localhost:8000/docs | head -c 100`
- 如果失败，检查日志并报告错误

### 3. 启动前端（根据参数）

每个前端服务也使用 `run_in_background` 后台运行。

### 4. 打开浏览器页面

**`/run mini` 模式**：启动着陆页(3000)后，自动打开4个小程序标签页：
```bash
start http://localhost:3000/miniprogram/driver/orders
start http://localhost:3000/miniprogram/agency/ocr
start http://localhost:3000/miniprogram/tourist/home
start http://localhost:3000/miniprogram/service/home
```

**`/run all` 模式**：启动所有前端后，打开所有页面（PC端+小程序端）。

**PC端模式**（默认/admin/client/agency）：只打开对应PC端页面。

### 5. 启动完成汇报

启动完成后列出所有可用链接，格式如下：

```
服务已启动

PC端：
  着陆页:    http://localhost:3000
  旅行社端:  http://localhost:3001
  客户端:    http://localhost:3002
  主控后台:  http://localhost:3003

小程序（在浏览器打开）：
  司机端:    http://localhost:3000/miniprogram/driver/orders
  旅行社端:  http://localhost:3000/miniprogram/agency/ocr
  游客端:    http://localhost:3000/miniprogram/tourist/home
  服务端:    http://localhost:3000/miniprogram/service/home
  车队管理:  http://localhost:3000/miniprogram/fleet/tasks

后端：
  API文档:   http://localhost:8000/docs
```

## `/run stop`

```bash
# 查找并终止所有相关进程
taskkill //F //IM python.exe 2>/dev/null
taskkill //F //IM node.exe 2>/dev/null
# 或者更精确地按端口杀进程
for port in 8000 3000 3001 3002 3003; do
  pid=$(netstat -ano | grep ":$port " | awk '{print $5}' | head -1)
  if [ -n "$pid" ]; then taskkill //F //PID $pid 2>/dev/null; fi
done
```

## 注意事项

- 后端依赖 `.env.local` 中的数据库配置，如果启动失败先检查配置
- 前端依赖 `node_modules`，如果启动失败先执行 `npm install`
- 小程序页面通过着陆页端口(3000)访问，不需要额外端口
- 车队管理页面需要登录车队经理账号后才能访问
