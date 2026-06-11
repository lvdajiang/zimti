/**
 * UserPromptSubmit Hook: 在 DeepSeek 等非 Anthropic 模型下强制技能调用
 *
 * 原理：当用户输入 /skill-name 时，DeepSeek 可能不遵循系统指令去调用 Skill 工具。
 * 此 Hook 在消息送达模型前检测斜杠命令，并在消息开头注入强制调用指令。
 */

const SKILL_MAP = {
  // 行为规则类
  refine: "需求细化",
  "init-schema": "初始化共享定义",
  "design-spec": "设计规格",
  "design-detail": "页面描述",
  "design-page": "视觉设计",
  "data-flow": "数据流设计",
  "tech-spec": "技术规格",
  align: "对齐理解",
  "plan-first": "施工图+自动施工",
  plan: "工作计划",
  brainstorming: "头脑风暴",

  // 分析审查类
  "project-review": "项目配置审查",
  "req-review": "需求审查",
  "spec-review": "设计规格审查",
  "design-review": "页面描述审查",
  "dataflow-review": "数据流审查",
  "techspec-review": "技术规格审查",
  "code-review": "代码审查",
  "check-page": "页面检查",
  "component-check": "组件检查",
  "perf-check": "性能检查",
  "deploy-check": "部署检查",
  regression: "回归检查",
  status: "项目进度",

  // 修复执行类
  xgbug: "系统化修bug",
  "code-fix": "代码修复",

  // 工具类
  "git-clean": "Git清理",
  db: "数据库查询",
  "save-ctx": "保存上下文",
  "load-ctx": "恢复上下文",

  // 工作流类
  wf: "一条龙工作流",
  "wf-bug": "修bug流程",
  "wf-dev": "开发页面流程",
  "wf-review": "审查修复部署",
  "wf-new": "新功能开发流程",
  "wf-full": "全自动流水线",
  "wf-deploy": "部署流程",
  "wf-day-start": "一天开始流程",
  "wf-algo": "算法修改流程",
  "wf-batch": "批量挂机",
  bushu: "一键部署",

  // 部署/运行
  run: "启动服务",
  adopt: "项目接驳",
  retro: "根因分析",
  "scan-algo": "算法审查",
  "sync-page": "H5→小程序对齐",

  // 其他
  "import-excel": "Excel导入",
  "import-docx": "Word导入",
  "help-gen": "帮助文档生成",
  "init-project": "项目初始化",
  "model-pick": "模型选择",
  "skill-stocktake": "技能盘点",
  "security-scan": "安全扫描",
  verify: "验证改动",
  simplify: "简化代码",
};

function detectSkill(prompt) {
  // 匹配 /skill-name 或 /skill-name args
  const match = prompt.match(/^\/([a-z][a-z0-9-]*)\b\s*(.*)/i);
  if (!match) return null;

  const skillName = match[1].toLowerCase();
  const args = match[2]?.trim() || "";

  // 尝试精确匹配或模糊匹配
  const exactMatch = SKILL_MAP[skillName];
  if (exactMatch) return { skill: skillName, args, description: exactMatch };

  // 模糊匹配（如 /codereview -> code-review）
  const fuzzyKey = Object.keys(SKILL_MAP).find(
    (k) => k.replace(/-/g, "") === skillName
  );
  if (fuzzyKey) return { skill: fuzzyKey, args, description: SKILL_MAP[fuzzyKey] };

  return null;
}

try {
  // 读取 stdin
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });

  process.stdin.on("end", () => {
    try {
      const data = JSON.parse(input);
      const originalPrompt = data.prompt || "";

      const detected = detectSkill(originalPrompt.trim());

      if (detected) {
        const overrideInstruction = [
          "══════════════════════════════════════════════",
          `⚠️ 技能调用指令 (${detected.description})`,
          `用户输入了斜杠命令: /${detected.skill}${detected.args ? " " + detected.args : ""}`,
          "",
          "你必须立即调用 Skill 工具:",
          `  skill: "${detected.skill}"`,
          detected.args ? `  args: "${detected.args}"` : "",
          "",
          "不要在调用 Skill 工具前回复任何文字。",
          "══════════════════════════════════════════════",
          "",
          originalPrompt,
        ]
          .filter(Boolean)
          .join("\n");

        data.prompt = overrideInstruction;
      }

      // Hook 只应输出 {prompt}，不传 cwd 等额外字段
      process.stdout.write(JSON.stringify({ prompt: data.prompt }));
    } catch (e) {
      process.stdout.write(JSON.stringify({ prompt: input.trim() || (data && data.prompt) || "" }));
    }
  });
} catch (e) {
  process.stdout.write(JSON.stringify({ prompt: "" }));
}
