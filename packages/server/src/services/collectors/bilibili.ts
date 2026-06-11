/**
 * B站 (Bilibili) 数据采集器
 *
 * 使用公开 API（无需 OAuth）：https://api.bilibili.com/x/web-interface/view?bvid={BV_ID}
 * 速率限制：约 3 req/s（低频率采集，不影响平台）
 */
import type { PlatformDataCollector, CollectedVideoStats } from './interface.js'

const BILIBILI_API_BASE = 'https://api.bilibili.com/x/web-interface/view'

export class BilibiliCollector implements PlatformDataCollector {
  platform = 'bilibili'

  isValidVideoId(id: string): boolean {
    return /^BV[a-zA-Z0-9]{10}$/.test(id)
  }

  async fetchVideoStats(bvid: string): Promise<CollectedVideoStats> {
    if (!this.isValidVideoId(bvid)) {
      throw new Error(`Invalid Bilibili BV号: ${bvid}`)
    }

    const url = `${BILIBILI_API_BASE}?bvid=${bvid}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ZimtiCollector/1.0)',
        'Referer': 'https://www.bilibili.com/',
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      throw new Error(`Bilibili API HTTP error: ${res.status} ${res.statusText}`)
    }

    const body = (await res.json()) as {
      code: number
      message: string
      data?: {
        title?: string
        pic?: string
        pubdate?: number
        stat?: {
          view?: number
          like?: number
          coin?: number
          favorite?: number
          share?: number
          danmaku?: number
          reply?: number
        }
      }
    }

    if (body.code !== 0 || !body.data) {
      throw new Error(`Bilibili API error: code=${body.code}, message=${body.message}`)
    }

    const { stat, title, pic, pubdate } = body.data

    return {
      playCount: stat?.view ?? 0,
      likeCount: stat?.like ?? 0,
      commentCount: stat?.reply ?? 0,
      collectCount: stat?.favorite ?? 0,
      shareCount: stat?.share ?? 0,
      completionRate: 0,
      threeSecondBounceRate: 0,
      privateMessageCount: 0,
      title: title || undefined,
      coverUrl: pic || undefined,
      publishedAt: pubdate ? new Date(pubdate * 1000).toISOString() : undefined,
    }
  }
}
