import type { PlatformDataCollector } from './interface.js'
import { BilibiliCollector } from './bilibili.js'

const collectors = new Map<string, PlatformDataCollector>()

// 注册内置采集器
registerCollector(new BilibiliCollector())

export function registerCollector(collector: PlatformDataCollector): void {
  collectors.set(collector.platform, collector)
}

export function getCollector(platform: string): PlatformDataCollector | undefined {
  return collectors.get(platform)
}

export function getSupportedPlatforms(): string[] {
  return Array.from(collectors.keys())
}
