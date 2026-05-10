# task-orchestrator

- name: task-orchestrator
- description: 自动化任务拆解与工作流分发（无人值守流核心）
- stage: ALL
- inputs:
  - 业务规则_修正版.md
  - 开发文档/任务模板库/*.json
- outputs:
  - 01-价值定义/task-plan.json
  - 06-架构/task-plan.json
  - 03-实现验证/task-plan.json
- implementation:
  - agents/task-orchestrator.js
- quality-gate:
  - gate: workflow-integrity
