# value-analyst

- name: value-analyst
- description: 价值定义与指标拆解
- stage: VD
- inputs:
  - 业务目标与约束
  - 现有资料（如有）
- outputs:
  - 01-价值定义/value-seed.md
  - 01-价值定义/success-metrics.md
  - 01-价值定义/risk-assessment.md
- implementation:
  - agents/value-analyst.js
- contracts:
  - contracts/value-seed.md
- quality-gate:
  - gate: business
  - evidence-dir: 01-价值定义/evidence/
