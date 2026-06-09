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
            :class="{
              has_audio: !!seg.oral_audio_url,
              upload_target: ttsEngine === 'uploaded',
            }"
            @dragover.prevent="onDragOver($event, seg.id)"
            @dragleave="onDragLeave($event, seg.id)"
            @drop.prevent="onDrop($event, seg.id)"
          >
            <div class="seg-header">
              <span class="seg-index">{{ i + 1 }}</span>
              <span class="seg-type-badge">{{ seg.segment_type === 'oral' ? '口播' : '画面' }}</span>
              <span v-if="seg.oral_audio_url" class="audio-badge">已配音</span>
              <span v-if="uploadedAudioMap[seg.id]" class="audio-badge upload-badge">已上传</span>
            </div>
            <div class="seg-text">{{ seg.oral_text || seg.visual_description || '（无内容）' }}</div>
            <div v-if="seg.oral_audio_url" class="audio-player">
              <audio controls :src="audioPath(seg.oral_audio_url)" class="player" />
            </div>
            <!-- 模式C：上传按钮 -->
            <div v-if="ttsEngine === 'uploaded' && !uploadedAudioMap[seg.id]" class="upload-row">
              <label class="btn btn-sm btn-outline">
                📎 上传录音
                <input type="file" accept="audio/*" class="hidden-input" @change="onFileSelect($event, seg.id)" />
              </label>
              <span class="upload-hint">或将音频文件拖放到此处</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：配置 -->
      <div class="config-section">
        <!-- 模式切换 -->
        <div class="config-card">
          <h4>配音方式</h4>
          <div class="mode-tabs">
            <button
              v-for="m in modes"
              :key="m.value"
              class="mode-tab"
              :class="{ active: ttsEngine === m.value }"
              @click="ttsEngine = m.value"
            >
              {{ m.icon }} {{ m.label }}
            </button>
          </div>
        </div>

        <!-- 模式A：AI 音色选择 -->
        <div v-if="ttsEngine === 'edge_tts'" class="config-card">
          <h4>语音设置</h4>
          <div class="form-group">
            <label>音色</label>
            <select v-model="ttsVoice" class="input">
              <option
                v-for="vp in presetVoices"
                :key="vp.id"
                :value="vp.engineRef"
              >
                {{ vp.name }}
              </option>
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

        <!-- 模式A（Fish Audio 音色） -->
        <div v-if="ttsEngine === 'fish_audio'" class="config-card">
          <h4>Fish Audio 音色</h4>
          <div class="form-group">
            <label>选择音色</label>
            <select v-model="ttsVoiceProfileId" class="input">
              <option :value="null" disabled>请选择音色</option>
              <option
                v-for="vp in fishVoices"
                :key="vp.id"
                :value="vp.id"
              >
                {{ vp.name }}
              </option>
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
          <!-- 试听按钮 -->
          <button
            v-if="ttsVoiceProfileId"
            class="btn btn-outline btn-block"
            :disabled="previewing"
            @click="handlePreview"
          >
            {{ previewing ? '生成中...' : '▶ 试听' }}
          </button>
        </div>

        <!-- 模式B：声音克隆 -->
        <div v-if="ttsEngine === 'fish_audio'" class="config-card">
          <h4>声音克隆</h4>
          <p class="hint-text">上传 30 秒录音样本，AI 将克隆该声音</p>
          <div class="form-group">
            <label>音色名称</label>
            <input v-model="cloneName" class="input" placeholder="给我的声音起个名字" />
          </div>
          <label class="btn btn-outline btn-block">
            🎤 上传录音样本
            <input type="file" accept="audio/*" class="hidden-input" @change="onCloneFileSelect" />
          </label>
          <div v-if="cloneFile" class="file-info">
            已选: {{ cloneFile.name }}
          </div>
          <button
            class="btn btn-primary btn-block"
            :disabled="!cloneFile || !cloneName || cloning"
            @click="handleClone"
            style="margin-top: 8px;"
          >
            {{ cloning ? '克隆中...' : '开始克隆' }}
          </button>
        </div>

        <!-- 模式C：自己录音说明 -->
        <div v-if="ttsEngine === 'uploaded'" class="config-card">
          <h4>自己录音</h4>
          <p class="hint-text">为每个口播分镜上传对应的录音文件。支持拖放。</p>
          <div v-if="Object.keys(uploadedAudioMap).length > 0" class="upload-count">
            已上传 {{ Object.keys(uploadedAudioMap).length }} / {{ oralSegmentCount }} 段
          </div>
          <label class="btn btn-outline btn-block" style="margin-top: 8px;">
            📂 批量上传（按文件名匹配）
            <input type="file" accept="audio/*" multiple class="hidden-input" @change="onBatchUpload" />
          </label>
        </div>

        <!-- 开始配音按钮 -->
        <button
          class="btn btn-primary btn-block"
          :disabled="!canStartVoiceover"
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
import {
  fetchVoiceProfiles,
  previewVoiceProfile,
  cloneVoiceProfile,
  uploadRecording,
  type VoiceProfileItem,
} from '@/api/voiceProfile'

const store = useProductionStore()
const segments = ref<SegmentItem[]>([])
const voiceProfiles = ref<VoiceProfileItem[]>([])
const loading = ref(false)
const ttsRate = ref('+0%')
const previewing = ref(false)
const cloning = ref(false)
const cloneName = ref('')
const cloneFile = ref<File | null>(null)

// 从 store 解构响应式状态
const ttsEngine = computed({
  get: () => store.ttsEngine,
  set: (v) => { store.ttsEngine = v },
})
const ttsVoice = computed({
  get: () => store.ttsVoice,
  set: (v) => { store.ttsVoice = v },
})
const ttsVoiceProfileId = computed({
  get: () => store.ttsVoiceProfileId,
  set: (v) => { store.ttsVoiceProfileId = v },
})
const uploadedAudioMap = computed(() => store.uploadedAudioMap)

const modes = [
  { value: 'edge_tts' as const, label: 'AI音色', icon: '✨' },
  { value: 'fish_audio' as const, label: '声音克隆', icon: '🎤' },
  { value: 'uploaded' as const, label: '自己录音', icon: '📁' },
]

// 按类型分组音色
const presetVoices = computed(() =>
  voiceProfiles.value.filter(vp => vp.type === 'preset' && vp.engine === 'edge_tts'),
)
const fishVoices = computed(() =>
  voiceProfiles.value.filter(vp => vp.engine === 'fish_audio' && vp.type === 'clone'),
)

const oralSegmentCount = computed(() =>
  segments.value.filter(s => s.segment_type === 'oral').length,
)

const totalDuration = computed(() =>
  segments.value.reduce((sum, s) => sum + (s.duration || 0), 0),
)

const canStartVoiceover = computed(() => {
  if (segments.value.length === 0 || store.executing) return false
  if (ttsEngine.value === 'uploaded') {
    // 模式C: 至少上传了一段录音
    return Object.keys(uploadedAudioMap.value).length > 0
  }
  if (ttsEngine.value === 'fish_audio' && !ttsVoiceProfileId.value) return false
  return true
})

interface SegmentItem {
  id: number
  segment_type: string
  oral_text: string | null
  visual_description: string
  oral_audio_url: string | null
  duration: number
}

/** 音频文件路径 */
function audioPath(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `/static/${url.replace(/\\/g, '/').split('/').slice(-2).join('/')}`
}

onMounted(() => { loadSegments(); loadVoices() })
watch(() => store.scriptId, () => { loadSegments() })

async function loadSegments() {
  if (!store.scriptId) return
  loading.value = true
  try {
    const res = await fetch(`/api/v1/scripts/${store.scriptId}`)
    const data = await res.json()
    segments.value = data.segments || []
  } catch {
    // 静默
  } finally {
    loading.value = false
  }
}

async function loadVoices() {
  try {
    voiceProfiles.value = await fetchVoiceProfiles()
  } catch {
    voiceProfiles.value = []
  }
}

async function handleVoiceover() {
  const config: Record<string, unknown> = {
    engine: ttsEngine.value,
    rate: ttsRate.value,
  }

  if (ttsEngine.value === 'edge_tts') {
    config.voice = ttsVoice.value
  } else if (ttsEngine.value === 'fish_audio') {
    config.voice_profile_id = ttsVoiceProfileId.value
  } else if (ttsEngine.value === 'uploaded') {
    config.uploaded_audio_map = uploadedAudioMap.value
  }

  await store.runStep(2, config)
  await loadSegments()
}

async function handlePreview() {
  if (!ttsVoiceProfileId.value) return
  previewing.value = true
  try {
    const result = await previewVoiceProfile(ttsVoiceProfileId.value)
    if (result.url) {
      const audio = new Audio(result.url)
      audio.play()
    }
  } catch {
    // 错误已由 api client toast
  } finally {
    previewing.value = false
  }
}

async function handleClone() {
  if (!cloneFile.value || !cloneName.value) return
  cloning.value = true
  try {
    const profile = await cloneVoiceProfile(cloneName.value, cloneFile.value)
    voiceProfiles.value.push(profile)
    ttsVoiceProfileId.value = profile.id
    cloneName.value = ''
    cloneFile.value = null
  } catch {
    // 错误已由 api client toast
  } finally {
    cloning.value = false
  }
}

function onCloneFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) cloneFile.value = input.files[0]
}

// 模式 C: 单段上传
async function onFileSelect(e: Event, segId: number) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await uploadForSegment(file, segId)
}

// 模式 C: 拖放
function onDragOver(e: DragEvent, _segId: number) {
  (e.currentTarget as HTMLElement).classList.add('drag-over')
}
function onDragLeave(e: DragEvent, _segId: number) {
  (e.currentTarget as HTMLElement).classList.remove('drag-over')
}
async function onDrop(e: DragEvent, segId: number) {
  (e.currentTarget as HTMLElement).classList.remove('drag-over')
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  await uploadForSegment(file, segId)
}

async function uploadForSegment(file: File, segId: number) {
  try {
    const profile = await uploadRecording(`segment_${segId}`, file)
    store.uploadedAudioMap = { ...store.uploadedAudioMap, [segId]: profile.engineRef || profile.sampleUrl || '' }
  } catch {
    // 错误已由 api client toast
  }
}

// 批量上传
async function onBatchUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  const oralSegs = segments.value.filter(s => s.segment_type === 'oral')
  for (let i = 0; i < Math.min(input.files.length, oralSegs.length); i++) {
    await uploadForSegment(input.files[i], oralSegs[i].id)
  }
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
  grid-template-columns: 1fr 300px;
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
  transition: border-color 0.2s;
}

.segment-card.has_audio {
  border-left: 3px solid #10b981;
}

.segment-card.upload_target {
  cursor: default;
}

.segment-card.drag-over {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.05);
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

.upload-badge {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
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

.upload-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.upload-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  opacity: 0.7;
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

.mode-tabs {
  display: flex;
  gap: 6px;
}

.mode-tab {
  flex: 1;
  padding: 8px 4px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  text-align: center;
}

.mode-tab:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.mode-tab.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
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

.hint-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0 0 10px;
  line-height: 1.5;
}

.file-info {
  font-size: 12px;
  color: #10b981;
  margin-top: 4px;
}

.upload-count {
  font-size: 13px;
  color: var(--color-primary);
  font-weight: 500;
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

.btn-outline {
  background: transparent;
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-block {
  width: 100%;
}

.hidden-input {
  display: none;
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
