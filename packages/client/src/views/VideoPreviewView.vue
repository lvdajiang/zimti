<template>
  <div class="preview-page">
    <div class="title-bar">
      <h2>视频预览与渲染</h2>
      <button v-if="scriptId" class="btn btn-outline btn-back" @click="goBackToEditor">返回编辑</button>
    </div>

    <div v-if="!scriptId" class="empty-state">
      <p>请从脚本编辑器或内容库进入视频预览</p>
    </div>

    <div v-else class="preview-layout">
      <div class="preview-main">
        <!-- 视频播放器 -->
        <div class="player-area">
          <video
            v-if="videoUrl"
            ref="videoEl"
            :src="videoUrl"
            controls
            class="preview-video"
            @timeupdate="onTimeUpdate"
          />
          <div v-else-if="renderState === 'rendering'" class="render-progress-area">
            <div class="progress-ring">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#333" stroke-width="6" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="#4a6cf7" stroke-width="6"
                  :stroke-dasharray="264"
                  :stroke-dashoffset="264 - (264 * renderProgress / 100)"
                  stroke-linecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div class="progress-text">{{ renderProgress }}%</div>
            </div>
            <p class="render-label">渲染中...</p>
            <button class="btn btn-outline btn-sm" @click="cancelRendering">取消渲染</button>
          </div>
          <div v-else-if="renderState === 'failed'" class="player-placeholder">
            <span>渲染失败</span>
            <span class="player-hint">{{ renderError }}</span>
            <button class="btn btn-primary btn-sm" style="margin-top: 12px" @click="startRender">重新渲染</button>
          </div>
          <div v-else class="player-placeholder">
            <span>视频预览区域</span>
            <span class="player-hint">点击右侧"开始渲染"生成视频</span>
          </div>
        </div>

        <!-- 时间轴 -->
        <div class="segment-timeline" v-if="segments.length > 0">
          <div class="timeline-header">
            <h4>分镜列表 ({{ totalDuration }}s)</h4>
            <span v-if="currentTime > 0" class="current-time">{{ currentTime.toFixed(1) }}s</span>
          </div>
          <div class="timeline-bar" ref="timelineBar" @click="onTimelineClick">
            <div
              v-for="(seg, idx) in segments"
              :key="seg.id"
              class="timeline-segment"
              :class="[seg.segment_type, { active: isSegmentActive(idx) }]"
              :style="{ width: segWidth(seg) + '%' }"
              :title="`${seg.segment_type === 'oral' ? '口播' : seg.segment_type === 'visual' ? '画面' : '转场'} ${seg.duration}s`"
            >
              <span class="seg-label">{{ seg.segment_type === 'oral' ? '口' : seg.segment_type === 'visual' ? '画' : '转' }}</span>
            </div>
            <div v-if="currentTime > 0 && videoUrl" class="playhead" :style="{ left: playheadPercent + '%' }" />
          </div>
          <div class="segment-cards">
            <div
              v-for="(seg, idx) in segments"
              :key="seg.id"
              class="segment-card"
              :class="{ active: isSegmentActive(idx) }"
              @click="jumpToSegment(idx)"
            >
              <div class="seg-index">{{ idx + 1 }}</div>
              <div class="seg-body">
                <div class="seg-header">
                  <span class="seg-tag" :class="seg.segment_type">{{ seg.segment_type === 'oral' ? '口播' : seg.segment_type === 'visual' ? '画面' : '转场' }}</span>
                  <span class="seg-duration">{{ seg.duration }}s</span>
                </div>
                <p class="seg-text" v-if="seg.segment_type === 'oral' && seg.oral_text">{{ seg.oral_text }}</p>
                <p class="seg-text" v-else-if="seg.visual_description">{{ seg.visual_description }}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="segment-timeline empty-segments" v-else>
          <p>暂无分镜数据</p>
          <button class="btn btn-primary" @click="goToStoryboard">去生成分镜</button>
        </div>
      </div>

      <!-- 侧边栏 -->
      <div class="preview-sidebar">
        <div class="panel">
          <h3>视频信息</h3>
          <div class="info-row"><span>分辨率</span><span>{{ resolution }}</span></div>
          <div class="info-row"><span>帧率</span><span>30fps</span></div>
          <div class="info-row"><span>格式</span><span>MP4</span></div>
          <div class="info-row" v-if="videoProduct"><span>状态</span><span :class="'status-' + videoProduct.status">{{ statusLabel(videoProduct.status) }}</span></div>
        </div>
        <div class="panel" v-if="materials.length > 0">
          <h3>关联素材 ({{ materials.length }})</h3>
          <div v-for="m in materials" :key="m.id" class="material-item">
            <span class="mat-type">{{ m.type }}</span>
            <span class="mat-name">{{ m.name }}</span>
          </div>
        </div>
        <div class="panel">
          <h3>操作</h3>
          <div class="action-buttons">
            <button
              class="btn btn-primary btn-full"
              @click="startRender"
              :disabled="renderState === 'rendering'"
            >
              {{ renderState === 'rendering' ? '渲染中...' : videoUrl ? '重新渲染' : '开始渲染' }}
            </button>
            <button class="btn btn-outline btn-full" @click="showDeriveDialog = true" :disabled="!videoUrl">派生其他平台</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 派生对话框 -->
    <div v-if="showDeriveDialog" class="modal-overlay" @click.self="showDeriveDialog = false">
      <div class="modal">
        <h3 class="modal-title">派生其他平台版本</h3>
        <div class="form-group">
          <label>目标平台</label>
          <select v-model="derivePlatform" class="input">
            <option value="douyin">抖音 (9:16)</option>
            <option value="weixin">微信视频号 (9:16)</option>
            <option value="image_text">图文版 (3:4)</option>
          </select>
        </div>
        <div class="form-group">
          <label>分辨率</label>
          <select v-model="deriveResolution" class="input">
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showDeriveDialog = false">取消</button>
          <button class="btn btn-primary" @click="handleDerive" :disabled="deriving">
            {{ deriving ? '派生中...' : '确认派生' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client'
import { toast } from '@/utils/toast'
import { renderVideo, getRenderStatus, cancelRender, deriveVideo } from '@/api/videoProducts'

const route = useRoute()
const router = useRouter()
const scriptId = ref((route.params.scriptId as string) || '')

interface Segment { id: number; segment_type: string; oral_text: string | null; visual_description: string; duration: number }
interface MaterialItem { id: string; name: string; type: string; thumbnail_url: string | null }
interface VideoProductInfo { id: string; status: string; platform: string; resolution: string; video_url: string | null; duration: number | null }

const segments = ref<Segment[]>([])
const materials = ref<MaterialItem[]>([])
const videoProduct = ref<VideoProductInfo | null>(null)
const videoUrl = ref('')
const videoEl = ref<HTMLVideoElement | null>(null)
const timelineBar = ref<HTMLElement | null>(null)
const currentTime = ref(0)
const renderState = ref<'idle' | 'rendering' | 'completed' | 'failed'>('idle')
const renderProgress = ref(0)
const renderError = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

const showDeriveDialog = ref(false)
const derivePlatform = ref('douyin')
const deriveResolution = ref('1080p')
const deriving = ref(false)

const totalDuration = computed(() => segments.value.reduce((sum, s) => sum + s.duration, 0))
const resolution = computed(() => videoProduct.value?.resolution ?? '1080x1920')

const playheadPercent = computed(() => {
  if (totalDuration.value === 0) return 0
  return (currentTime.value / totalDuration.value) * 100
})

function segWidth(seg: Segment): number {
  if (totalDuration.value === 0) return 0
  return (seg.duration / totalDuration.value) * 100
}

function isSegmentActive(idx: number): boolean {
  let elapsed = 0
  for (let i = 0; i < idx; i++) elapsed += segments.value[i].duration
  return currentTime.value >= elapsed && currentTime.value < elapsed + segments.value[idx].duration
}

function statusLabel(status: string): string {
  const map: Record<string, string> = { draft: '草稿', rendering: '渲染中', completed: '已完成', failed: '失败' }
  return map[status] ?? status
}

function onTimeUpdate(): void {
  currentTime.value = videoEl.value?.currentTime ?? 0
}

function jumpToSegment(idx: number): void {
  if (!videoEl.value) return
  let time = 0
  for (let i = 0; i < idx; i++) time += segments.value[i].duration
  videoEl.value.currentTime = time
}

function onTimelineClick(e: MouseEvent): void {
  if (!videoEl.value || !timelineBar.value) return
  const rect = timelineBar.value.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  videoEl.value.currentTime = percent * totalDuration.value
}

async function loadPreview(): Promise<void> {
  if (!scriptId.value) return
  try {
    const res = await api.get<{
      video_product: VideoProductInfo
      segments: Segment[]
      materials: MaterialItem[]
    }>(`/video-products/${scriptId.value}/preview`)
    videoProduct.value = res.video_product ?? null
    segments.value = res.segments ?? []
    materials.value = res.materials ?? []
    videoUrl.value = res.video_product?.video_url ?? ''
    renderState.value = res.video_product?.status === 'completed' ? 'completed'
      : res.video_product?.status === 'failed' ? 'failed'
      : res.video_product?.status === 'rendering' ? 'rendering'
      : 'idle'
    if (renderState.value === 'rendering') startPolling()
  } catch (e) { console.error(e); toast.error('加载预览数据失败') }
}

async function startRender(): Promise<void> {
  if (!videoProduct.value) {
    toast.warning('未找到视频产品，请先从脚本编辑器创建')
    return
  }
  try {
    renderState.value = 'rendering'
    renderProgress.value = 0
    await renderVideo(videoProduct.value.id)
    toast.success('渲染任务已提交')
    startPolling()
  } catch (e) {
    console.error(e)
    toast.error('渲染启动失败')
    renderState.value = 'idle'
  }
}

function startPolling(): void {
  stopPolling()
  pollTimer = setInterval(async () => {
    if (!videoProduct.value) return
    try {
      const res = await getRenderStatus(videoProduct.value.id)
      renderProgress.value = Math.round(res.progress)
      if (res.status === 'completed') {
        renderState.value = 'completed'
        stopPolling()
        await loadPreview()
        toast.success('渲染完成')
      } else if (res.status === 'failed') {
        renderState.value = 'failed'
        renderError.value = (res as any).error_message ?? '未知错误'
        stopPolling()
        toast.error('渲染失败')
      }
    } catch {
      stopPolling()
    }
  }, 2000)
}

function stopPolling(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function cancelRendering(): Promise<void> {
  if (!videoProduct.value) return
  try {
    await cancelRender(videoProduct.value.id)
    renderState.value = 'idle'
    renderProgress.value = 0
    stopPolling()
    toast.success('已取消渲染')
  } catch (e) { console.error(e); toast.error('取消失败') }
}

async function handleDerive(): Promise<void> {
  if (!videoProduct.value) return
  deriving.value = true
  try {
    await deriveVideo(videoProduct.value.id, { platform: derivePlatform.value, resolution: deriveResolution.value })
    toast.success('派生任务已提交')
    showDeriveDialog.value = false
  } catch (e) { console.error(e); toast.error('派生失败') }
  finally { deriving.value = false }
}

function goBackToEditor(): void { router.push(`/scripts/${scriptId.value}`) }
function goToStoryboard(): void { router.push(`/scripts/${scriptId.value}#storyboard`) }

onMounted(loadPreview)
onUnmounted(stopPolling)
</script>

<style scoped>
.preview-page { max-width: 1100px; margin: 0 auto; }
.title-bar { margin-bottom: var(--space-5); display: flex; align-items: center; justify-content: space-between; }
.title-bar h2 { margin: 0; font-size: var(--font-size-xl); color: var(--color-text); }
.btn-back { flex-shrink: 0; }
.btn { padding: var(--space-2) var(--space-5); border-radius: var(--radius); border: none; cursor: pointer; font-size: var(--font-size-base); font-weight: 500; }
.btn-sm { padding: var(--space-1) var(--space-3); font-size: var(--font-size-xs); }
.btn-primary { background: var(--color-primary); color: var(--color-bg); }
.btn-primary:hover { background: #3b5de6; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text); }
.btn-full { width: 100%; }
.preview-layout { display: flex; gap: var(--space-5); }
.preview-main { flex: 1; min-width: 0; }
.preview-sidebar { width: 280px; flex-shrink: 0; }

/* 播放器 */
.player-area {
  background: #000; border-radius: var(--radius-xl); min-height: 400px;
  display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-4);
  overflow: hidden; position: relative;
}
.preview-video {
  width: 100%; max-height: 560px; display: block; background: #000;
}

/* 渲染进度 */
.render-progress-area { text-align: center; color: var(--color-border); padding: var(--space-10); }
.progress-ring { position: relative; width: 120px; height: 120px; margin: 0 auto var(--space-4); }
.progress-ring svg { width: 100%; height: 100%; }
.progress-text {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-size: 24px; font-weight: 700; color: var(--color-bg);
}
.render-label { margin: 0 0 var(--space-3); font-size: var(--font-size-base); }

/* 占位符 */
.player-placeholder { text-align: center; color: var(--color-text-tertiary); padding: var(--space-5); }
.player-placeholder span:first-child { font-size: var(--font-size-lg); display: block; margin-bottom: var(--space-1); }
.player-hint { font-size: var(--font-size-xs); }

/* 时间轴 */
.segment-timeline { background: var(--color-bg); border: 1px solid var(--color-border-light); border-radius: var(--radius-xl); padding: var(--space-4); }
.timeline-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); }
.timeline-header h4 { margin: 0; font-size: var(--font-size-base); color: var(--color-text); }
.current-time { font-size: var(--font-size-xs); color: var(--color-primary); font-variant-numeric: tabular-nums; }
.timeline-bar {
  display: flex; height: 40px; border-radius: var(--radius); overflow: hidden;
  background: var(--color-bg-secondary); position: relative; cursor: pointer;
}
.timeline-segment {
  display: flex; align-items: center; justify-content: center; min-width: 20px;
  transition: opacity var(--transition-fast); opacity: 0.7;
}
.timeline-segment.active { opacity: 1; box-shadow: inset 0 -3px 0 rgba(0,0,0,0.2); }
.timeline-segment.oral { background: #e0e7ff; color: #4338ca; }
.timeline-segment.visual { background: #dcfce7; color: #16a34a; }
.timeline-segment.transition { background: #fef3c7; color: var(--color-warning); }
.seg-label { font-size: var(--font-size-xs); font-weight: 500; }
.playhead {
  position: absolute; top: 0; bottom: 0; width: 2px; background: #ff4444;
  z-index: 10; pointer-events: none; transition: left 0.1s linear;
}
.segment-cards { margin-top: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
.segment-card {
  display: flex; gap: var(--space-3); align-items: flex-start; padding: 10px var(--space-3);
  background: var(--color-bg-secondary); border-radius: var(--radius); border: 1px solid var(--color-border-light); cursor: pointer;
}
.segment-card:hover { background: #f5f5ff; }
.segment-card.active { background: #eef2ff; border-color: #c7d2fe; }
.seg-index {
  width: 28px; height: 28px; border-radius: 50%; background: var(--color-primary); color: var(--color-bg);
  display: flex; align-items: center; justify-content: center; font-size: var(--font-size-sm); font-weight: 700; flex-shrink: 0;
}
.seg-body { flex: 1; min-width: 0; }
.seg-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); }
.seg-tag { padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); font-size: var(--font-size-xs); font-weight: 600; }
.seg-tag.oral { background: #dbeafe; color: #2563eb; }
.seg-tag.visual { background: #dcfce7; color: #16a34a; }
.seg-tag.transition { background: #f3f4f6; color: #6b7280; }
.seg-duration { font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
.seg-text {
  margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

/* 侧边栏 */
.panel { background: var(--color-bg); border: 1px solid var(--color-border-light); border-radius: var(--radius-xl); padding: var(--space-4); margin-bottom: var(--space-4); }
.panel h3 { margin: 0 0 var(--space-3); font-size: var(--font-size-base); color: var(--color-text); }
.info-row { display: flex; justify-content: space-between; font-size: var(--font-size-sm); color: var(--color-text-secondary); padding: var(--space-1) 0; border-bottom: 1px solid var(--color-bg-secondary); }
.info-row:last-child { border-bottom: none; }
.status-completed { color: #16a34a; font-weight: 500; }
.status-rendering { color: var(--color-warning); font-weight: 500; }
.status-failed { color: var(--color-danger); font-weight: 500; }
.material-item { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) 0; font-size: var(--font-size-sm); }
.mat-type { padding: 1px 6px; border-radius: var(--radius); font-size: var(--font-size-xs); background: #f0f4ff; color: var(--color-primary); }
.mat-name { color: var(--color-text); }
.action-buttons { display: flex; flex-direction: column; gap: var(--space-2); }

/* 空状态 */
.empty-state { text-align: center; padding: 60px; color: var(--color-text-tertiary); background: var(--color-bg); border-radius: var(--radius-xl); }
.empty-segments { text-align: center; padding: var(--space-8) var(--space-4); }
.empty-segments p { color: var(--color-text-tertiary); margin: 0 0 var(--space-3); font-size: var(--font-size-base); }

/* 模态框 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: var(--color-bg); border-radius: var(--radius-lg); padding: var(--space-6); width: 400px; }
.modal-title { margin: 0 0 var(--space-5); font-size: var(--font-size-lg); font-weight: 600; }
.form-group { margin-bottom: var(--space-4); }
.form-group label { display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1); }
.input { width: 100%; padding: var(--space-2) 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: var(--font-size-sm); box-sizing: border-box; outline: none; }
.input:focus { border-color: var(--color-primary); }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-5); }
</style>
