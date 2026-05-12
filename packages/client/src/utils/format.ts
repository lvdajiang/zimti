const platformLabels: Record<string, string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  weixin: '视频号',
}

export function formatNumber(value: number): string {
  if (value >= 100000000) return (value / 100000000).toFixed(2) + '亿'
  if (value >= 10000) return (value / 10000).toFixed(1) + '万'
  return value.toLocaleString()
}

export function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return '-'
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }
  return new Date(iso).toLocaleDateString('zh-CN', opts)
}

export function platformLabel(p: string): string {
  return platformLabels[p] ?? p
}
