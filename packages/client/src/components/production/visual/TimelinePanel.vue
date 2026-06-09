<template>
  <div class="timeline-panel">
    <div class="panel-header">
      <h4>时间轴</h4>
      <div class="header-actions">
        <button class="btn btn-sm btn-outline" :disabled="building" @click="handleBuild">
          {{ building ? '构建中...' : '🔧 构建时间轴' }}
        </button>
        <button class="btn btn-sm btn-outline" :disabled="!timeline || aligning" @click="handleAutoAlign">
          {{ aligning ? '对齐中...' : '✨ AI 自动对齐' }}
        </button>
      </div>
    </div>

    <div v-if="!timeline" class="empty-hint">
      点击「构建时间轴」，自动将分镜、素材、配音编排到时间线上
    </div>

    <div v-else class="timeline-content">
      <div class="info-row">
        <span>总时长: <strong>{{ totalDuration.toFixed(1) }}s</strong></span>
        <span>视频段: {{ trackCounts.video }}</span>
        <span>音频段: {{ trackCounts.audio }}</span>
        <span>字幕段: {{ trackCounts.subtitle }}</span>
      </div>

      <!-- 视频轨 -->
      <div class="track">
        <div class="track-label">🎬 画面</div>
        <div class="track-items">
          <div
            v-for="item in videoTrack"
            :key="item.segmentIndex"
            class="track-item video-item"
            :style="{ width: itemWidth(item) + '%' }"
            :title="`段${item.segmentIndex + 1}: ${item.startTime.toFixed(1)}s - ${item.endTime.toFixed(1)}s`"
          >
            <span class="item-text">{{ item.segmentIndex + 1 }}</span>
          </div>
        </div>
      </div>

      <!-- 音频轨 -->
      <div class="track">
        <div class="track-label">🎤 配音</div>
        <div class="track-items">
          <div
            v-for="item in audioTrack"
            :key="item.segmentIndex"
            class="track-item audio-item"
            :style="{ width: itemWidth(item) + '%' }"
            :title="`口播${item.segmentIndex + 1}: ${item.startTime.toFixed(1)}s - ${item.endTime.toFixed(1)}s`"
          >
            <span class="item-text">{{ item.segmentIndex + 1 }}</span>
          </div>
          <div v-if="audioTrack.length === 0" class="track-empty">暂无配音</div>
        </div>
      </div>

      <!-- 字幕轨 -->
      <div class="track">
        <div class="track-label">📝 字幕</div>
        <div class="track-items">
          <div
            v-for="item in subtitleTrack"
            :key="item.segmentIndex"
            class="track-item subtitle-item"
            :style="{ width: itemWidth(item) + '%' }"
            :title="`字幕${item.segmentIndex + 1}: ${item.startTime.toFixed(1)}s - ${item.endTime.toFixed(1)}s`"
          >
            <span class="item-text">{{ item.segmentIndex + 1 }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import api from '@/api/client'

interface TrackItem {
  segmentIndex: number
  startTime: number
  endTime: number
  segmentType: string
  materialId: string | null
}

interface TimelineData {
  id: string
  tracks: {
    video: TrackItem[]
    audio: TrackItem[]
    subtitle: TrackItem[]
  }
  totalDuration: number
}

const props = defineProps<{ jobId: string }>()
const timeline = ref<TimelineData | null>(null)
const building = ref(false)
const aligning = ref(false)

const totalDuration = computed(() => timeline.value?.totalDuration || 0)
const videoTrack = computed(() => timeline.value?.tracks.video || [])
const audioTrack = computed(() => timeline.value?.tracks.audio || [])
const subtitleTrack = computed(() => timeline.value?.tracks.subtitle || [])
const trackCounts = computed(() => ({
  video: videoTrack.value.length,
  audio: audioTrack.value.length,
  subtitle: subtitleTrack.value.length,
}))

function itemWidth(item: TrackItem): number {
  if (!totalDuration.value) return 0
  return Math.max(2, ((item.endTime - item.startTime) / totalDuration.value) * 100)
}

onMounted(() => { loadTimeline() })

async function loadTimeline() {
  if (!props.jobId) return
  try {
    const res = await api.get(`/pipeline/production/${props.jobId}/timeline`)
    timeline.value = (res as any) as TimelineData
  } catch {
    timeline.value = null
  }
}

async function handleBuild() {
  building.value = true
  try {
    const res = await api.post(`/pipeline/production/${props.jobId}/timeline/build`)
    timeline.value = (res as any) as TimelineData
  } catch {
    // toast by api client
  } finally {
    building.value = false
  }
}

async function handleAutoAlign() {
  aligning.value = true
  try {
    await api.post(`/pipeline/production/${props.jobId}/timeline/auto-align`)
    await loadTimeline()
  } catch {
    // toast by api client
  } finally {
    aligning.value = false
  }
}
</script>

<style scoped>
.timeline-panel { padding: 4px 0; }

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-header h4 { margin: 0; font-size: 15px; }

.header-actions { display: flex; gap: 6px; }

.info-row {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--color-background);
  border-radius: 6px;
}

.track {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.track-label {
  width: 56px;
  font-size: 12px;
  flex-shrink: 0;
  text-align: right;
}

.track-items {
  flex: 1;
  display: flex;
  height: 28px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

.track-item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  border-right: 1px solid rgba(255,255,255,0.1);
}

.video-item { background: #3B82F6; }
.audio-item { background: #10B981; }
.subtitle-item { background: #8B5CF6; }

.item-text { font-size: 10px; color: #fff; }

.track-empty {
  display: flex;
  align-items: center;
  padding-left: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.btn {
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 12px;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline { color: var(--color-primary); border-color: var(--color-primary); }
.btn-sm { padding: 4px 10px; font-size: 12px; }

.empty-hint {
  text-align: center;
  padding: 30px;
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
