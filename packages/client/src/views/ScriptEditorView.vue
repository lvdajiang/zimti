<template>
  <div class="editor-page">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <button class="btn btn-sm" @click="$router.push('/')">&larr; 返回</button>
        <span class="script-title">{{ store.fullText?.slice(0, 30) ?? '新脚本' }}...</span>
        <span class="script-status" :class="store.status">{{ store.status === 'confirmed' ? '已确认' : '草稿' }}</span>
        <HelpTip title="脚本编辑器使用指引" :steps="[
          '顶部选择视频类型和口语比例，系统自动估算时长',
          '分段区域可拖拽排序，每段可设置类型（口语/画面/转场）和时长',
          '「AI 检查」自动分析脚本质量并给出优化建议',
          '「生成分镜」根据脚本内容自动生成视觉描述',
          '脚本确认后可在视频预览页生成和渲染视频',
        ]" />
      </div>
      <div class="toolbar-center">
        <div class="toolbar-field">
          <label>视频类型</label>
          <select v-model="store.videoType" class="field-select" @change="store.markUnsaved(); debouncedSave()">
            <option value="knowledge">知识讲解</option>
            <option value="story">故事型</option>
            <option value="list">盘点型</option>
            <option value="contrast">对比型</option>
          </select>
        </div>
        <div class="toolbar-field">
          <label>口语比例</label>
          <div class="oral-ratio-bar">
            <div class="ratio-fill" :style="{ width: (store.oralRatio * 100) + '%' }"></div>
            <span>{{ Math.round(store.oralRatio * 100) }}%</span>
          </div>
        </div>
        <div class="toolbar-field">
          <label>预估时长</label>
          <span class="duration">{{ store.estimatedDuration }}s</span>
        </div>
        <span class="save-indicator" :class="store.saveStatus">
          {{ saveStatusLabel }}
        </span>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-sm btn-purple" @click="runAiCheck" :disabled="aiChecking">AI 检查</button>
        <button class="btn btn-sm" @click="generateStoryboard" :disabled="generating">
          {{ generating ? '生成中...' : '生成分镜' }}
        </button>
        <button class="btn btn-sm btn-primary" @click="confirmScript">确认脚本</button>
      </div>
    </div>

    <div class="editor-body" v-if="store.isLoaded">
      <div class="editor-left">
        <div class="panel-header">
          <h3>脚本内容</h3>
          <span class="char-count">{{ store.fullText.length }} 字</span>
        </div>
        <textarea v-model="store.fullText" class="script-textarea" placeholder="在此输入脚本内容..." @input="onTextInput"></textarea>

        <div v-if="store.aiResult" class="ai-panel">
          <div class="panel-header">
            <h3>AI 风味检查</h3>
            <button class="btn-link" @click="store.aiResult = null">关闭</button>
          </div>
          <div class="ai-score" :class="aiScoreClass">
            <span class="score-num">{{ store.aiResult.score }}</span>
            <span class="score-label">/ 100</span>
          </div>
          <div class="ai-issues">
            <div v-for="(issue, i) in store.aiResult.issues" :key="i" class="ai-issue" :class="issue.type">
              <span class="issue-icon">{{ issue.type === 'warning' ? '!' : 'i' }}</span>
              <span>{{ issue.message }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="editor-right">
        <div class="panel-header">
          <h3>分镜片段 ({{ store.segments.length }})</h3>
          <button class="btn-sm" @click="handleAddSegment">+ 添加片段</button>
        </div>
        <div class="segments-list">
          <div v-if="store.segments.length === 0" class="empty-segments">
            <p>暂无分镜片段</p>
            <button class="btn-sm" @click="generateStoryboard">AI 生成分镜</button>
          </div>
          <div
            v-for="(seg, i) in store.segments"
            :key="seg.id"
            class="segment-card"
            :class="[seg.segment_type, { dragging: dragState.draggingIndex === i, 'drag-over': dragState.dragOverIndex === i }]"
            draggable="true"
            @dragstart="onDragStart(i, $event)"
            @dragover="onDragOver(i, $event)"
            @drop="onDrop(i)"
            @dragend="onDragEnd"
          >
            <div class="segment-header">
              <span class="seg-index">#{{ i + 1 }}</span>
              <select v-model="seg.segment_type" class="seg-type-select" @change="store.updateSegment(seg)">
                <option value="oral">口播</option>
                <option value="visual">画面</option>
                <option value="transition">转场</option>
              </select>
              <span class="seg-duration">{{ seg.duration }}s</span>
              <button class="seg-action" title="复制片段" @click="handleDuplicate(seg.id)">&#x2398;</button>
              <button class="seg-del" @click="store.removeSegment(seg.id)">&times;</button>
            </div>
            <div class="segment-body">
              <textarea v-if="seg.segment_type === 'oral'" v-model="seg.oral_text" class="seg-textarea" placeholder="口播文案..." @blur="store.updateSegment(seg)"></textarea>
              <textarea v-model="seg.visual_description" class="seg-textarea" :placeholder="seg.segment_type === 'transition' ? '转场描述...' : '画面描述...'" @blur="store.updateSegment(seg)"></textarea>
            </div>
            <div v-if="seg.material_ids && seg.material_ids.length > 0" class="segment-materials">
              <span v-for="mid in seg.material_ids" :key="mid" class="mat-badge">素材 {{ mid.slice(0, 8) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="loading">加载中...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import HelpTip from '@/components/HelpTip.vue'
import { useRoute, onBeforeRouteLeave } from 'vue-router'
import { useScriptStore } from '@/stores/script'
import { runAiCheck as apiAiCheck, generateStoryboard as apiGenStoryboard } from '@/api/script'
import { toast } from '@/utils/toast'

const store = useScriptStore()
const route = useRoute()
const scriptId = computed(() => Number(route.params.id) || 0)

const aiChecking = ref(false)
const generating = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let autoSaveTimer: ReturnType<typeof setInterval> | null = null
let unmounted = false

const dragState = ref<{ draggingIndex: number | null; dragOverIndex: number | null }>({
  draggingIndex: null, dragOverIndex: null,
})

const aiScoreClass = computed(() => {
  if (!store.aiResult) return ''
  if (store.aiResult.score >= 80) return 'good'
  if (store.aiResult.score >= 60) return 'warn'
  return 'bad'
})

const saveStatusLabel = computed(() => {
  const map: Record<string, string> = { saved: '已保存', saving: '保存中...', unsaved: '未保存', error: '保存失败' }
  return map[store.saveStatus] ?? ''
})

function onTextInput(): void {
  store.markUnsaved()
  debouncedSave()
}

function debouncedSave(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => store.save(), 1000)
}

function startAutoSave(): void {
  stopAutoSave()
  autoSaveTimer = setInterval(() => {
    if (store.hasUnsavedChanges && store.isReady) store.save()
  }, 30000)
}

function stopAutoSave(): void {
  if (autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null }
}

// ─── 拖拽排序 ───

function onDragStart(index: number, event: DragEvent): void {
  dragState.value.draggingIndex = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragState.value.dragOverIndex = index
}

function onDrop(targetIndex: number): void {
  const fromIndex = dragState.value.draggingIndex
  if (fromIndex === null || fromIndex === targetIndex) { onDragEnd(); return }
  const reordered = [...store.segments]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(targetIndex, 0, moved)
  const newOrder = reordered.map(s => s.id)
  store.segments = reordered
  store.reorder(newOrder)
  onDragEnd()
}

function onDragEnd(): void {
  dragState.value = { draggingIndex: null, dragOverIndex: null }
}

// ─── 操作 ───

async function handleAddSegment(): Promise<void> {
  const seg = await store.addNewSegment({ segment_type: 'oral', visual_description: '', duration: 3.0 })
  if (seg) toast.success('已添加片段')
  else toast.error('添加分镜失败')
}

async function handleDuplicate(segmentId: number): Promise<void> {
  const seg = await store.duplicate(segmentId)
  if (seg) toast.success('已复制片段')
  else toast.error('复制失败')
}

async function runAiCheck(): Promise<void> {
  if (!store.isReady || !store.fullText.trim()) { toast.warning('请先输入脚本内容'); return }
  aiChecking.value = true
  try {
    store.aiResult = await apiAiCheck(store.scriptId)
  } catch (e) { console.error(e); toast.error('AI检查失败') }
  finally { aiChecking.value = false }
}

async function generateStoryboard(): Promise<void> {
  if (!store.isReady || !store.fullText.trim()) { toast.warning('请先输入脚本内容'); return }
  generating.value = true
  try {
    const res = await apiGenStoryboard(store.scriptId)
    const poll = async () => {
      if (unmounted) return
      try {
        const { getStoryboardStatus } = await import('@/api/script')
        const st = await getStoryboardStatus(store.scriptId, res.task_id)
        if (st.status === 'completed') { generating.value = false; await store.load(store.scriptId); return }
        if (st.status === 'failed') { generating.value = false; toast.error('分镜生成失败，请重试'); return }
        setTimeout(poll, 2000)
      } catch (e) { console.error(e); generating.value = false; toast.error('查询生成状态失败') }
    }
    setTimeout(poll, 2000)
  } catch (e) { console.error(e); generating.value = false; toast.error('生成分镜失败') }
}

async function confirmScript(): Promise<void> {
  if (!store.isReady) return
  const { confirmScript: apiConfirm } = await import('@/api/script')
  try {
    await apiConfirm(store.scriptId)
    store.status = 'confirmed'
    toast.success('脚本已确认，可以进入视频制作')
  } catch (e) { console.error(e); toast.error('确认失败') }
}

// ─── 创建空白脚本 ───

async function createBlankScript(): Promise<void> {
  try {
    const { createScript } = await import('@/api/script')
    const api = (await import('@/api/client')).default
    const taskRes = await api.post<{ id: string }>('/tasks', {
      title: '新脚本任务', platform: 'xiaohongshu',
    })
    const topicRes = await api.post<{ id: number }>('/topic-proposals', {
      task_id: taskRes.id, title: '新脚本', hook: '', main_points: [], visual_description: '',
    })
    const scriptRes = await createScript({ task_id: taskRes.id, topic_id: topicRes.id, full_text: '' })
    store.scriptId = scriptRes.id
    store.fullText = ''
    store.videoType = 'knowledge'
    store.oralRatio = 0.6
    store.status = 'draft'
    store.segments = []
    store.isLoaded = true
  } catch (e) {
    console.error('Failed to create script:', e)
    toast.warning('创建脚本失败，使用空白脚本')
    store.scriptId = 0
    store.fullText = ''
    store.videoType = 'knowledge'
    store.oralRatio = 0.6
    store.status = 'draft'
    store.segments = []
    store.isLoaded = true
  }
}

// ─── 离开确认 ───

function handleBeforeUnload(e: BeforeUnloadEvent): void {
  if (store.hasUnsavedChanges) { e.preventDefault(); e.returnValue = '' }
}

onBeforeRouteLeave(() => {
  if (store.hasUnsavedChanges) {
    stopAutoSave()
    return window.confirm('有未保存的更改，确定要离开吗？')
  }
  return true
})

// ─── 生命周期 ───

onMounted(async () => {
  const id = scriptId.value
  if (id > 0) {
    const ok = await store.load(id)
    if (!ok) {
      toast.warning('加载脚本失败，已创建空白脚本')
      await createBlankScript()
    }
  } else {
    await createBlankScript()
  }
  startAutoSave()
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  unmounted = true
  stopAutoSave()
  if (debounceTimer) clearTimeout(debounceTimer)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (store.hasUnsavedChanges && store.isReady) store.save()
})
</script>

<style scoped>
.editor-page { display: flex; flex-direction: column; height: 100vh; background: var(--color-bg-secondary); }
.editor-toolbar { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-4); background: var(--color-bg); border-bottom: 1px solid var(--color-border-light); flex-wrap: wrap; gap: var(--space-2); }
.toolbar-left, .toolbar-center, .toolbar-right { display: flex; align-items: center; gap: var(--space-3); }
.script-title { font-size: var(--font-size-base); font-weight: 500; color: var(--color-text); }
.script-status { padding: 2px var(--space-2); border-radius: 10px; font-size: var(--font-size-xs); }
.script-status.draft { background: var(--color-bg-secondary); color: var(--color-text-tertiary); }
.script-status.confirmed { background: #dcfce7; color: var(--color-success); }
.toolbar-field { display: flex; align-items: center; gap: 6px; }
.toolbar-field label { font-size: var(--font-size-xs); color: var(--color-text-tertiary); white-space: nowrap; }
.field-select { padding: var(--space-1) var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-xs); background: var(--color-bg); }
.oral-ratio-bar { width: 80px; height: 6px; background: var(--color-border-light); border-radius: 3px; position: relative; overflow: hidden; }
.ratio-fill { height: 100%; background: var(--color-primary); border-radius: 3px; }
.oral-ratio-bar span { position: absolute; right: -30px; top: -2px; font-size: var(--font-size-xs); color: var(--color-text-secondary); }
.duration { font-size: var(--font-size-sm); font-weight: 500; color: var(--color-text); }
.save-indicator { font-size: var(--font-size-xs); padding: 2px var(--space-2); border-radius: 10px; }
.save-indicator.saved { color: var(--color-success); }
.save-indicator.saving { color: var(--color-text-tertiary); }
.save-indicator.unsaved { color: var(--color-warning); background: #fffbeb; }
.save-indicator.error { color: var(--color-danger); background: #fef2f2; }
.btn { padding: var(--space-2) var(--space-5); border-radius: var(--radius); border: none; cursor: pointer; font-size: var(--font-size-base); font-weight: 500; }
.btn-sm { padding: var(--space-1) var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--color-border); background: var(--color-bg); cursor: pointer; font-size: var(--font-size-xs); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: var(--color-bg); }
.btn-sm.btn-primary { border: none; }
.btn-purple { background: #9333ea; color: var(--color-bg); }
.btn-sm.btn-purple { border: none; color: var(--color-bg); }
.btn-link { background: none; border: none; cursor: pointer; font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.editor-body { display: flex; flex: 1; overflow: hidden; }
.editor-left { flex: 1; display: flex; flex-direction: column; border-right: 1px solid var(--color-border-light); overflow: hidden; }
.editor-right { width: 400px; display: flex; flex-direction: column; overflow: hidden; }
.panel-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border-light); background: var(--color-bg); }
.panel-header h3 { margin: 0; font-size: var(--font-size-base); color: var(--color-text); }
.char-count { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.script-textarea { flex: 1; padding: var(--space-4); border: none; outline: none; font-size: var(--font-size-md); line-height: 1.8; resize: none; font-family: inherit; }
.ai-panel { border-top: 1px solid var(--color-border-light); background: var(--color-bg); max-height: 300px; overflow-y: auto; }
.ai-score { display: flex; align-items: baseline; gap: var(--space-1); padding: var(--space-3) var(--space-4); font-size: var(--font-size-base); }
.ai-score.good .score-num { color: var(--color-success); }
.ai-score.warn .score-num { color: var(--color-warning); }
.ai-score.bad .score-num { color: var(--color-danger); }
.score-num { font-size: 28px; font-weight: 700; }
.score-label { color: var(--color-text-tertiary); }
.ai-issues { padding: 0 var(--space-4) var(--space-3); display: flex; flex-direction: column; gap: 6px; }
.ai-issue { display: flex; align-items: flex-start; gap: var(--space-2); padding: var(--space-2) 10px; border-radius: var(--radius); font-size: var(--font-size-sm); }
.ai-issue.warning { background: #fffbeb; color: #92400e; }
.ai-issue.info { background: #f0f9ff; color: #075985; }
.issue-icon { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: var(--font-size-xs); font-weight: 700; flex-shrink: 0; }
.ai-issue.warning .issue-icon { background: #fbbf24; color: var(--color-bg); }
.ai-issue.info .issue-icon { background: #38bdf8; color: var(--color-bg); }
.segments-list { flex: 1; overflow-y: auto; padding: var(--space-3); }
.empty-segments { text-align: center; padding: var(--space-10); color: var(--color-text-tertiary); }
.empty-segments p { margin-bottom: var(--space-3); }
.segment-card { background: var(--color-bg); border: 1px solid var(--color-border-light); border-radius: var(--radius); margin-bottom: var(--space-2); overflow: hidden; cursor: grab; }
.segment-card:active { cursor: grabbing; }
.segment-card.oral { border-left: 3px solid var(--color-primary); }
.segment-card.visual { border-left: 3px solid #22c55e; }
.segment-card.transition { border-left: 3px solid var(--color-warning); }
.segment-card.dragging { opacity: 0.4; }
.segment-card.drag-over { border-top: 3px solid var(--color-primary); }
.segment-header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-light); }
.seg-index { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-tertiary); }
.seg-type-select { padding: 2px 6px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-xs); }
.seg-duration { font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-left: auto; }
.seg-action { background: none; border: none; cursor: pointer; font-size: var(--font-size-base); color: var(--color-text-tertiary); padding: 0 var(--space-1); }
.seg-action:hover { color: var(--color-primary); }
.seg-del { background: none; border: none; font-size: var(--font-size-lg); cursor: pointer; color: var(--color-border); padding: 0 var(--space-1); }
.seg-del:hover { color: var(--color-danger); }
.segment-body { padding: 0; }
.seg-textarea { width: 100%; padding: var(--space-2) var(--space-3); border: none; outline: none; font-size: var(--font-size-sm); line-height: 1.6; resize: none; font-family: inherit; min-height: 50px; }
.segment-materials { padding: var(--space-1) var(--space-3) var(--space-2); display: flex; gap: var(--space-1); flex-wrap: wrap; }
.mat-badge { padding: 2px 6px; border-radius: var(--radius); background: #f0f4ff; color: var(--color-primary); font-size: 10px; }
.loading { text-align: center; padding: 60px; color: var(--color-text-tertiary); }
</style>
