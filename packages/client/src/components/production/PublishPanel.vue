<template>
  <div class="publish-panel">
    <div class="panel-grid">
      <!-- 左侧：平台选择 + 适配内容 -->
      <div class="platforms-section">
        <div class="section-header">
          <h3>多平台发布</h3>
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
          <h4>适配内容</h4>
          <div v-for="item in adaptedPlatforms" :key="item.platform" class="adapted-card">
            <div class="adapted-header">
              <span class="platform-icon">{{ platformList.find(p => p.key === item.platform)?.icon }}</span>
              <span class="platform-name">{{ platformList.find(p => p.key === item.platform)?.label }}</span>
              <button class="btn btn-sm" @click="editAdapted(item)">编辑</button>
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
            v-if="adaptedPlatforms.length > 0"
            class="btn btn-block"
            :disabled="publishing"
            style="margin-top: 8px"
            @click="handlePublish"
          >
            {{ publishing ? '发布中...' : '一键发布' }}
          </button>
        </div>

        <!-- 发布状态 -->
        <div v-if="published" class="config-card success-card">
          <div class="success-icon">🎉</div>
          <h4>发布成功</h4>
          <p>已发布到 {{ adaptedPlatforms.length }} 个平台</p>
        </div>

        <!-- 无视频提示 -->
        <div v-if="!store.videoUrl" class="config-card warn-card">
          <p class="warn-text">⚠️ 尚未生成视频，请先完成前面步骤</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProductionStore } from '@/stores/production'
import { PLATFORM_LABELS } from '@zimti/shared'

interface AdaptedItem {
  platform: string
  title: string
  content: string
  tags: string
}

const store = useProductionStore()
const adaptedPlatforms = ref<AdaptedItem[]>([])
const adapting = ref(false)
const publishing = ref(false)
const published = ref(false)

const platformList = computed(() =>
  Object.entries(PLATFORM_LABELS).map(([key, label]) => {
    const icons: Record<string, string> = {
      xiaohongshu: '📕',
      douyin: '🎵',
      weixin_video: '📹',
      zhihu: '💡',
      baijiahao: '📰',
      toutiao: '📱',
      weixin_mp: '💬',
      bilibili: '📺',
    }
    return { key, label, icon: icons[key] || '📄' }
  }),
)

function togglePlatform(key: string) {
  const idx = store.targetPlatforms.indexOf(key)
  if (idx >= 0) {
    store.targetPlatforms.splice(idx, 1)
  } else {
    store.targetPlatforms.push(key)
  }
}

function editAdapted(_item: AdaptedItem) {
  // 内联编辑，v-model 已绑定
}

async function handleAdapt() {
  adapting.value = true
  try {
    // 为每个平台生成占位适配内容
    // TODO: 调用 POST /distribution/batch-adapt 真实 API
    adaptedPlatforms.value = store.targetPlatforms.map(platform => ({
      platform,
      title: `【新疆旅行】${store.fullText ? store.fullText.slice(0, 20) + '...' : '精彩内容'}`,
      content: store.fullText || '（视频内容）',
      tags: '新疆 旅行 攻略',
    }))

    await store.runStep(5, {
      platforms: store.targetPlatforms,
      adapted_content: adaptedPlatforms.value,
    })
  } finally {
    adapting.value = false
  }
}

async function handlePublish() {
  publishing.value = true
  try {
    // TODO: 调用实际的发布 API
    await new Promise(r => setTimeout(r, 1500))
    published.value = true
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

.section-header {
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
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

.platform-card:hover {
  border-color: var(--color-primary);
}

.platform-card.selected {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.06);
}

.platform-icon {
  font-size: 20px;
}

.platform-name {
  font-size: 13px;
  color: var(--color-text);
}

.adapted-list {
  margin-top: 16px;
}

.adapted-list h4 {
  margin: 0 0 12px;
  font-size: 14px;
}

.adapted-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}

.adapted-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.adapted-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.adapted-field label {
  display: block;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 14px;
  box-sizing: border-box;
}

.textarea {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px;
}

.config-card h4 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.hint-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 12px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 14px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.btn-block {
  width: 100%;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  margin-left: auto;
}

.success-card {
  text-align: center;
}

.success-icon {
  font-size: 36px;
  margin-bottom: 4px;
}

.success-card h4 {
  color: #10b981;
}

.success-card p {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.warn-card {
  border-color: #f59e0b;
}

.warn-text {
  margin: 0;
  font-size: 13px;
  color: #f59e0b;
}

@media (max-width: 768px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }

  .platform-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}
</style>
