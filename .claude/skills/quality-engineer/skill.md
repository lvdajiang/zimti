# quality-engineer

- name: quality-engineer
- description: 质量门禁与验证分析
- stage: IV
- inputs:
  - contracts/architecture.md
  - contracts/api-specification.md
  - contracts/design-spec.md
- outputs:
  - 03-实现验证/quality-reports/
- implementation:
  - agents/quality-engineer.js
- contracts:
  - contracts/quality-report.md
- quality-gate:
  - gate: implementation
