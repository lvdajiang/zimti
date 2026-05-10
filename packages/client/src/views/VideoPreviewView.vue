<template>
  <div class="preview-page">
    <div class="title-bar">
      <h2>视频预览与渲染</h2>
      <button v-if="videoId" class="btn btn-outline btn-back" @click="goBackToEditor">返回编辑</button>
    </div>
    <div v-if="!videoId" class="empty-state">
      <p>请从脚本编辑器或内容库进入视频预览</p>
    </div>
    <div v-else class="preview-layout">
      <div class="preview-main">
        <div class="player-area">
          <div class="player-placeholder">
            <span>视频预览区域</span>
            <span class="player-hint">Remotion 渲染集成后显示预览</span>
          </div>
        </div>
        <div class="segment-timeline" v-if="segments.length > 0">
          <h4>分镜列表 ({{ totalDuration }}s)</h4>
          <div class="timeline-bar">
            <div v-for="seg in segments" :key="seg.id" class="timeline-segment" :class="seg.segment_type" :style="{ width: segWidth(seg) + '%' }">
              <span class="seg-label">{{ seg.segment_type === 'oral' ? '口播' : seg.segment_type === 'visual' ? '画面' : '转场' }}</span>
            </div>
          </div>
          <div class="segment-cards">
            <div v-for="(seg, idx) in segments" :key="seg.id" class="segment-card">
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
        <div class="segment-timeline empty-segments" v-else-if="videoId">
          <p>暂无分镜数据</p>
          <button class="btn btn-primary" @click="goToStoryboard">去生成分镜</button>
        </div>
      </div>
      <div class="preview-sidebar">
        <div class="panel">
          <h3>视频信息</h3>
          <div class="info-row"><span>分辨率</span><span>1080x1920</span></div>
          <div class="info-row"><span>帧率</span><span>30fps</span></div>
          <div class="info-row"><span>格式</span><span>MP4</span></div>
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
            <button class="btn btn-primary btn-full" @click="startRender" :disabled="rendering">
              {{ rendering ? '渲染中...' : '开始渲染' }}
            </button>
            <button class="btn btn-outline btn-full" @click="deriveVideo">派生其他平台</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client'
import { toast } from '@/utils/toast'

const route = useRoute()
const router = useRouter()
const videoId = ref((route.params.scriptId as string) || '')

interface Segment { id: number; segment_type: string; oral_text: string | null; visual_description: string; duration: number }
interface MaterialItem { id: string; name: string; type: string; thumbnail_url: string | null }

const segments = ref<Segment[]>([])
const materials = ref<MaterialItem[]>([])
const rendering = ref(false)

const totalDuration = ref(0)

function segWidth(seg: Segment): number {
  if (totalDuration.value === 0) return 0
  return (seg.duration / totalDuration.value) * 100
}

async function loadPreview(): Promise<void> {
  if (!videoId.value) return
  try {
    const res = await api.get<{
      segments: Segment[]; materials: MaterialItem[]; duration: number
    }>(`/video-products/${videoId.value}/preview`)
    segments.value = res.segments ?? []
    materials.value = res.materials ?? []
    totalDuration.value = segments.value.reduce((sum, s) => sum + s.duration, 0)
  } catch (e) { console.error(e); toast.error('加载预览数据失败') }
}

async function startRender(): Promise<void> {
  if (!videoId.value) return
  rendering.value = true
  try {
    await api.post<{ task_id: string }>('/video-products/render', { video_product_id: videoId.value })
    toast.success('渲染任务已提交')
  } catch (e) { console.error(e); toast.error('渲染启动失败') }
  finally { rendering.value = false }
}

async function deriveVideo(): Promise<void> {
  toast.info('派生功能需要 Remotion 渲染服务集成后可用')
}

function goBackToEditor(): void {
  if (videoId.value) {
    router.push(`/scripts/${videoId.value}`)
  }
}

function goToStoryboard(): void {
  if (videoId.value) {
    router.push(`/scripts/${videoId.value}#storyboard`)
  }
}

onMounted(loadPreview)
</script>

<style scoped>
.preview-page { max-width: 1100px; margin: 0 auto; }
.title-bar { margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; }
.title-bar h2 { margin: 0; font-size: 22px; color: #1a1a2e; }
.btn-back { flex-shrink: 0; }
.btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-primary { background: #4a6cf7; color: #fff; }
.btn-outline { background: #fff; border: 1px solid #ddd; color: #333; }
.btn-full { width: 100%; }
.preview-layout { display: flex; gap: 20px; }
.preview-main { flex: 1; min-width: 0; }
.preview-sidebar { width: 280px; flex-shrink: 0; }
.player-area { background: #000; border-radius: 10px; min-height: 400px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.player-placeholder { text-align: center; color: #999; }
.player-placeholder span:first-child { font-size: 16px; display: block; margin-bottom: 4px; }
.player-hint { font-size: 12px; }
.segment-timeline { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 16px; }
.segment-timeline h4 { margin: 0 0 12px; font-size: 14px; color: #333; }
.timeline-bar { display: flex; height: 40px; border-radius: 6px; overflow: hidden; background: #f5f5f5; }
.timeline-segment { display: flex; align-items: center; justify-content: center; min-width: 20px; }
.timeline-segment.oral { background: #e0e7ff; color: #4338ca; }
.timeline-segment.visual { background: #dcfce7; color: #16a34a; }
.timeline-segment.transition { background: #fef3c7; color: #d97706; }
.seg-label { font-size: 11px; font-weight: 500; }
.panel { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.panel h3 { margin: 0 0 12px; font-size: 14px; color: #333; }
.info-row { display: flex; justify-content: space-between; font-size: 13px; color: #666; padding: 4px 0; border-bottom: 1px solid #f5f5f5; }
.info-row:last-child { border-bottom: none; }
.material-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; }
.mat-type { padding: 1px 6px; border-radius: 8px; font-size: 11px; background: #f0f4ff; color: #4a6cf7; }
.mat-name { color: #333; }
.action-buttons { display: flex; flex-direction: column; gap: 8px; }
.empty-state { text-align: center; padding: 60px; color: #999; background: #fff; border-radius: 10px; }
.segment-cards { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.segment-card { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; background: #fafafa; border-radius: 8px; border: 1px solid #eee; }
.segment-card:hover { background: #f5f5ff; }
.seg-index { width: 28px; height: 28px; border-radius: 50%; background: #4a6cf7; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
.seg-body { flex: 1; min-width: 0; }
.seg-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.seg-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.seg-tag.oral { background: #dbeafe; color: #2563eb; }
.seg-tag.visual { background: #dcfce7; color: #16a34a; }
.seg-tag.transition { background: #f3f4f6; color: #6b7280; }
.seg-duration { font-size: 12px; color: #999; font-variant-numeric: tabular-nums; }
.seg-text { margin: 0; font-size: 13px; color: #555; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.empty-segments { text-align: center; padding: 32px 16px; }
.empty-segments p { color: #999; margin: 0 0 12px; font-size: 14px; }
</style>
