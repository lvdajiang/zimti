<template>
  <div class="detail-page">
    <div class="title-bar">
      <button class="btn btn-sm" @click="$router.push('/viral-videos')">&larr; 返回列表</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="video" class="detail-layout">
      <div class="detail-left">
        <div class="video-player">
          <video v-if="video.video_url" :src="video.video_url" controls :poster="video.cover_url ?? undefined" class="player"></video>
          <div v-else class="player-placeholder">
            <img v-if="video.cover_url" :src="video.cover_url" :alt="video.title" />
            <div v-else class="no-video">暂无视频</div>
          </div>
        </div>
        <h2 class="video-title">{{ video.title }}</h2>
        <div class="video-meta">
          <span class="platform-badge" :class="video.platform">{{ video.platform_label }}</span>
          <span>{{ video.account_name }}</span>
          <span>{{ formatDate(video.published_at) }}</span>
          <span>{{ video.duration }}s</span>
        </div>
        <div class="stats-row">
          <div class="stat-item"><span class="stat-num">{{ formatNumber(video.play_count) }}</span><span>播放</span></div>
          <div class="stat-item"><span class="stat-num">{{ formatNumber(video.like_count) }}</span><span>点赞</span></div>
          <div class="stat-item"><span class="stat-num">{{ formatNumber(video.comment_count) }}</span><span>评论</span></div>
          <div class="stat-item"><span class="stat-num">{{ formatNumber(video.collect_count) }}</span><span>收藏</span></div>
          <div class="stat-item"><span class="stat-num">{{ formatNumber(video.share_count) }}</span><span>分享</span></div>
          <div class="stat-item"><span class="stat-num">{{ video.interaction_rate ? video.interaction_rate + '%' : '-' }}</span><span>互动率</span></div>
        </div>
      </div>

      <div class="detail-right">
        <div class="panel">
          <div class="panel-header">
            <h3>视频文案</h3>
            <div class="panel-actions">
              <button v-if="!video.transcript" class="btn-sm" @click="extractTranscript">提取文案</button>
              <button v-if="video.transcript" class="btn-sm" @click="copyTranscript">复制</button>
              <button v-if="video.transcript" class="btn-sm" @click="reExtractTranscript">重新提取</button>
              <button v-if="video.transcript" class="btn-sm" @click="editTranscript = !editTranscript">
                {{ editTranscript ? '取消编辑' : '编辑' }}
              </button>
            </div>
          </div>
          <div v-if="video.transcript" class="transcript-content">
            <textarea v-if="editTranscript" v-model="transcriptText" class="transcript-edit"></textarea>
            <p v-else class="transcript-text">{{ video.transcript }}</p>
            <button v-if="editTranscript" class="btn btn-primary btn-sm" @click="saveTranscript" style="margin-top:8px">保存</button>
          </div>
          <div v-else class="empty-panel">暂无文案，点击"提取文案"获取</div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <h3>AI 分析</h3>
            <button v-if="!video.analysis" class="btn-sm" @click="runAnalysis">开始分析</button>
          </div>
          <div v-if="video.analysis" class="analysis-content">
            <pre>{{ JSON.stringify(video.analysis, null, 2) }}</pre>
          </div>
          <div v-else class="empty-panel">暂无分析结果</div>
        </div>

        <div class="action-bar">
          <button class="btn btn-outline" @click="markAsBenchmark">用作对标</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api/client'
import { toast } from '@/utils/toast'
import { formatNumber, formatDate } from '@/utils/format'

const route = useRoute()
const videoId = computed(() => route.params.id as string)

interface VideoDetail {
  id: number; title: string; platform: string; platform_label: string; account_name: string
  cover_url: string | null; video_url: string | null; duration: number
  play_count: number; like_count: number; comment_count: number; collect_count: number; share_count: number
  interaction_rate: number | null; transcript: string | null; analysis: unknown
  published_at: string; collected_at: string; has_transcript: boolean; has_analysis: boolean
}

const video = ref<VideoDetail | null>(null)
const loading = ref(false)
const editTranscript = ref(false)
const transcriptText = ref('')

async function loadVideo(): Promise<void> {
  loading.value = true
  try {
    video.value = await api.get<VideoDetail>(`/viral-videos/${videoId.value}`)
    transcriptText.value = video.value.transcript ?? ''
    editTranscript.value = false
  } catch (e) { console.error(e); toast.error('加载视频详情失败') }
  finally { loading.value = false }
}

async function extractTranscript(): Promise<void> {
  try {
    await api.post(`/viral-videos/${videoId.value}/transcript/extract`)
    toast.success('文案提取任务已提交')
  } catch (e) { console.error(e); toast.error('提取文案失败') }
}

async function saveTranscript(): Promise<void> {
  try {
    await api.put(`/viral-videos/${videoId.value}/transcript`, { transcript: transcriptText.value })
    editTranscript.value = false
    await loadVideo()
  } catch (e) { console.error(e); toast.error('保存失败') }
}

async function runAnalysis(): Promise<void> {
  try {
    await api.post(`/viral-videos/${videoId.value}/analyze`)
    toast.success('分析任务已提交')
  } catch (e) { console.error(e); toast.error('操作失败') }
}

async function copyTranscript(): Promise<void> {
  const text = video.value?.transcript ?? transcriptText.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  } catch {
    toast.error('复制失败')
  }
}

async function reExtractTranscript(): Promise<void> {
  try {
    await api.post(`/viral-videos/${videoId.value}/transcript/extract`)
    toast.success('重新提取任务已提交')
  } catch (e) { console.error(e); toast.error('提取文案失败') }
}

function markAsBenchmark(): void {
  toast.info('已标记为对标视频')
}

watch(videoId, loadVideo)
onMounted(loadVideo)
</script>

<style scoped>
.detail-page { max-width: 1100px; margin: 0 auto; }
.title-bar { margin-bottom: 16px; }
.btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-primary { background: #4a6cf7; color: #fff; }
.btn-sm { padding: 4px 12px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 12px; }
.detail-layout { display: flex; gap: 20px; }
.detail-left { flex: 1; min-width: 0; }
.detail-right { width: 360px; flex-shrink: 0; }
.video-player { border-radius: 10px; overflow: hidden; background: #000; margin-bottom: 16px; }
.player { width: 100%; max-height: 500px; }
.player-placeholder { display: flex; align-items: center; justify-content: center; min-height: 300px; background: #f5f5f5; }
.player-placeholder img { max-width: 100%; max-height: 500px; object-fit: contain; }
.no-video { color: #999; font-size: 14px; }
.video-title { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #1a1a2e; }
.video-meta { display: flex; gap: 12px; align-items: center; font-size: 13px; color: #999; margin-bottom: 16px; flex-wrap: wrap; }
.platform-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.platform-badge.xiaohongshu { background: #ffe0e6; color: #e53935; }
.platform-badge.douyin { background: #e8f5e9; color: #2e7d32; }
.platform-badge.weixin { background: #e3f2fd; color: #1565c0; }
.stats-row { display: flex; gap: 16px; background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 16px; }
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stat-num { font-size: 18px; font-weight: 700; color: #1a1a2e; }
.stat-item span:last-child { font-size: 12px; color: #999; }
.panel { background: #fff; border: 1px solid #eee; border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
.panel-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; }
.panel-header h3 { margin: 0; font-size: 14px; color: #333; }
.panel-actions { display: flex; gap: 6px; }
.transcript-content { padding: 16px; }
.transcript-text { margin: 0; font-size: 14px; line-height: 1.8; color: #333; white-space: pre-wrap; }
.transcript-edit { width: 100%; min-height: 200px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; line-height: 1.8; resize: vertical; font-family: inherit; box-sizing: border-box; }
.analysis-content { padding: 16px; }
.analysis-content pre { margin: 0; font-size: 12px; line-height: 1.6; overflow-x: auto; white-space: pre-wrap; }
.empty-panel { padding: 40px 16px; text-align: center; color: #999; font-size: 13px; }
.loading { text-align: center; padding: 60px; color: #999; }
.action-bar { display: flex; justify-content: center; padding: 12px 0; }
.btn-outline { padding: 8px 20px; border-radius: 6px; border: 1px solid #4a6cf7; background: #fff; color: #4a6cf7; cursor: pointer; font-size: 14px; font-weight: 500; }
</style>
