# verification-analysis

- name: verification-analysis
- description: 验证与影响分析
- stage: VR
- scope:
  - 契约一致性检查
  - 变更影响分析
- inputs:
  - contracts/*
- outputs:
  - 04-价值回归/value-achievement.md
  - 04-价值回归/user-acceptance.md
  - contracts/value-achievement.md
  - contracts/user-acceptance.md
- implementation:
  - lib/skills/verification-analysis.js
