<template>
  <div class="script-panel">
    <div class="panel-grid">
      <!-- 左侧：脚本编辑 -->
      <div class="editor-section">
        <div class="section-header">
          <h3>脚本编辑</h3>
          <div class="char-count">{{ charCount }} 字 · 预估 {{ estimatedDuration }}s</div>
        </div>
        <textarea
          v-model="store.fullText"
          class="script-textarea"
          placeholder="在这里编写或粘贴你的视频脚本...&#10;&#10;提示：口语化表达效果更好，每段控制在 3-5 句。"
          @input="handleInput"
        />
      </div>

      <!-- 右侧：配置 + 操作 -->
      <div class="config-section">
        <div class="config-card">
          <h4>视频设置</h4>
          <div class="form-group">
            <label>视频类型</label>
            <select v-model="store.videoType" class="input">
              <option value="knowledge">知识科普</option>
              <option value="story">故事叙述</option>
              <option value="list">清单列举</option>
              <option value="contrast">对比评测</option>
            </select>
          </div>
          <div class="form-group">
            <label>口语比例: {{ Math.round(store.oralRatio * 100) }}%</label>
            <input
              type="range"
              :value="store.oralRatio"
              min="0.3"
              max="1"
              step="0.05"
              class="range-input"
              @input="store.oralRatio = Number(($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <div class="config-card">
          <h4>AI 共振分镜</h4>
          <p class="hint-text">AI 将编排四通道总谱：口播 + 画面 + 音乐 + 节奏</p>
          <button
            class="btn btn-primary btn-block"
            :disabled="!store.fullText.trim() || store.executing"
            @click="handleGenerateStoryboard"
          >
            <template v-if="store.executing">生成中...</template>
            <template v-else-if="segmentCount > 0">重新生成分镜 ({{ segmentCount }})</template>
            <template v-else>AI 生成共振分镜</template>
          </button>
        </div>

        <!-- 共振分镜卡片 -->
        <div v-if="segmentCount > 0" ref="storyboardSectionRef" class="config-card storyboard-cards" :class="{ 'focus-highlight': props.focusMode === 'storyboard' }">
          <h4>分镜总谱 ({{ segmentCount }})</h4>
          <div class="segment-list">
            <div
              v-for="(seg, i) in segmentList"
              :key="seg.id"
              class="segment-card"
              :class="{ 'has-resonance': seg.music_mood || seg.rhythm_instruction, 'expanded': expandedId === seg.id }"
              @click="toggleExpand(seg.id)"
            >
              <div class="seg-header">
                <span class="seg-index">{{ i + 1 }}</span>
                <span class="seg-type" :class="seg.segment_type">{{ typeLabel(seg.segment_type) }}</span>
                <span class="seg-duration">{{ seg.duration }}s</span>
              </div>
              <div class="seg-body">{{ seg.oral_text || seg.visual_description || '—' }}</div>

              <!-- 共振指令区（仅有数据时显示） -->
              <div v-if="seg.music_mood || seg.rhythm_instruction" class="seg-resonance">
                <span v-if="seg.music_mood" class="resonance-tag music">🎵 {{ musicMoodLabel(seg.music_mood) }}</span>
                <span v-if="seg.rhythm_instruction" class="resonance-tag rhythm">🎬 {{ rhythmLabel(seg.rhythm_instruction) }}</span>
                <span v-if="seg.emotion" class="resonance-tag emotion">💫 {{ seg.emotion }}</span>
              </div>
              <div v-if="seg.resonance_goal" class="seg-goal">🎯 {{ seg.resonance_goal }}</div>
              <div v-if="seg.sfx_note" class="seg-sfx">🔊 {{ seg.sfx_note }}</div>

              <!-- 展开编辑（ResonanceEditor 内联） -->
              <div v-if="expandedId === seg.id" class="seg-editor" @click.stop>
                <div class="editor-row">
                  <label>音乐情绪</label>
                  <select :value="seg.music_mood ?? ''" class="input input-sm" @change="updateField(seg.id, 'music_mood', ($event.target as HTMLSelectElement).value || null)">
                    <option value="">未设置</option>
                    <option v-for="(lbl, key) in MUSIC_MOOD_LABELS" :key="key" :value="key">{{ lbl }}</option>
                  </select>
                </div>
                <div class="editor-row">
                  <label>节奏指令</label>
                  <select :value="seg.rhythm_instruction ?? ''" class="input input-sm" @change="updateField(seg.id, 'rhythm_instruction', ($event.target as HTMLSelectElement).value || null)">
                    <option value="">未设置</option>
                    <option v-for="(lbl, key) in RHYTHM_LABELS" :key="key" :value="key">{{ lbl }}</option>
                  </select>
                </div>
                <div class="editor-row">
                  <label>共振目标</label>
                  <input :value="seg.resonance_goal ?? ''" class="input input-sm" placeholder="四层共同达成什么效果" @change="updateField(seg.id, 'resonance_goal', ($event.target as HTMLInputElement).value || null)" />
                </div>
                <div class="editor-row">
                  <label>音效备注</label>
                  <input :value="seg.sfx_note ?? ''" class="input input-sm" placeholder="如 whoosh/impact/riser" @change="updateField(seg.id, 'sfx_note', ($event.target as HTMLInputElement).value || null)" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 状态提示 -->
        <div v-if="store.steps[0]?.status === 'completed'" class="config-card success-card">
          <span class="success-icon">✅</span> 分镜已生成，可以进入下一步
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import { useProductionStore } from '@/stores/production'
import { MUSIC_MOOD_LABELS, RHYTHM_LABELS } from '@zimti/shared'
import type { MusicMood, RhythmInstruction } from '@zimti/shared'
import api from '@/api/client'

const props = defineProps<{
  /** 'script' 聚焦脚本编辑区，'storyboard' 聚焦分镜预览区 */
  focusMode?: 'script' | 'storyboard'
}>()

interface SegmentItem {
  id: number
  segment_type: string
  oral_text: string | null
  visual_description: string
  duration: number
  // v2 扩展
  emotion?: string | null
  camera_movement?: string | null
  // v3 共振
  music_mood?: MusicMood | null
  rhythm_instruction?: RhythmInstruction | null
  resonance_goal?: string | null
  sfx_note?: string | null
}

const store = useProductionStore()
const segmentList = ref<SegmentItem[]>([])
const expandedId = ref<number | null>(null)
const storyboardSectionRef = ref<HTMLElement | null>(null)

const charCount = computed(() => store.fullText.length)
const estimatedDuration = computed(() => Math.max(1, Math.round(charCount.value / 5)))
const segmentCount = computed(() => segmentList.value.length)

// 自动保存 debounce
let saveTimer: ReturnType<typeof setTimeout> | null = null

function handleInput() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    if (store.jobId && store.scriptId) {
      await store.saveStepData(1, { full_text: store.fullText })
    }
  }, 1000)
}

function typeLabel(type: string): string {
  const map: Record<string, string> = { oral: '口播', visual: '画面', transition: '转场' }
  return map[type] ?? type
}

function musicMoodLabel(mood: string): string {
  return (MUSIC_MOOD_LABELS as Record<string, string>)[mood] ?? mood
}

function rhythmLabel(rhythm: string): string {
  return (RHYTHM_LABELS as Record<string, string>)[rhythm] ?? rhythm
}

function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

async function updateField(segmentId: number, field: string, value: string | null) {
  if (!store.scriptId) return
  try {
    await api.put(`/scripts/${store.scriptId}/segments/${segmentId}`, { [field]: value })
    // 更新本地状态
    const seg = segmentList.value.find(s => s.id === segmentId)
    if (seg) (seg as any)[field] = value || null
  } catch (e) {
    console.error('更新分镜字段失败', e)
  }
}

async function loadSegments() {
  if (!store.scriptId) return
  try {
    const res = await api.get(`/scripts/${store.scriptId}`) as any
    segmentList.value = res.segments || []
  } catch {
    // 静默
  }
}

async function handleGenerateStoryboard() {
  if (!store.scriptId || !store.fullText.trim()) return

  // 先保存脚本到 DB
  try {
    await api.put(`/scripts/${store.scriptId}`, {
      full_text: store.fullText,
      video_type: store.videoType,
      oral_ratio: store.oralRatio,
    })
  } catch {
    // 保存失败不阻塞，后端会从 PipelineJob.output 读
  }

  // 执行分镜生成步骤
  await store.runStep(1, { video_type: store.videoType })

  // 重新加载分镜
  await loadSegments()
}

onMounted(async () => {
  await loadSegments()
  // 如果文案定稿后转脚本时已传递 fullText，则优先使用；否则从服务端加载
  if (!store.fullText && store.scriptId) {
    try {
      const res = await api.get(`/scripts/${store.scriptId}`) as any
      if (res.full_text) {
        store.fullText = res.full_text
      }
    } catch {
      // 静默失败，用户可手动输入
    }
  }
})

// focusMode 变化时自动滚动到对应区域
watch(() => props.focusMode, async (mode) => {
  if (mode === 'storyboard' && storyboardSectionRef.value) {
    await nextTick()
    storyboardSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}, { immediate: true })
</script>

<style scoped>
.script-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 20px;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
}

.editor-section {
  display: flex;
  flex-direction: column;
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

.char-count {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.script-textarea {
  flex: 1;
  min-height: 300px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
  width: 100%;
}

.script-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
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

.input-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.range-input {
  width: 100%;
}

.hint-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 10px;
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

/* 分镜卡片 */
.storyboard-cards { padding: 14px 10px; }
.segment-list { max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }

.segment-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.segment-card:hover { border-color: var(--color-primary); }
.segment-card.has-resonance { border-left: 3px solid #8B5CF6; }

.seg-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.seg-index {
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--color-primary); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; flex-shrink: 0;
}
.seg-type {
  font-size: 11px; padding: 1px 6px; border-radius: 4px; flex-shrink: 0;
  color: var(--color-primary); background: rgba(59,130,246,0.1);
}
.seg-type.oral { color: #2563EB; background: rgba(37,99,235,0.1); }
.seg-type.visual { color: #059669; background: rgba(5,150,105,0.1); }
.seg-type.transition { color: #D97706; background: rgba(217,119,6,0.1); }
.seg-duration { font-size: 11px; color: var(--color-text-tertiary); margin-left: auto; }

.seg-body { font-size: 12px; color: var(--color-text-secondary); line-height: 1.4; }

/* 共振标签 */
.seg-resonance { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
.resonance-tag {
  font-size: 10px; padding: 1px 6px; border-radius: 4px; white-space: nowrap;
}
.resonance-tag.music { background: rgba(139,92,246,0.1); color: #7C3AED; }
.resonance-tag.rhythm { background: rgba(239,68,68,0.1); color: #DC2626; }
.resonance-tag.emotion { background: rgba(245,158,11,0.1); color: #D97706; }

.seg-goal { font-size: 11px; color: #6D28D9; margin-top: 4px; }
.seg-sfx { font-size: 11px; color: var(--color-text-tertiary); margin-top: 2px; }

/* 编辑区 */
.seg-editor {
  margin-top: 8px; padding-top: 8px;
  border-top: 1px dashed var(--color-border);
  display: flex; flex-direction: column; gap: 6px;
}
.editor-row { display: flex; align-items: center; gap: 8px; }
.editor-row label { font-size: 11px; color: var(--color-text-secondary); width: 60px; flex-shrink: 0; }
.editor-row .input { flex: 1; }

.success-card {
  text-align: center;
  color: #10b981;
  font-size: 14px;
}

.success-icon {
  margin-right: 4px;
}

.focus-highlight {
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

@media (max-width: 768px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }

  .script-textarea {
    min-height: 200px;
  }
}
</style>
