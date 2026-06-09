/**
 * 系统预设提示词 — 从 12 个生成器中提取的 16 个提示词模板
 * 变量占位符使用 {{var}} 语法，由 renderer.ts 渲染
 */

import type { VariableDef } from './renderer.js'

export interface SeedPrompt {
  label: string
  description: string
  systemPrompt: string | null
  userPromptTemplate: string
  variableDefs: VariableDef[]
}

export const SEED_PROMPTS: Record<string, SeedPrompt> = {

  // ═══════════════════════════════════════════════════════════
  // 提取自 topicGenerate.ts
  // ═══════════════════════════════════════════════════════════
  topic_generate: {
    label: '选题生成',
    description: '根据任务标题和描述，生成短视频选题列表',
    systemPrompt: null,
    userPromptTemplate: `根据任务"{{task_title}}"（描述：{{task_description}}），生成 {{count}} 个短视频选题。{{brand_section}}
每个选题包含：title（标题）、contentSkeleton（内容骨架，100字左右）、targetAudience（目标受众）、estimatedHotValue（预估热度 1-100）。
返回 JSON 数组。`,
    variableDefs: [
      { name: 'task_title', type: 'string', required: true, description: '任务标题' },
      { name: 'task_description', type: 'string', required: false, description: '任务描述' },
      { name: 'count', type: 'number', required: false, description: '生成数量，默认5' },
      { name: 'brand_section', type: 'string', required: false, description: '品牌画像段落' },
    ],
  },

  topic_merge: {
    label: '选题合并',
    description: '将多个选题合并为一个更优选题',
    systemPrompt: null,
    userPromptTemplate: `合并以下选题为一个更优选题：{{titles}}。返回合并后的 title 和 contentSkeleton。`,
    variableDefs: [
      { name: 'titles', type: 'string', required: true, description: '待合并的选题标题列表' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 提取自 enhancedTopicGenerate.ts
  // ═══════════════════════════════════════════════════════════
  enhanced_topic_generate: {
    label: '增强版选题生成',
    description: '结合多源数据（GEO/群聊/CRM/热点）生成选题',
    systemPrompt: null,
    userPromptTemplate: `根据任务"{{task_title}}"（描述：{{task_description}}），生成 {{count}} 个短视频选题。{{context_block}}
每个选题包含：title（标题）、contentSkeleton（内容骨架，100字左右）、targetAudience（目标受众）、estimatedHotValue（预估热度 1-100）、sourceHint（选题来源提示，如"GEO搜索意图"或"客户痛点"）。
返回 JSON 数组。`,
    variableDefs: [
      { name: 'task_title', type: 'string', required: true, description: '任务标题' },
      { name: 'task_description', type: 'string', required: false, description: '任务描述' },
      { name: 'count', type: 'number', required: false, description: '生成数量' },
      { name: 'context_block', type: 'string', required: false, description: '多源上下文段落（品牌/GEO/群聊/CRM/热点）' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 提取自 storyboardGenerate.ts
  // ═══════════════════════════════════════════════════════════
  storyboard_generate: {
    label: '分镜生成',
    description: '根据脚本内容生成短视频分镜列表',
    systemPrompt: null,
    userPromptTemplate: `根据以下脚本生成短视频分镜。视频类型：{{video_type}}。{{brand_section}}

脚本全文：
{{script_full_text}}

要求：将脚本拆分为 5-10 个分镜片段，每个片段包含：
- segmentType: "oral"（口播段）、"visual"（画面段）或 "transition"（转场段）
- oralText: 口播文案（仅 oral 类型）
- visualDescription: 画面描述
- duration: 时长（秒，口播段 3-8秒，画面段 2-5秒，转场 0.5-1秒）
- transitionType: 转场类型（淡入、滑动、缩放等）

返回 JSON 数组。`,
    variableDefs: [
      { name: 'video_type', type: 'string', required: false, description: '视频类型，默认"通用"' },
      { name: 'brand_section', type: 'string', required: false, description: '品牌调性段落' },
      { name: 'script_full_text', type: 'string', required: true, description: '脚本全文' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 提取自 aiCheck.ts
  // ═══════════════════════════════════════════════════════════
  ai_check: {
    label: 'AI风味检测',
    description: '分析脚本的AI生成痕迹程度',
    systemPrompt: null,
    userPromptTemplate: `分析以下短视频脚本的"AI 风味"程度，检查是否有明显的 AI 生成痕迹。{{brand_section}}

脚本全文：
{{script_full_text}}

要求：返回 JSON 对象，包含：
- score: 总分 0-100（100 = 完全像人类写的）
- issues: 问题数组，每个问题包含 type（warning/error/info）、message、position（字符位置）
- suggestions: 改进建议数组，每个包含 suggestion（具体建议文本）、position（应用位置）`,
    variableDefs: [
      { name: 'brand_section', type: 'string', required: false, description: '品牌调性段落' },
      { name: 'script_full_text', type: 'string', required: true, description: '脚本全文' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 提取自 copyGenerate.ts（3个函数）
  // ═══════════════════════════════════════════════════════════
  copy_generate: {
    label: '发布文案生成',
    description: '为短视频生成平台发布文案',
    systemPrompt: null,
    userPromptTemplate: `为以下短视频生成{{platform}}平台的发布文案。{{brand_section}}

视频信息：
- 标题：{{video_title}}
- 描述：{{video_description}}
- 现有标签：{{video_tags}}

返回 JSON 对象：{ title, description, tags: string[] }`,
    variableDefs: [
      { name: 'platform', type: 'string', required: false, description: '目标平台，默认"通用"' },
      { name: 'brand_section', type: 'string', required: false, description: '品牌调性段落' },
      { name: 'video_title', type: 'string', required: false, description: '视频标题' },
      { name: 'video_description', type: 'string', required: false, description: '视频描述' },
      { name: 'video_tags', type: 'string', required: false, description: '现有标签（已join）' },
    ],
  },

  dashboard_analysis: {
    label: '仪表盘分析',
    description: '分析创作者数据趋势并给出优化建议',
    systemPrompt: null,
    userPromptTemplate: `分析短视频创作者近期数据趋势，给出内容优化建议。返回 JSON 对象包含 insights 和 recommendations 数组。`,
    variableDefs: [],
  },

  persona_preview: {
    label: '人设预览',
    description: '以人设风格生成短视频开头文案',
    systemPrompt: null,
    userPromptTemplate: `以"{{display_name}}"的人设风格生成一段短视频开头文案。
语言风格：{{language_styles}}
口头禅：{{catchphrases}}
叙事视角：{{narrative_viewpoint}}`,
    variableDefs: [
      { name: 'display_name', type: 'string', required: false, description: '人设显示名' },
      { name: 'language_styles', type: 'string', required: false, description: '语言风格（已join）' },
      { name: 'catchphrases', type: 'string', required: false, description: '口头禅（已join）' },
      { name: 'narrative_viewpoint', type: 'string', required: false, description: '叙事视角描述' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 提取自 videoAnalyze.ts
  // ═══════════════════════════════════════════════════════════
  viral_analyze: {
    label: '爆款视频分析',
    description: '分析爆款短视频的成功要素',
    systemPrompt: null,
    userPromptTemplate: `分析以下爆款短视频的成功要素。

视频信息：
- 标题：{{video_title}}
- 平台：{{video_platform}}
- 时长：{{video_duration}}秒
- 播放：{{play_count}}、点赞：{{like_count}}、评论：{{comment_count}}、收藏：{{collect_count}}、转发：{{share_count}}
- 互动率：{{interaction_rate}}
- 文案/字幕：{{transcript}}

请从以下维度分析并返回 JSON 对象：
{
  "strengths": ["强项1", "强项2"],
  "weaknesses": ["可改进点1"],
  "content_hooks": ["开头钩子技巧"],
  "structure_analysis": {
    "opening": "开头分析",
    "body": "主体分析",
    "ending": "结尾分析"
  },
  "recommendations": ["优化建议1", "优化建议2"],
  "overall_score": 85
}

注意：overall_score 为 0-100 的整数评分。`,
    variableDefs: [
      { name: 'video_title', type: 'string', required: true, description: '视频标题' },
      { name: 'video_platform', type: 'string', required: true, description: '平台' },
      { name: 'video_duration', type: 'string', required: false, description: '时长（秒）' },
      { name: 'play_count', type: 'string', required: false, description: '播放量' },
      { name: 'like_count', type: 'string', required: false, description: '点赞量' },
      { name: 'comment_count', type: 'string', required: false, description: '评论量' },
      { name: 'collect_count', type: 'string', required: false, description: '收藏量' },
      { name: 'share_count', type: 'string', required: false, description: '转发量' },
      { name: 'interaction_rate', type: 'string', required: false, description: '互动率' },
      { name: 'transcript', type: 'string', required: false, description: '文案/字幕' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 提取自 contentAdapt.ts
  // ═══════════════════════════════════════════════════════════
  content_adapt: {
    label: '内容平台适配',
    description: '将内容适配到不同平台',
    systemPrompt: null,
    userPromptTemplate: `你是一位资深自媒体运营专家，擅长将一条内容适配到不同平台。

## 源内容
- 标题：{{source_title}}
- 正文：{{source_content}}
- 标签：{{source_tags}}

## 目标平台：{{target_platform_name}}
- 最大字数：{{max_length}}
- 标签上限：{{tag_limit}}
- 标签前缀：{{tag_prefix}}
- 内容格式：{{content_format}}
- 语气风格：{{tone_guidance}}
{{brand_context_line}}

## 要求
1. 标题要有吸引力，适合{{target_platform_name}}的推荐算法
2. 正文严格不超过{{max_length}}字，风格符合{{target_platform_name}}
3. 生成不超过{{tag_limit}}个标签，使用"{{tag_prefix}}"格式
4. 保留核心信息，但用目标平台最合适的表达方式重写

返回 JSON 对象：{ "adapted_title": string, "adapted_content": string, "adapted_tags": string[] }`,
    variableDefs: [
      { name: 'source_title', type: 'string', required: true, description: '源标题' },
      { name: 'source_content', type: 'string', required: true, description: '源正文' },
      { name: 'source_tags', type: 'string', required: false, description: '源标签（已join）' },
      { name: 'target_platform_name', type: 'string', required: true, description: '目标平台名' },
      { name: 'max_length', type: 'string', required: true, description: '最大字数' },
      { name: 'tag_limit', type: 'string', required: true, description: '标签上限' },
      { name: 'tag_prefix', type: 'string', required: false, description: '标签前缀' },
      { name: 'content_format', type: 'string', required: false, description: '内容格式' },
      { name: 'tone_guidance', type: 'string', required: false, description: '语气风格' },
      { name: 'brand_context_line', type: 'string', required: false, description: '品牌人设行' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 提取自 geoQuestionGenerate.ts
  // ═══════════════════════════════════════════════════════════
  geo_question_generate: {
    label: 'GEO问题生成',
    description: '生成用户在AI搜索引擎中可能提问的问题',
    systemPrompt: null,
    userPromptTemplate: `你是一位 SEO 和 AI 搜索优化专家。请生成 {{count}} 个关于"{{domain}}"的问题。

这些问题是用户在 AI 搜索引擎（如豆包、DeepSeek、Kimi、ChatGPT）中可能提问的真实问题。
{{category_desc}}

## 要求
1. 问题必须是用户真实会搜的，口语化、具体、有场景感
2. 避免过于宽泛的问题（如"新疆怎么样"），要精准（如"6月去伊犁看薰衣草住哪里最方便"）
3. 每个问题标注类别和意图类型
4. 类别范围：route/food/season/budget/tips/general
5. 意图类型：informational（了解信息）、navigational（找具体地方）、transactional（要消费）、commercial（比较选择）

返回 JSON 数组：
[{ "question": "...", "category": "route", "intent_type": "informational" }]`,
    variableDefs: [
      { name: 'count', type: 'number', required: true, description: '生成数量' },
      { name: 'domain', type: 'string', required: true, description: '领域/主题' },
      { name: 'category_desc', type: 'string', required: false, description: '类别描述段落' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 提取自 geoContentGenerate.ts
  // ═══════════════════════════════════════════════════════════
  geo_content_generate: {
    label: 'GEO内容生成',
    description: '为AI搜索引擎撰写高质量可引用内容',
    systemPrompt: null,
    userPromptTemplate: `你是一位旅行领域的内容专家，擅长撰写被 AI 搜索引擎引用的高质量内容。

## 任务
为以下问题撰写一篇详细的回答，目标是让豆包、DeepSeek、Kimi 等 AI 搜索引擎优先引用你的内容。

## 问题
"{{question_text}}"（分类：{{category}}）
{{brand_context_line}}
领域：{{domain}}

## EEAT 标准（必须严格遵循）
- **Experience（经验）**：用第一人称经验语调，提及具体场景和个人感受，避免"据说""有人说"
- **Expertise（专业性）**：提供具体数据、事实、对比，如价格范围、距离、时间、推荐指数
- **Authoritativeness（权威性）**：使用确定性语言，适当引用标准或官方信息
- **Trustworthiness（可信度）**：客观评价，包含优缺点，不夸大不隐瞒

## 要求
1. 标题：简洁有力，包含核心关键词，15-30字
2. 正文：500-1500字，结构清晰（分段+小标题），信息密度高
3. 关键词：提取3-8个核心关键词
4. 自评 EEAT 分数（0-100）
5. 生成 FAQ Schema 标记（JSON-LD 格式）

返回 JSON 对象：
{
  "title": "标题",
  "content": "正文内容（支持换行）",
  "keywords": ["关键词1", "关键词2"],
  "eeat_score": 85,
  "schema_markup": {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [{
      "@type": "Question",
      "name": "问题",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "答案"
      }
    }]
  }
}`,
    variableDefs: [
      { name: 'question_text', type: 'string', required: true, description: '问题文本' },
      { name: 'category', type: 'string', required: true, description: '问题分类' },
      { name: 'domain', type: 'string', required: true, description: '领域' },
      { name: 'brand_context_line', type: 'string', required: false, description: '品牌背景行' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 提取自 brandKnowledgeGenerate.ts
  // ═══════════════════════════════════════════════════════════
  brand_knowledge_generate: {
    label: '品牌知识生成',
    description: '为旅行品牌生成结构化品牌知识条目',
    systemPrompt: null,
    userPromptTemplate: `你是一位旅行行业品牌顾问。请为"{{domain}}"领域的旅行品牌生成 {{count}} 条结构化品牌知识。

## 知识类别说明
- brand_intro：品牌/旅行社介绍、品牌故事、核心优势、团队实力
- route：独家路线、特色体验、行程亮点、小众玩法
- service：退款政策、安全保障、服务标准、售后保障
- case：客户真实评价、旅行故事、效果展示、客户见证
- faq：用户最关心的问题及标准回答（问答格式，可直接用于 GEO 内容）
- industry：目的地攻略、旅行常识、行业洞察、趋势分析

{{category_desc}}{{avoid_titles}}

## 要求
1. 标题：15-30字，简洁有力，有吸引力
2. 正文：200-500字，结构清晰，信息密度高，包含具体数据和细节
3. 标签：3-5个核心标签
4. 内容要有差异化，避免泛泛而谈，要体现专业度和独特性
5. 如果是 faq 类别，正文格式为"问：xxx\\n答：xxx"
6. 类别必须从以下选择：brand_intro/route/service/case/faq/industry

返回 JSON 数组：
[{ "title": "标题", "content": "正文内容", "category": "brand_intro", "tags": ["标签1", "标签2"] }]`,
    variableDefs: [
      { name: 'domain', type: 'string', required: true, description: '领域' },
      { name: 'count', type: 'number', required: true, description: '生成数量' },
      { name: 'category_desc', type: 'string', required: false, description: '类别描述段落' },
      { name: 'avoid_titles', type: 'string', required: false, description: '避免的标题列表段落' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 提取自 keywordDistillGenerate.ts
  // ═══════════════════════════════════════════════════════════
  keyword_distill: {
    label: '关键词蒸馏',
    description: '对关键词进行价值评估和蒸馏排序',
    systemPrompt: null,
    userPromptTemplate: `你是一位 SEO 和 AI 搜索优化专家。请对以下关键词进行价值评估和蒸馏。

## 领域
{{domain}}
{{brand_section}}

## 待评估关键词（共 {{batch_count}} 个）
{{keyword_list}}

## 评估维度
对每个关键词评估：
1. 搜索意图（informational=了解信息 / navigational=找具体地方 / transactional=要消费 / commercial=比较选择）
2. 竞争度（low=低 / medium=中 / high=高）：该词在 AI 搜索结果中的竞争激烈程度
3. 品牌相关性（0-100）：与我们品牌业务的相关程度
4. 内容机会（0-100）：我们创建优质内容的难易程度和潜在效果
5. 综合评分（0-100）：加权 = 品牌相关性×0.3 + 内容机会×0.4 + 竞争度反向分×0.3
   - 竞争度反向分：low=90, medium=60, high=30
6. 推荐理由（一句话，说明为什么值得做或放弃）

## 要求
1. 严格按综合评分从高到低排序
2. 评分要客观，不要所有词都给高分
3. 推荐理由要具体、可操作

返回 JSON 数组：
[{
  "keyword": "原始关键词",
  "intent_type": "informational",
  "competition": "low",
  "brand_relevance": 85,
  "content_opportunity": 90,
  "total_score": 88,
  "recommendation": "推荐理由"
}]`,
    variableDefs: [
      { name: 'domain', type: 'string', required: true, description: '领域' },
      { name: 'brand_section', type: 'string', required: false, description: '品牌调性段落' },
      { name: 'batch_count', type: 'string', required: true, description: '关键词总数' },
      { name: 'keyword_list', type: 'string', required: true, description: '关键词列表（已格式化）' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 提取自 webKnowledgeGenerate.ts（2个函数）
  // ═══════════════════════════════════════════════════════════
  web_knowledge_build_search: {
    label: '全网知识搜索提取',
    description: '从搜索结果中提取知识条目',
    systemPrompt: null,
    userPromptTemplate: `你是品牌知识库建设专家。以下是关于"{{topic}}"的搜索结果。

## 搜索结果
{{search_digest}}
{{avoid_titles}}

请提取 {{count}} 条有价值的知识条目。{{category_hint}}。
标题15-30字，正文200-500字，标签3-5个，confidence 0-1。

返回纯 JSON 数组：
[{"title":"标题","content":"正文","category":"route","tags":["标签1"],"source_url":"","confidence":0.85}]`,
    variableDefs: [
      { name: 'topic', type: 'string', required: true, description: '主题' },
      { name: 'search_digest', type: 'string', required: true, description: '搜索结果摘要' },
      { name: 'count', type: 'number', required: true, description: '提取数量' },
      { name: 'avoid_titles', type: 'string', required: false, description: '避免的标题段落' },
      { name: 'category_hint', type: 'string', required: false, description: '类别提示段落' },
    ],
  },

  web_knowledge_build_glm: {
    label: 'GLM一步知识生成',
    description: '使用GLM搜索+生成一步完成知识构建',
    systemPrompt: `你是一个品牌知识库建设专家。请先使用 web_search 工具搜索相关信息，然后基于搜索结果，生成结构化的知识条目。
{{category_hint}}
{{avoid_titles}}

分类说明：
- brand_intro：品牌/旅行社介绍、品牌故事、核心优势、团队实力
- route：独家路线、特色体验、行程亮点、小众玩法
- service：退款政策、安全保障、服务标准、售后保障
- case：客户真实评价、旅行故事、效果展示、客户见证
- faq：用户最关心的问题及标准回答（问答格式，可直接用于 GEO 内容）
- industry：目的地攻略、旅行常识、行业洞察、趋势分析

## ⚠️ 关键要求（必须严格遵守）
1. 标题：15-30字，简洁有力，具体不泛化
2. **正文必须达到 300-600 字**，这是硬性要求！
   - 包含具体的数字、地点、时间、价格等细节
   - 包含实用的建议和操作指南
   - 分段论述，不要一整段
   - 宁可详细也不要简略
3. 综合搜索结果信息，提炼有深度的知识，不要简单复制
4. 每条知识要有独特性和实用价值
5. content 字段的字符数不能少于 200

返回纯 JSON 数组，不要 markdown 代码块：
[{"title":"标题","content":"详细正文（300-600字）","category":"route","tags":["标签1","标签2"],"confidence":0.85}]`,
    userPromptTemplate: `请搜索"{{topic}}"相关信息，生成 {{count}} 条详细的结构化知识条目。注意：每条正文字数必须达到 300 字以上，要有具体细节和实用建议。`,
    variableDefs: [
      { name: 'topic', type: 'string', required: true, description: '主题' },
      { name: 'count', type: 'number', required: true, description: '生成数量' },
      { name: 'category_hint', type: 'string', required: false, description: '类别提示段落' },
      { name: 'avoid_titles', type: 'string', required: false, description: '避免的标题段落' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 文案创作相关（新增）
  // ═══════════════════════════════════════════════════════════
  copy_draft_generate: {
    label: '文案初稿生成',
    description: '基于选题+热点+品牌记忆生成创作文案',
    systemPrompt: null,
    userPromptTemplate: `你是一位专业的短视频文案创作者。请为选题"{{topic_title}}"写一篇短视频文案。

目标平台：{{platform}}
{{brand_section}}

内容骨架参考：{{topic_skeleton}}
相关热点：{{hotspot_list}}

要求：
1. 开头钩子（hook）：3秒内抓住注意力
2. 正文（body）：核心内容，200-500字
3. 结尾CTA（call_to_action）：引导互动
4. 风格自然口语化，避免AI痕迹

返回 JSON 对象：
{
  "title": "文案标题",
  "content": "完整文案全文",
  "structure": {
    "hook": "开头钩子",
    "body": "正文内容",
    "cta": "结尾互动引导",
    "style_notes": "风格说明"
  }
}`,
    variableDefs: [
      { name: 'topic_title', type: 'string', required: true, description: '选题标题' },
      { name: 'topic_skeleton', type: 'string', required: false, description: '内容骨架' },
      { name: 'hotspot_list', type: 'string', required: false, description: '相关热点列表' },
      { name: 'brand_section', type: 'string', required: false, description: '品牌调性段落' },
      { name: 'platform', type: 'string', required: false, description: '目标平台' },
    ],
  },

  copy_refine: {
    label: '文案润色改写',
    description: '对已有文案进行润色或按指令改写',
    systemPrompt: null,
    userPromptTemplate: `请{{instruction}}以下短视频文案：{{brand_section}}

原始文案：
{{content}}

返回润色后的完整文案（纯文本，不要JSON格式）。`,
    variableDefs: [
      { name: 'instruction', type: 'string', required: true, description: '改写指令（如"润色"/"改写得更口语化"）' },
      { name: 'content', type: 'string', required: true, description: '原始文案' },
      { name: 'brand_section', type: 'string', required: false, description: '品牌调性段落' },
    ],
  },

  prohibited_check: {
    label: '违禁词AI语境检测',
    description: '用AI检测关键词库可能遗漏的隐性违规表述',
    systemPrompt: null,
    userPromptTemplate: `你是一位短视频内容合规审核专家。请检查以下文案中是否有违禁词、敏感表述、绝对化用语或可能被平台限流的表达。

已通过关键词库检测出的词：{{found_words}}（请不要再报告这些词）

请关注关键词库可能遗漏的：
1. 语境中的隐性违规（如"全网最低"虽无"最"字但含义违规）
2. 新兴敏感词
3. 平台可能误判的表达

文案内容：
{{content}}

返回 JSON 数组，每个元素包含：
{ "word": "违禁词", "position": 0, "category": "high_risk", "risk": "high", "suggestion": "替换建议", "platform": ["douyin"] }

如果没有发现新的违禁词，返回空数组 []`,
    variableDefs: [
      { name: 'content', type: 'string', required: true, description: '待检测文案' },
      { name: 'found_words', type: 'string', required: false, description: '已检测出的词列表' },
    ],
  },
}
