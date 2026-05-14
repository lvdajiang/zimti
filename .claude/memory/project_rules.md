---
name: project-rules
description: 开发体系核心规则：改已有页面/新增页面/注意事项/文档路径索引
metadata: 
  node_type: memory
  type: project
  originSessionId: 2ccade32-d359-46e2-8919-72ae80ae6593
---

# 开发体系规则

## 改已有页面的规则
1. **改前查规范**: 编辑代码前先查阅设计文档和技能卡，禁止凭经验直接改
   - UI/样式 → 设计稿 + /check-page
   - 数据模型 → 数据流文档
   - TDD范围 → /plan-first
   - 需求对齐 → /align
2. **改后验证再提交**: 前端→浏览器确认，后端→API确认，通用→检查同类组件
3. **修 bug 用 /xgbug**: 修一类非一个，步骤3必须扫描同类问题
4. **每次改动引用 schema**: 新字段/枚举/API端点/路由必须先更新 shared-schema.ts
5. **提交前自动检查**: `npx tsx scripts/schema-check.ts --staged`

## 新增页面的规则
1. 必须走完整链路: /refine → /design-spec → /design-detail → /design-page → /data-flow → /tech-spec → /align → /plan-first → 编码 → /check-page → /deploy-check → /bushu
2. 或使用一键流水线: /wf-full [页面名]
3. Schema 增量维护: 每个阶段完成后扩展 shared-schema.ts 对应段落
4. 每阶段产出后必须审查 → 修复 → 再进入下一阶段

## 安全底线（强制）
- 禁止拼接 SQL 字符串，必须参数化查询
- 所有外键字段必须建立索引
- 编号/ID 必须唯一且不可修改
- 所有公共函数必须添加类型注解
- 错误必须使用自定义异常类处理

## 关键注意事项
- API 常量不含 /api/v1 前缀（baseURL 已包含）
- Remotion 只在后端运行，前端不引入 React
- 虚拟滚动：表格 >100 条必须虚拟滚动
- 单次 API <= 100 条数据
- 桩端点必须有 markStub 标记
- 每个 toast.success 前必须有实际 API 调用
- 中文搜索统一方案：filterOption=false + @search + 拼音

## 文档路径索引
| 类型 | 路径 |
|------|------|
| 需求文档 | 开发文档/01-需求/ |
| 设计规格 | 开发文档/02-设计/ |
| 页面描述 | 开发文档/02-设计/ (*-页面描述.md) |
| 视觉设计 | 开发文档/03-视觉/ |
| 数据流 | 开发文档/04-数据流/ |
| 技术规格 | 开发文档/05-技术规格/ |
| **共享定义(唯一真相源)** | 开发文档/06-架构/shared-schema.ts |
| 外部集成架构 | 开发文档/06-架构/外部工具集成架构.md |
| 素材资源清单 | 开发文档/06-架构/素材来源资源清单.md |
| 项目配置 | 开发文档/00-项目/ |
| 技能卡 | .claude/skills/ |
| Schema 检查脚本 | scripts/schema-check.ts |
