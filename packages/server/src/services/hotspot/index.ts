import { prisma } from '../../db.js'

interface HotspotItem {
  title: string
  source_platform: string
  source: string
  source_url?: string
  heat_value: number
  keywords?: string[]
}

interface HotspotSource {
  platform: string
  fetch(): Promise<HotspotItem[]>
}

class WeiboSource implements HotspotSource {
  platform = 'weibo'
  source = '微博热搜'

  async fetch(): Promise<HotspotItem[]> {
    try {
      const resp = await fetch('https://weibo.com/ajax/side/hotSearch', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      if (!resp.ok) return []
      const data = await resp.json() as { data?: { realtime: Array<{ note: string; word: string; num: number; url: string }> } }
      return (data.data?.realtime ?? []).slice(0, 30).map(item => ({
        title: item.word ?? item.note,
        source_platform: 'weibo',
        source: '微博热搜',
        source_url: item.url,
        heat_value: item.num ?? 0,
      }))
    } catch (error) {
      console.error('[HotspotSource] Weibo fetch failed:', error)
      return []
    }
  }
}

class DoubanSource implements HotspotSource {
  platform = 'douban'
  source = '豆瓣热门话题'

  async fetch(): Promise<HotspotItem[]> {
    try {
      const resp = await fetch('https://movie.douban.com/chart', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      if (!resp.ok) return []
      return []
    } catch (error) {
      console.error('[HotspotSource] Douban fetch failed:', error)
      return []
    }
  }
}

class ZhihuSource implements HotspotSource {
  platform = 'zhihu'
  source = '知乎热榜'

  async fetch(): Promise<HotspotItem[]> {
    try {
      const resp = await fetch('https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=30', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      if (!resp.ok) return []
      const data = await resp.json() as { data?: Array<{ target: { title: string; excerpt: string; id: string; url: string } }> }
      return (data.data ?? []).slice(0, 30).map((item, idx) => ({
        title: item.target.title,
        source_platform: 'zhihu',
        source: '知乎热榜',
        source_url: `https://www.zhihu.com/question/${item.target.id}`,
        heat_value: Math.max(0, 1000000 - idx * 30000),
      }))
    } catch (error) {
      console.error('[HotspotSource] Zhihu fetch failed:', error)
      return []
    }
  }
}

const sources: Record<string, HotspotSource> = {
  weibo: new WeiboSource(),
  douban: new DoubanSource(),
  zhihu: new ZhihuSource(),
}

export async function refreshHotspots(platform?: string): Promise<{ total: number; created: number; updated: number }> {
  const sourceList = platform && sources[platform]
    ? [sources[platform]]
    : Object.values(sources)

  let total = 0
  let created = 0
  let updated = 0

  for (const source of sourceList) {
    const items = await source.fetch()
    for (const item of items) {
      total++
      const existing = await prisma.hotspot.findFirst({
        where: { title: item.title, sourcePlatform: item.source_platform },
      })

      if (existing) {
        await prisma.hotspot.update({
          where: { id: existing.id },
          data: { heatValue: item.heat_value, heatTrend: item.heat_value > existing.heatValue ? 'up' : 'stable' },
        })
        updated++
      } else {
        await prisma.hotspot.create({
          data: {
            title: item.title,
            sourcePlatform: item.source_platform,
            source: item.source,
            sourceUrl: item.source_url ?? null,
            heatValue: item.heat_value,
            heatTrend: 'new',
            keywords: item.keywords ?? [],
            relevanceScore: 0.5,
            validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
        })
        created++
      }
    }
  }

  return { total, created, updated }
}
