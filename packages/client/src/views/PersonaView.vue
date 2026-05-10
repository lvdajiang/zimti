<template>
  <div class="persona-page">
    <div class="title-bar">
      <h2>人设配置</h2>
      <div class="title-actions">
        <button class="btn btn-preview" :disabled="previewGenerating" @click="handlePreview">
          {{ previewGenerating ? '生成中...' : '预览效果' }}
        </button>
        <button class="btn btn-save" :disabled="saveStatus === 'saving'" @click="handleSave">
          {{ saveStatus === 'saving' ? '保存中...' : saveStatus === 'success' ? '已保存' : '保存' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="form" class="content">
      <!-- 区块C: 基本信息 -->
      <section class="section">
        <h3 class="section-title">基本信息</h3>
        <div class="form-grid">
          <div class="form-field">
            <label>称呼 <span class="required">*</span></label>
            <input v-model="form.display_name" placeholder="请输入称呼" />
            <span v-if="errors.display_name" class="error">{{ errors.display_name }}</span>
          </div>
          <div class="form-field">
            <label>年龄</label>
            <input v-model.number="form.age" type="number" placeholder="可选" />
          </div>
          <div class="form-field">
            <label>职业</label>
            <input v-model="form.career_background" placeholder="请输入职业背景" />
          </div>
          <div class="form-field">
            <label>从业年限</label>
            <input v-model.number="form.years_of_experience" type="number" placeholder="可选" />
          </div>
        </div>
        <div class="form-field full">
          <label>核心经历</label>
          <textarea v-model="form.core_experience" rows="3" placeholder="请描述核心经历"></textarea>
        </div>
      </section>

      <!-- 区块D: 核心定位 -->
      <section class="section">
        <h3 class="section-title">核心定位</h3>
        <div class="form-field">
          <label>一句话定位 <span class="required">*</span></label>
          <input v-model="form.one_line_positioning" placeholder="用一句话概括你的定位" />
          <span v-if="errors.one_line_positioning" class="error">{{ errors.one_line_positioning }}</span>
        </div>
        <div class="form-field">
          <label>核心理念</label>
          <textarea v-model="form.core_philosophy" rows="3" placeholder="请描述核心理念"></textarea>
        </div>
        <div class="form-field">
          <label>独特卖点</label>
          <div class="tag-list">
            <span v-for="(point, idx) in form.unique_selling_point" :key="idx" class="tag tag-removable">
              {{ point }}
              <button class="tag-remove" @click="form.unique_selling_point.splice(idx, 1)">&times;</button>
            </span>
            <div class="tag-add">
              <input
                v-model="newSellingPoint"
                placeholder="添加卖点"
                @keydown.enter.prevent="addSellingPoint"
              />
              <button @click="addSellingPoint">+</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 区块E: 语言风格 -->
      <section class="section">
        <h3 class="section-title">语言风格</h3>
        <div class="form-field">
          <label>风格标签</label>
          <div class="tag-list">
            <span
              v-for="tag in presetStyleTags"
              :key="tag"
              class="tag tag-clickable"
              :class="{ 'tag-selected': form.language_styles.includes(tag) }"
              @click="toggleStyle(tag)"
            >
              {{ tag }}
            </span>
            <div v-for="(custom, idx) in customStyles" :key="'custom-' + idx" class="tag tag-removable">
              {{ custom }}
              <button class="tag-remove" @click="removeCustomStyle(idx)">&times;</button>
            </div>
            <div class="tag-add">
              <input
                v-model="newCustomStyle"
                placeholder="自定义标签"
                @keydown.enter.prevent="addCustomStyle"
              />
              <button @click="addCustomStyle">+</button>
            </div>
          </div>
        </div>
        <div class="form-field">
          <label>风格描述</label>
          <textarea v-model="form.style_description" rows="3" placeholder="自由描述你的语言风格特点"></textarea>
        </div>
      </section>

      <!-- 区块F: 口头禅 -->
      <section class="section">
        <h3 class="section-title">口头禅</h3>
        <div v-for="group in catchphraseGroups" :key="group.key" class="catchphrase-group">
          <h4>{{ group.label }}</h4>
          <div class="tag-list">
            <span v-for="(phrase, idx) in getCatchphrases(group.value)" :key="idx" class="tag tag-removable">
              {{ phrase }}
              <button class="tag-remove" @click="removeCatchphrase(group.value, idx)">&times;</button>
            </span>
            <div class="tag-add">
              <input
                v-model="newCatchphrases[group.key]"
                placeholder="添加{{ group.label }}"
                @keydown.enter.prevent="addCatchphrase(group.value)"
              />
              <button @click="addCatchphrase(group.value)">+</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 区块G: 叙事视角 & 样稿 -->
      <section class="section">
        <h3 class="section-title">叙事视角 & 样稿学习</h3>
        <div class="form-field">
          <label>叙事视角</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" v-model="form.narrative_viewpoint" value="first" />
              第一人称（我）
            </label>
            <label class="radio-label">
              <input type="radio" v-model="form.narrative_viewpoint" value="third" />
              第三人称（他/她）
            </label>
          </div>
        </div>
        <div class="form-field">
          <label>文本样稿</label>
          <div class="upload-area" @click="triggerUpload('text')">
            <p>点击或拖拽上传文本样稿（.txt / .md）</p>
            <p class="upload-hint">最大 10MB</p>
          </div>
          <input ref="textInputRef" type="file" accept=".txt,.md" style="display:none" @change="handleFileUpload($event, 'text')" />
          <div v-for="file in form.sample_texts" :key="file.id" class="file-item">
            <span class="file-name">{{ file.filename }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
            <button class="file-delete" @click="handleDeleteSample(file.id, 'text')">删除</button>
          </div>
        </div>
        <div class="form-field">
          <label>音频样稿</label>
          <div class="upload-area" @click="triggerUpload('audio')">
            <p>点击或拖拽上传音频样稿（.mp3 / .wav）</p>
            <p class="upload-hint">最大 10MB</p>
          </div>
          <input ref="audioInputRef" type="file" accept=".mp3,.wav" style="display:none" @change="handleFileUpload($event, 'audio')" />
          <div v-for="file in form.sample_audios" :key="file.id" class="file-item">
            <span class="file-name">{{ file.filename }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
            <button class="file-delete" @click="handleDeleteSample(file.id, 'audio')">删除</button>
          </div>
        </div>
      </section>
    </div>

    <!-- 预览弹窗 -->
    <div v-if="previewVisible" class="overlay" @click.self="previewVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>预览效果</h3>
          <button class="dialog-close" @click="previewVisible = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div v-if="previewGenerating" class="preview-loading">AI 正在生成预览文案...</div>
          <div v-else-if="previewText">
            <p class="preview-text">{{ previewText }}</p>
            <button class="btn btn-preview" style="margin-top:16px" @click="handlePreview">换一段</button>
          </div>
          <div v-else class="preview-error">预览生成失败，请重试</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { usePersonaStore } from '@/stores/persona'
import type { CatchphraseItem, SampleFile } from '@/api/persona'
import { previewPersonaEffect, uploadSampleFile, deleteSampleFile } from '@/api/persona'
import { toast } from '@/utils/toast'

const store = usePersonaStore()
const loading = computed(() => store.loading)

const form = reactive({
  display_name: '',
  age: null as number | null,
  career_background: '',
  years_of_experience: null as number | null,
  core_experience: '',
  one_line_positioning: '',
  core_philosophy: '',
  unique_selling_point: [] as string[],
  language_styles: [] as string[],
  style_description: '',
  catchphrases: [] as CatchphraseItem[],
  narrative_viewpoint: 'first' as 'first' | 'third',
  sample_texts: [] as SampleFile[],
  sample_audios: [] as SampleFile[],
})

const errors = reactive<Record<string, string>>({})
const saveStatus = ref<'idle' | 'saving' | 'success' | 'failed'>('idle')
const previewVisible = ref(false)
const previewGenerating = ref(false)
const previewText = ref<string | null>(null)
const newSellingPoint = ref('')
const newCustomStyle = ref('')
const customStyles = ref<string[]>([])
const newCatchphrases = reactive<Record<string, string>>({ opening: '', transition: '', reveal: '', closing: '' })
const textInputRef = ref<HTMLInputElement>()
const audioInputRef = ref<HTMLInputElement>()

const presetStyleTags = ['短句多', '爱打比方', '爱反问', '直接吐槽', '温和', '幽默']

const catchphraseGroups = [
  { key: 'opening', label: '开场白', value: '开场' as const },
  { key: 'transition', label: '转折语', value: '转折' as const },
  { key: 'reveal', label: '揭晓语', value: '揭晓' as const },
  { key: 'closing', label: '结束语', value: '结束' as const },
]

function getCatchphrases(type: CatchphraseItem['type']): string[] {
  return form.catchphrases.filter(c => c.type === type).map(c => c.content)
}

function addSellingPoint(): void {
  const val = newSellingPoint.value.trim()
  if (!val) return
  form.unique_selling_point.push(val)
  newSellingPoint.value = ''
}

function toggleStyle(tag: string): void {
  const idx = form.language_styles.indexOf(tag)
  if (idx === -1) form.language_styles.push(tag)
  else form.language_styles.splice(idx, 1)
}

function addCustomStyle(): void {
  const val = newCustomStyle.value.trim()
  if (!val || form.language_styles.includes(val)) return
  form.language_styles.push(val)
  customStyles.value.push(val)
  newCustomStyle.value = ''
}

function removeCustomStyle(idx: number): void {
  const tag = customStyles.value[idx]
  form.language_styles = form.language_styles.filter(s => s !== tag)
  customStyles.value.splice(idx, 1)
}

function addCatchphrase(type: CatchphraseItem['type']): void {
  const key = catchphraseGroups.find(g => g.value === type)?.key
  const val = newCatchphrases[key!].trim()
  if (!val) return
  form.catchphrases.push({ type, content: val })
  newCatchphrases[key!] = ''
}

function removeCatchphrase(type: CatchphraseItem['type'], idx: number): void {
  const items = form.catchphrases.filter(c => c.type === type)
  const item = items[idx]
  const globalIdx = form.catchphrases.indexOf(item)
  if (globalIdx !== -1) form.catchphrases.splice(globalIdx, 1)
}

function triggerUpload(type: 'text' | 'audio'): void {
  if (type === 'text') textInputRef.value?.click()
  else audioInputRef.value?.click()
}

async function handleFileUpload(event: Event, type: 'text' | 'audio'): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    toast.error('文件不能超过 10MB')
    return
  }
  try {
    const res = await uploadSampleFile(file, type)
    const list = type === 'text' ? form.sample_texts : form.sample_audios
    list.push(res.data)
  } catch {
    toast.error('文件上传失败，请重试')
  }
  input.value = ''
}

async function handleDeleteSample(id: number, type: 'text' | 'audio'): Promise<void> {
  const list = type === 'text' ? form.sample_texts : form.sample_audios
  const idx = list.findIndex(f => f.id === id)
  if (idx === -1) return
  try {
    await deleteSampleFile(id)
    list.splice(idx, 1)
  } catch {
    toast.error('文件删除失败，请重试')
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function validate(): boolean {
  Object.keys(errors).forEach(k => delete errors[k])
  let valid = true
  if (!form.display_name.trim()) {
    errors.display_name = '请填写称呼'
    valid = false
  }
  if (!form.one_line_positioning.trim()) {
    errors.one_line_positioning = '请填写一句话定位'
    valid = false
  }
  return valid
}

async function handleSave(): Promise<void> {
  if (!validate()) return
  saveStatus.value = 'saving'
  try {
    await store.saveConfig({
      ...form,
      age: form.age ?? null,
      years_of_experience: form.years_of_experience ?? null,
    })
    saveStatus.value = 'success'
    setTimeout(() => { saveStatus.value = 'idle' }, 2000)
  } catch {
    saveStatus.value = 'failed'
    toast.error('保存失败，请重试')
  }
}

async function handlePreview(): Promise<void> {
  previewVisible.value = true
  previewGenerating.value = true
  previewText.value = null
  try {
    const res = await previewPersonaEffect({
      display_name: form.display_name,
      language_styles: form.language_styles,
      catchphrases: form.catchphrases,
      narrative_viewpoint: form.narrative_viewpoint,
      core_philosophy: form.core_philosophy,
      one_line_positioning: form.one_line_positioning,
    })
    previewText.value = res.data.preview_text
  } catch {
    previewText.value = null
    toast.error('预览生成超时，请重试')
  } finally {
    previewGenerating.value = false
  }
}

onMounted(async () => {
  await store.loadConfig()
  const c = store.config
  if (c) {
    form.display_name = c.display_name
    form.age = c.age
    form.career_background = c.career_background
    form.years_of_experience = c.years_of_experience
    form.core_experience = c.core_experience
    form.one_line_positioning = c.one_line_positioning
    form.core_philosophy = c.core_philosophy
    form.unique_selling_point = [...(c.unique_selling_point ?? [])]
    form.language_styles = [...(c.language_styles ?? [])]
    form.style_description = c.style_description
    form.catchphrases = [...(c.catchphrases ?? [])]
    form.narrative_viewpoint = c.narrative_viewpoint
    form.sample_texts = [...(c.sample_texts ?? [])]
    form.sample_audios = [...(c.sample_audios ?? [])]
    customStyles.value = (c.language_styles ?? []).filter(s => !presetStyleTags.includes(s))
  }
})
</script>

<style scoped>
.persona-page {
  max-width: 960px;
  margin: 0 auto;
}
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.title-bar h2 {
  margin: 0;
  font-size: 22px;
  color: #1a1a2e;
}
.title-actions {
  display: flex;
  gap: 12px;
}
.btn {
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: opacity 0.2s;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-save {
  background: #4fc3f7;
  color: #fff;
}
.btn-preview {
  background: #fff;
  color: #333;
  border: 1px solid #ddd;
}
.section {
  background: #fff;
  border-radius: 10px;
  padding: 24px;
  margin-bottom: 16px;
  border: 1px solid #eee;
}
.section-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.form-field {
  margin-bottom: 12px;
}
.form-field.full {
  grid-column: 1 / -1;
}
.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #666;
  font-weight: 500;
}
.required {
  color: #e53935;
}
.form-field input[type="text"],
.form-field input[type="number"],
.form-field textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-color: #4fc3f7;
}
.form-field textarea {
  resize: vertical;
  min-height: 60px;
}
.error {
  display: block;
  color: #e53935;
  font-size: 12px;
  margin-top: 4px;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 13px;
  background: #f0f4ff;
  color: #4a6cf7;
}
.tag-clickable {
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}
.tag-clickable:hover {
  background: #dce6ff;
}
.tag-selected {
  background: #4a6cf7;
  color: #fff;
}
.tag-removable {
  gap: 4px;
}
.tag-remove {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #999;
  padding: 0 2px;
  line-height: 1;
}
.tag-remove:hover {
  color: #e53935;
}
.tag-add {
  display: inline-flex;
  gap: 4px;
}
.tag-add input {
  width: 100px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 16px;
  font-size: 13px;
  outline: none;
}
.tag-add input:focus {
  border-color: #4fc3f7;
}
.tag-add button {
  background: none;
  border: 1px solid #ddd;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  font-size: 16px;
  cursor: pointer;
  color: #4a6cf7;
}
.catchphrase-group {
  margin-bottom: 16px;
}
.catchphrase-group h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #555;
}
.radio-group {
  display: flex;
  gap: 20px;
}
.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  cursor: pointer;
}
.upload-area {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
  margin-bottom: 8px;
}
.upload-area:hover {
  border-color: #4fc3f7;
}
.upload-area p {
  margin: 0;
  color: #999;
  font-size: 14px;
}
.upload-hint {
  font-size: 12px !important;
  margin-top: 4px !important;
  color: #ccc !important;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f9f9f9;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 13px;
}
.file-name {
  flex: 1;
  color: #333;
}
.file-size {
  color: #999;
}
.file-delete {
  background: none;
  border: none;
  color: #e53935;
  cursor: pointer;
  font-size: 13px;
}
.loading {
  text-align: center;
  padding: 60px;
  color: #999;
}
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: #fff;
  border-radius: 12px;
  width: 560px;
  max-height: 80vh;
  overflow-y: auto;
}
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}
.dialog-header h3 {
  margin: 0;
  font-size: 16px;
}
.dialog-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}
.dialog-body {
  padding: 20px;
}
.preview-loading,
.preview-error {
  text-align: center;
  padding: 40px;
  color: #999;
}
.preview-text {
  line-height: 1.8;
  color: #333;
  font-size: 15px;
  white-space: pre-wrap;
}
</style>
