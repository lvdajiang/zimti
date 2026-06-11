/**
 * 平台数据采集器接口
 *
 * 每个平台实现此接口以支持自动数据采集。
 * 设计为 stateless，每次调用 fetch() 独立完成。
 */
export interface PlatformDataCollector {
  /** 平台标识符，与 PublishRecord.platform 一致 */
  platform: string

  /**
   * 获取单个视频的统计数据
   * @param platformVideoId 平台原生视频ID（如 B站 BV号、抖音 video_id）
   */
  fetchVideoStats(platformVideoId: string): Promise<CollectedVideoStats>

  /** 判断 platformVideoId 格式是否有效 */
  isValidVideoId(id: string): boolean
}

export interface CollectedVideoStats {
  playCount: number
  likeCount?: number
  commentCount?: number
  collectCount?: number
  shareCount?: number
  completionRate?: number
  threeSecondBounceRate?: number
  privateMessageCount?: number
  title?: string
  coverUrl?: string
  publishedAt?: string
}
