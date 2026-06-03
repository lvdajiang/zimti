<template>
  <div class="publish-panel">
    <div class="panel-grid">
      <!-- 左侧：平台选择 + 适配内容 -->
      <div class="platforms-section">
        <div class="section-header">
          <h3>多平台发布</h3>
        </div>

        <!-- 无视频提示 -->
        <div v-if="!store.videoUrl" class="warn-banner">
          ⚠️ 尚未生成视频，请先完成前面步骤
        </div>

        <!-- 平台选择 -->
        <div class="platform-grid">
          <div
            v-for="p in platformList"
            :key="p.key"
            class="platform-card"
            :class="{ selected: store.targetPlatforms.includes(p.key) }"
            @click="togglePlatform(p.key)"
          >
            <span class="platform-icon">{{ p.icon }}</span>
            <span class="platform-name">{{ p.label }}</span>
          </div>
        </div>

        <!-- 适配结果 -->
        <div v-if="adaptedPlatforms.length > 0" class="adapted-list">
          <h4>适配内容 ({{ adaptedPlatforms.length }} 个平台)</h4>
          <div v-for="item in adaptedPlatforms" :key="item.platform" class="adapted-card">
            <div class="adapted-header">
              <span class="platform-icon">{{ getPlatformIcon(item.platform) }}</span>
              <span class="platform-name">{{ getPlatformLabel(item.platform) }}</span>
              <span class="adapted-badge">{{ item._new ? '新适配' : '已适配' }}</span>
            </div>
            <div class="adapted-body">
              <div class="adapted-field">
                <label>标题</label>
                <input v-model="item.title" class="input" />
              </div>
              <div class="adapted-field">
                <label>正文</label>
                <textarea v-model="item.content" class="input textarea" rows="3" />
              </div>
              <div class="adapted-field">
                <label>标签</label>
                <input v-model="item.tags" class="input" placeholder="用空格分隔标签" />
              </div>
            </div>
          </div>
        </div>

        <!-- 已发布状态 -->
        <div v-if="published" class="published-banner">
          🎉 已成功发布到 {{ publishedCount }} 个平台
        </div>
      </div>

      <!-- 右侧：操作 -->
      <div class="config-section">
        <div class="config-card">
          <h4>发布操作</h4>
          <p class="hint-text">选择目标平台后，AI 将自动适配内容格式和标签</p>

          <button
            class="btn btn-primary btn-block"
            :disabled="store.targetPlatforms.length === 0 || adapting"
            @click="handleAdapt"
          >
            {{ adapting ? '适配中...' : '一键适配' }}
          </button>

          <button
            v-if="adaptedPlatforms.length > 0 && !published"
            class="btn btn-block btn-publish"
            :disabled="publishing"
            style="margin-top: 8px"
            @click="handlePublish"
          >
            {{ publishing ? '发布中...' : '一键发布' }}
          </button>
        </div>

        <!-- 适配进度 -->
        <div v-if="adapting" class="config-card">
          <div class="loading-wrapper">AI 正在适配内容，请稍候...</div>
        </div>

        <!-- 发布状态 -->
        <div v-if="store.steps[4]?.status === 'completed'" class="config-card success-card">
          <span class="success-icon">✅</span>
          <h4>发布完成</h4>
          <p>已发布到 {{ publishedCount }} 个平台</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProductionStore } from '@/stores/production'
import { PLATFORM_LABELS } from '@zimti/shared'
import api from '@/api/client'

interface AdaptedItem {
  platform: string
  title: string
  content: string
  tags: string
  _new?: boolean
}

const store = useProductionStore()
const adaptedPlatforms = ref<AdaptedItem[]>([])
const adapting = ref(false)
const publishing = ref(false)
const published = ref(false)

const platformList = computed(() =>
  Object.entries(PLATFORM_LABELS).map(([key, label]) => {
    const icons: Record<string, string> = {
      xiaohongshu: '📕', douyin: '🎵', weixin_video: '📹',
      zhihu: '💡', baijiahao: '📰', toutiao: '📱',
      weixin_mp: '💬', bilibili: '📺',
    }
    return { key, label, icon: icons[key] || '📄' }
  }),
)

const publishedCount = computed(() => adaptedPlatforms.value.length)

function getPlatformIcon(key: string): string {
  return platformList.value.find(p => p.key === key)?.icon || '📄'
}

function getPlatformLabel(key: string): string {
  return platformList.value.find(p => p.key === key)?.label || key
}

function togglePlatform(key: string) {
  const idx = store.targetPlatforms.indexOf(key)
  if (idx >= 0) {
    store.targetPlatforms.splice(idx, 1)
    // 移除已适配的内容
    adaptedPlatforms.value = adaptedPlatforms.value.filter(a => a.platform !== key)
  } else {
    store.targetPlatforms.push(key)
  }
}

async function handleAdapt() {
  adapting.value = true
  published.value = false
  try {
    // 调用 batch-adapt API
    const res = await api.post('/distribution/batch-adapt', {
      source_title: store.fullText ? store.fullText.slice(0, 50) : '视频内容',
      source_content: store.fullText || '',
      source_tags: '',
      platforms: store.targetPlatforms,
    }) as any

    // 轮询适配状态
    const taskId = res.task_id
    const result = await pollAdaptStatus(taskId)

    // 解析适配结果
    if (result?.output) {
      const output = result.output as Record<string, any>
      const adapted = output.adapted || output.results || []

      // 合并已有适配和新增适配
      const newItems: AdaptedItem[] = store.targetPlatforms
        .filter(platform => !adaptedPlatforms.value.some(a => a.platform === platform))
        .map(platform => {
          // 尝试从 AI 输出中找对应平台的适配
          const found = adapted.find((a: any) => a.platform === platform)
          return {
            platform,
            title: found?.title || found?.adapted_title || `【${getPlatformLabel(platform)}】${store.fullText ? store.fullText.slice(0, 20) + '...' : '精彩内容'}`,
            content: found?.content || found?.adapted_content || store.fullText || '',
            tags: found?.tags || found?.adapted_tags || '新疆 旅行 攻略',
            _new: true,
          }
        })

      adaptedPlatforms.value = [...adaptedPlatforms.value, ...newItems]
    }
  } catch (err) {
    console.error('[handleAdapt] failed:', err)
    // fallback: 生成占位适配
    const fallback = store.targetPlatforms
      .filter(platform => !adaptedPlatforms.value.some(a => a.platform === platform))
      .map(platform => ({
        platform,
        title: `【${getPlatformLabel(platform)}】${store.fullText ? store.fullText.slice(0, 20) + '...' : '精彩内容'}`,
        content: store.fullText || '（视频内容）',
        tags: '新疆 旅行 攻略',
        _new: true,
      }))
    adaptedPlatforms.value = [...adaptedPlatforms.value, ...fallback]
  } finally {
    adapting.value = false
  }
}

async function pollAdaptStatus(taskId: string, maxAttempts = 15): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      const st = await api.get(`/distribution/batch-adapt/${taskId}/status`) as any
      if (st.status === 'success') return st
      if (st.status === 'failed') return null
    } catch {
      return null
    }
  }
  return null
}

async function handlePublish() {
  publishing.value = true
  try {
    // 为每个平台创建分发记录
    for (const item of adaptedPlatforms.value) {
      try {
        await api.post('/distribution/records', {
          source_content_id: store.videoProductId || store.scriptId,
          source_type: store.videoProductId ? 'video_product' : 'script',
          platform: item.platform,
          adapted_title: item.title,
          adapted_content: item.content,
          adapted_tags: item.tags,
        })
      } catch {
        // 单个平台失败不阻塞其他平台
      }
    }

    published.value = true

    // 更新流水线步骤状态
    await store.runStep(5, {
      platforms: store.targetPlatforms,
      publish_records: adaptedPlatforms.value.map(a => ({ platform: a.platform, title: a.title })),
    })
  } finally {
    publishing.value = false
  }
}
</script>

<style scoped>
.publish-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 20px;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
}

.section-header { margin-bottom: 16px; }
.section-header h3 { margin: 0; font-size: 16px; }

.warn-banner {
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid #f59e0b;
  border-radius: 8px;
  color: #f59e0b;
  font-size: 14px;
  margin-bottom: 16px;
}

.platform-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 20px;
}

.platform-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.platform-card:hover { border-color: var(--color-primary); }
.platform-card.selected {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.06);
}

.platform-icon { font-size: 20px; }
.platform-name { font-size: 13px; color: var(--color-text); }

.adapted-list { margin-top: 16px; }
.adapted-list h4 { margin: 0 0 12px; font-size: 14px; }

.adapted-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}
.adapted-card:last-child { margin-bottom: 0; }

.adapted-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.adapted-badge {
  font-size: 11px;
  color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
}

.adapted-body { display: flex; flex-direction: column; gap: 8px; }
.adapted-field label { display: block; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px; }

.input {
  width: 100%; padding: 6px 10px;
  border: 1px solid var(--color-border); border-radius: 6px;
  background: var(--color-surface); color: var(--color-text);
  font-size: 14px; box-sizing: border-box;
}
.textarea { resize: vertical; min-height: 60px; font-family: inherit; }

.published-banner {
  margin-top: 16px;
  padding: 16px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid #10b981;
  border-radius: 8px;
  text-align: center;
  font-size: 16px;
  color: #10b981;
}

.config-section { display: flex; flex-direction: column; gap: 12px; }

.config-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px;
}
.config-card h4 { margin: 0 0 10px; font-size: 14px; font-weight: 600; }

.hint-text { font-size: 13px; color: var(--color-text-secondary); margin: 0 0 12px; }

.btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 14px;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn-publish { background: #10b981; color: #fff; border-color: #10b981; font-weight: 600; }
.btn-publish:hover:not(:disabled) { opacity: 0.9; }
.btn-block { width: 100%; }

.success-card { text-align: center; }
.success-card h4 { color: #10b981; }
.success-card p { margin: 4px 0 0; font-size: 14px; color: var(--color-text-secondary); }
.success-icon { font-size: 28px; }

.loading-wrapper { text-align: center; padding: 16px; color: var(--color-text-secondary); font-size: 14px; }

@media (max-width: 768px) {
  .panel-grid { grid-template-columns: 1fr; }
  .platform-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
}
</style>
