/**
 * 全网搜索服务 — 为知识库建库提供搜索能力
 *
 * 双引擎架构：
 * 1. GLM web_search（智谱AI原生联网搜索，通过 Anthropic 兼容接口）
 * 2. SearXNG 公共实例（降级方案，开源搜索引擎聚合）
 */

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source: 'glm' | 'searxng'
  urlVerified: boolean
  isGovSource: boolean
}

// ============================================================
// 方案1：GLM web_search（原生 API chat/completions）
// ============================================================

/**
 * 通过 GLM 原生 API 的 web_search 工具进行搜索
 * 端点：POST /api/paas/v4/chat/completions
 * 在 tools 中传入 {"type": "web_search", "web_search": {"enable": true}}
 *
 * 注意：GLM 模型使用 web_search 后会在回复中自然融入搜索结果，
 * 而非返回结构化搜索列表。因此我们让模型直接回答问题，
 * 回复内容本身就是有价值的搜索结果。
 */
async function searchViaGLM(query: string, maxResults: number): Promise<SearchResult[]> {
  const apiKey = process.env.GLM_API_KEY
  if (!apiKey) throw new Error('GLM_API_KEY 未配置')

  const baseUrl = process.env.GLM_NATIVE_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4'
  const model = process.env.GLM_WEB_SEARCH_MODEL ?? 'glm-4-flash'

  // 让模型搜索并总结为多条独立知识点
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `你是一个搜索研究助手。请先使用 web_search 工具搜索用户的问题，然后基于搜索结果，整理出 ${maxResults} 条独立的知识要点。

每条知识要点格式：
### [序号]. 标题
内容正文（100-200字，包含具体信息、数据、建议）

请确保每条知识都有实质内容，不要泛泛而谈。标题要具体有吸引力。`,
        },
        { role: 'user', content: `请搜索并整理关于"${query}"的知识要点` },
      ],
      tools: [{ type: 'web_search', web_search: { enable: true } }],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`GLM web_search API 错误: ${response.status} ${text}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content?: string } }>
  }

  const textContent = data.choices?.[0]?.message?.content
  if (!textContent) return []

  // 将 AI 回复拆分为多条知识
  const segments = textContent.split(/###\s*\[?\d+\]?\./).filter(s => s.trim().length > 20)
  if (segments.length === 0) {
    // 如果没匹配到分段格式，整段作为一条结果
    return [{
      title: query,
      url: '',
      snippet: textContent.slice(0, 500),
      source: 'glm' as const,
      urlVerified: false,
      isGovSource: false,
    }]
  }

  return segments.slice(0, maxResults).map(seg => {
    const lines = seg.trim().split('\n')
    const title = lines[0].trim().slice(0, 50)
    const snippet = lines.slice(1).join('\n').trim().slice(0, 300)
    return { title, url: '', snippet, source: 'glm' as const, urlVerified: false, isGovSource: false }
  })
}

// ============================================================
// 方案2：SearXNG 公共实例（降级方案）
// ============================================================

const SEARXNG_INSTANCES = [
  'https://searx.be',
  'https://search.sapti.me',
  'https://searxng.ch',
  'https://search.bus-hit.me',
]

/**
 * 尝试多个 SearXNG 公共实例进行搜索
 */
async function searchViaSearXNG(query: string, maxResults: number): Promise<SearchResult[]> {
  const errors: string[] = []

  for (const instance of SEARXNG_INSTANCES) {
    try {
      const url = new URL('/search', instance)
      url.searchParams.set('q', query)
      url.searchParams.set('format', 'json')
      url.searchParams.set('language', 'zh-CN')
      url.searchParams.set('categories', 'general')

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      })

      clearTimeout(timeout)

      if (!response.ok) {
        errors.push(`${instance}: ${response.status}`)
        continue
      }

      const data = await response.json() as {
        results: Array<{ title: string; url: string; content: string }>
      }

      if (!data.results?.length) {
        errors.push(`${instance}: 无结果`)
        continue
      }

      return data.results.slice(0, maxResults).map(r => ({
        title: r.title || '未知标题',
        url: r.url || '',
        snippet: r.content || '',
        source: 'searxng' as const,
        urlVerified: true,
        isGovSource: (r.url || '').includes('.gov.cn'),
      }))
    } catch (err) {
      errors.push(`${instance}: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  throw new Error(`所有 SearXNG 实例均失败:\n${errors.join('\n')}`)
}

// ============================================================
// 统一搜索入口
// ============================================================

/**
 * 全网搜索 — GLM web_search 优先，SearXNG 降级
 *
 * @param query 搜索关键词/主题
 * @param maxResults 最大结果数（默认 10）
 * @returns 搜索结果列表
 */
export async function searchWeb(query: string, maxResults = 10): Promise<SearchResult[]> {
  // 1. 优先尝试 GLM web_search
  try {
    const results = await searchViaGLM(query, maxResults)
    if (results.length > 0) {
      console.log(`[WebSearch] GLM web_search 返回 ${results.length} 条结果`)
      return results
    }
    console.log('[WebSearch] GLM web_search 返回空结果，尝试 SearXNG')
  } catch (err) {
    console.warn(`[WebSearch] GLM web_search 失败: ${err instanceof Error ? err.message : err}`)
  }

  // 2. 降级到 SearXNG
  console.log('[WebSearch] 使用 SearXNG 公共实例搜索')
  const results = await searchViaSearXNG(query, maxResults)
  console.log(`[WebSearch] SearXNG 返回 ${results.length} 条结果`)
  return results
}

/**
 * 简单的文本摘要提取 — 从网页内容中提取关键段落
 * 用于后续 AI 处理前的预处理
 */
export function extractTextFromHtml(html: string): string {
  // 去除 HTML 标签
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000) // 限制长度避免 token 过多
}

// ============================================================
// 政务搜索增强
// ============================================================

/**
 * 同时搜索常规结果和 site:gov.cn 政府来源
 * 政府来源标记 urlVerified + isGovSource，可信度自动 boost
 *
 * @param query 搜索关键词
 * @param maxResults 最大结果数（默认 10）
 * @returns 合并后的搜索结果（政府来源排在前面）
 */
export async function searchWebWithGov(query: string, maxResults = 10): Promise<SearchResult[]> {
  const [regularResults, govResults] = await Promise.allSettled([
    searchWeb(query, maxResults),
    searchWeb(`site:gov.cn ${query}`, Math.ceil(maxResults / 2)),
  ])

  const allResults: SearchResult[] = []

  // 处理政务结果（排前面，isGovSource + urlVerified）
  if (govResults.status === 'fulfilled') {
    for (const r of govResults.value) {
      allResults.push({
        ...r,
        isGovSource: true,
        urlVerified: true,
      })
    }
    console.log(`[WebSearch] 政务搜索返回 ${govResults.value.length} 条结果`)
  } else {
    console.warn(`[WebSearch] 政务搜索失败: ${govResults.reason instanceof Error ? govResults.reason.message : govResults.reason}`)
  }

  // 处理常规结果（去重）
  if (regularResults.status === 'fulfilled') {
    const existingUrls = new Set(allResults.map(r => r.url))
    for (const r of regularResults.value) {
      if (r.url && existingUrls.has(r.url)) continue
      existingUrls.add(r.url)
      allResults.push(r)
    }
  }

  return allResults.slice(0, maxResults)
}
