/**
 * 平台配置常量 — 各平台内容规则和最佳实践
 *
 * 每个平台的字数限制、标签规则、内容格式、最佳发布时间等。
 * 供 AI 内容适配器和 prompt 使用，同时通过 API 返回给前端展示。
 */

import type { Platform } from '@zimti/shared'

export interface PlatformConfig {
  name: string
  maxLength: number
  tagLimit: number
  tagPrefix: string
  supportsMarkdown: boolean
  supportsImage: boolean
  supportsVideo: boolean
  imageLimit: number
  optimalTimes: string[]
  contentFormat: string
  toneGuidance: string
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  xiaohongshu: {
    name: '小红书',
    maxLength: 1000,
    tagLimit: 10,
    tagPrefix: '#',
    supportsMarkdown: false,
    supportsImage: true,
    supportsVideo: true,
    imageLimit: 18,
    optimalTimes: ['12:00', '18:00', '21:00'],
    contentFormat: '图文笔记',
    toneGuidance: '口语化、分享种草风格，用emoji点缀，标题要有好奇心或数字，首图决定点击率',
  },
  douyin: {
    name: '抖音',
    maxLength: 300,
    tagLimit: 5,
    tagPrefix: '#',
    supportsMarkdown: false,
    supportsImage: false,
    supportsVideo: true,
    imageLimit: 0,
    optimalTimes: ['12:00', '18:00', '20:00'],
    contentFormat: '短视频文案',
    toneGuidance: '短平快、有节奏感，前3秒要有钩子，善用热门BGM和话题标签',
  },
  weixin: {
    name: '视频号',
    maxLength: 500,
    tagLimit: 10,
    tagPrefix: '#',
    supportsMarkdown: false,
    supportsImage: true,
    supportsVideo: true,
    imageLimit: 9,
    optimalTimes: ['12:00', '18:00', '21:00'],
    contentFormat: '视频/图文',
    toneGuidance: '利他型标题，关注社交分享属性，嵌入微信搜一搜关键词',
  },
  zhihu: {
    name: '知乎',
    maxLength: 50000,
    tagLimit: 5,
    tagPrefix: '',
    supportsMarkdown: true,
    supportsImage: true,
    supportsVideo: false,
    imageLimit: 0,
    optimalTimes: ['10:00', '15:00', '22:00'],
    contentFormat: '长文回答',
    toneGuidance: '专业深度、数据支撑、逻辑清晰，适合干货攻略和对比评测，首段要直击问题核心',
  },
  baijiahao: {
    name: '百家号',
    maxLength: 30000,
    tagLimit: 5,
    tagPrefix: '',
    supportsMarkdown: false,
    supportsImage: true,
    supportsVideo: true,
    imageLimit: 20,
    optimalTimes: ['08:00', '12:00', '18:00'],
    contentFormat: '文章',
    toneGuidance: '标题要有信息量，正文结构清晰，适合SEO优化，图片要配alt文字',
  },
  toutiao: {
    name: '头条号',
    maxLength: 30000,
    tagLimit: 5,
    tagPrefix: '#',
    supportsMarkdown: false,
    supportsImage: true,
    supportsVideo: true,
    imageLimit: 20,
    optimalTimes: ['08:00', '12:00', '20:00'],
    contentFormat: '文章/微头条',
    toneGuidance: '新闻资讯感、标题党适度，正文分段短小精悍，适合信息流推荐',
  },
  wechat_official: {
    name: '公众号',
    maxLength: 20000,
    tagLimit: 0,
    tagPrefix: '',
    supportsMarkdown: false,
    supportsImage: true,
    supportsVideo: true,
    imageLimit: 0,
    optimalTimes: ['08:00', '12:00', '20:00'],
    contentFormat: '图文推送',
    toneGuidance: '深度内容为主，排版精美，标题要有悬念或价值感，开头要抓住注意力',
  },
  bilibili: {
    name: 'B站',
    maxLength: 250,
    tagLimit: 10,
    tagPrefix: '',
    supportsMarkdown: false,
    supportsImage: false,
    supportsVideo: true,
    imageLimit: 0,
    optimalTimes: ['18:00', '20:00', '22:00'],
    contentFormat: '视频简介',
    toneGuidance: '二次元+知识向混合风格，简介要写清视频亮点，标签要覆盖搜索关键词',
  },
}

/** 获取所有平台配置列表（API 用） */
export function getAllPlatformConfigs(): Array<{ platform: Platform } & PlatformConfig> {
  return (Object.entries(PLATFORM_CONFIGS) as [Platform, PlatformConfig][]).map(([platform, config]) => ({
    platform,
    ...config,
  }))
}
