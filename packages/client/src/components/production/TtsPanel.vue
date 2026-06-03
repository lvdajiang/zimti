<template>
  <div class="tts-panel">
    <div class="panel-grid">
      <!-- 左侧：分镜列表 + 配音状态 -->
      <div class="segments-section">
        <div class="section-header">
          <h3>分镜配音</h3>
          <span v-if="totalDuration > 0" class="duration-badge">总时长 {{ totalDuration }}s</span>
        </div>

        <div v-if="loading" class="loading-wrapper">加载分镜中...</div>
        <div v-else-if="segments.length === 0" class="empty-hint">
          请先在「脚本」步骤中生成分镜
        </div>
        <div v-else class="segment-list">
          <div
            v-for="(seg, i) in segments"
            :key="seg.id"
            class="segment-card"
            :class="{ has_audio: !!seg.oral_audio_url }"
          >
            <div class="seg-header">
              <span class="seg-index">{{ i + 1 }}</span>
              <span class="seg-type-badge">{{ seg.segment_type === 'oral' ? '口播' : '画面' }}</span>
              <span v-if="seg.oral_audio_url" class="audio-badge">已配音</span>
            </div>
            <div class="seg-text">{{ seg.oral_text || seg.visual_description || '（无内容）' }}</div>
            <div v-if="seg.oral_audio_url" class="audio-player">
              <audio controls :src="audioPath(seg.oral_audio_url)" class="player" />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：配置 -->
      <div class="config-section">
        <div class="config-card">
          <h4>语音设置</h4>
          <div class="form-group">
            <label>语音</label>
            <select v-model="store.ttsVoice" class="input">
              <option value="zh-CN-XiaoxiaoNeural">晓晓（女声，温柔）</option>
              <option value="zh-CN-YunxiNeural">云希（男声，阳光）</option>
              <option value="zh-CN-YunjianNeural">云健（男声，磁性）</option>
              <option value="zh-CN-XiaoyiNeural">晓依（女声，活泼）</option>
              <option value="zh-CN-YunyangNeural">云扬（男声，新闻）</option>
            </select>
          </div>
          <div class="form-group">
            <label>语速</label>
            <select v-model="ttsRate" class="input">
              <option value="-10%">慢速</option>
              <option value="+0%">正常</option>
              <option value="+10%">较快</option>
              <option value="+20%">快速</option>
            </select>
          </div>
        </div>

        <button
          class="btn btn-primary btn-block"
          :disabled="segments.length === 0 || store.executing"
          @click="handleVoiceover"
        >
          {{ store.executing ? '配音中...' : '一键配音' }}
        </button>

        <!-- 状态提示 -->
        <div v-if="store.steps[1]?.status === 'completed'" class="config-card success-card">
          <span class="success-icon">✅</span> 配音完成，可以进入下一步
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useProductionStore } from '@/stores/production'
import api from '@/api/client'

interface SegmentItem {
  id: number
  segment_type: string
  oral_text: string | null
  visual_description: string
  oral_audio_url: string | null
  duration: number
}

const store = useProductionStore()
const segments = ref<SegmentItem[]>([])
const loading = ref(false)
const ttsRate = ref('+0%')

const totalDuration = computed(() =>
  segments.value.reduce((sum, s) => sum + (s.duration || 0), 0),
)

/** 音频文件路径：后端存的是 uploads/tts/xxx.mp3，前端通过静态文件服务访问 */
function audioPath(url: string): string {
  if (!url) return ''
  // 如果已经是 http 开头的完整 URL，直接返回
  if (url.startsWith('http')) return url
  // 否则作为静态文件路径
  return `/static/${url.replace(/\\/g, '/').split('/').slice(-2).join('/')}`
}

onMounted(() => { loadSegments() })
watch(() => store.scriptId, () => { loadSegments() })

async function loadSegments() {
  if (!store.scriptId) return
  loading.value = true
  try {
    const res = await api.get(`/scripts/${store.scriptId}`) as any
    segments.value = res.segments || []
  } catch {
    // 静默
  } finally {
    loading.value = false
  }
}

async function handleVoiceover() {
  await store.runStep(2, {
    voice: store.ttsVoice,
    rate: ttsRate.value,
  })
  // 重新加载分镜以获取音频 URL
  await loadSegments()
}
</script>

<style scoped>
.tts-panel {
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
}

.duration-badge {
  font-size: 13px;
  color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.1);
  padding: 4px 10px;
  border-radius: 12px;
}

.segment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 500px;
  overflow-y: auto;
}

.segment-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
}

.segment-card.has_audio {
  border-left: 3px solid #10b981;
}

.seg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.seg-index {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  flex-shrink: 0;
}

.seg-type-badge {
  font-size: 12px;
  color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.audio-badge {
  font-size: 12px;
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
}

.seg-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.audio-player {
  margin-top: 8px;
}

.player {
  width: 100%;
  height: 32px;
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

.form-group {
  margin-bottom: 10px;
}

.form-group label {
  display: block;
  font-size: 13px;
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

.success-card {
  text-align: center;
  color: #10b981;
  font-size: 14px;
}

.success-icon {
  margin-right: 4px;
}

.loading-wrapper {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
}

.empty-hint {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

@media (max-width: 768px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}
</style>
