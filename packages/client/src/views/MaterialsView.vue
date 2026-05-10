<template>
  <div class="materials-page">
    <div class="title-bar">
      <div class="title-left">
        <h2>素材库</h2>
        <span v-if="stats" class="stats-text">
          共 {{ stats.total }} 条素材 ·
          图片 {{ stats.image }} / 视频 {{ stats.video }} / 音乐 {{ stats.music }} / 音效 {{ stats.sfx }} / 地图动画 {{ stats.map_animation }}
        </span>
      </div>
      <div class="title-actions">
        <button class="btn btn-outline" @click="showPexelsModal = true">外部导入</button>
        <button class="btn btn-purple" @click="showAiModal = true; genProgress = 0">AI 生成</button>
        <button class="btn btn-primary" @click="showUploadModal = true">上传素材</button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-tabs">
        <button v-for="tab in typeTabs" :key="tab.value" class="filter-tab" :class="{ active: typeFilter === tab.value }" @click="typeFilter = tab.value; loadData(true)">
          {{ tab.label }}
        </button>
      </div>
      <div class="filter-right">
        <select v-model="sortBy" class="sort-select" @change="loadData(true)">
          <option value="created_at">最新上传</option>
          <option value="use_count">最多使用</option>
          <option value="name">名称排序</option>
          <option value="file_size">文件大小</option>
        </select>
        <input v-model="searchKeyword" class="search-input" placeholder="搜索素材名称、标签..." @input="debouncedLoad" />
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="materials.length === 0 && (searchKeyword || typeFilter !== 'all')" class="empty-state"><p>未找到匹配的素材，请尝试其他关键词或筛选条件</p></div>
    <div v-else-if="materials.length === 0" class="empty-state"><p>暂无素材，点击上方按钮上传或生成</p></div>
    <div v-else class="material-grid">
      <div v-for="m in materials" :key="m.id" class="material-card">
        <div class="card-thumb">
          <img v-if="m.thumbnail_url" :src="m.thumbnail_url" :alt="m.name" loading="lazy" @error="handleImgError($event)" />
          <div v-else class="thumb-placeholder" :class="m.type">{{ typeIcon(m.type) }}</div>
          <div class="card-overlay">
            <button class="overlay-btn" @click="openEdit(m)">编辑</button>
            <button class="overlay-btn" @click="downloadMaterial(m)">下载</button>
            <button class="overlay-btn btn-del" @click="openDelete(m)">删除</button>
          </div>
        </div>
        <div class="card-info">
          <div class="card-name" :title="m.name">{{ m.name }}</div>
          <div class="card-tags">
            <span class="tag" :class="'tag-type-' + m.type">{{ m.type_label }}</span>
            <span class="tag" :class="'tag-source-' + m.source">{{ m.source_label }}</span>
            <span v-if="m.copyright_status !== 'pending'" class="tag" :class="'tag-copy-' + m.copyright_status">{{ m.copyright_status_label }}</span>
          </div>
          <div class="card-meta">
            <span>使用 {{ m.use_count }} 次</span>
            <span>{{ m.file_size_display }}</span>
          </div>
          <div v-if="m.tags.length > 0" class="card-custom-tags">
            <span v-for="tag in m.tags.slice(0, 3)" :key="tag" class="custom-tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="materials.length > 0 && total > materials.length" class="pagination">
      <button class="btn-sm" :disabled="currentPage <= 1" @click="currentPage--; loadData()">上一页</button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button class="btn-sm" :disabled="currentPage >= totalPages" @click="currentPage++; loadData()">下一页</button>
    </div>

    <!-- 上传素材弹窗 -->
    <div v-if="showUploadModal" class="overlay" @click.self="showUploadModal = false">
      <div class="dialog dialog-lg">
        <div class="dialog-header">
          <h3>上传素材</h3>
          <button class="dialog-close" @click="showUploadModal = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="upload-drop-zone" :class="{ dragging: isDragging }" @dragover.prevent="isDragging = true" @dragleave="isDragging = false" @drop.prevent="handleDrop">
            <div class="drop-icon">&#9729;</div>
            <p>拖拽文件到此处，或点击选择</p>
            <span>支持 JPG/PNG/MP4/MP3/WAV，单个文件不超过 500MB</span>
            <input ref="fileInput" type="file" multiple accept=".jpg,.jpeg,.png,.mp4,.mp3,.wav" style="display:none" @change="handleFileSelect" />
            <button class="btn btn-sm" @click="($refs.fileInput as HTMLInputElement)?.click()">选择文件</button>
          </div>
          <div v-if="uploadFiles.length > 0" class="upload-list">
            <div v-for="(f, i) in uploadFiles" :key="i" class="upload-item">
              <span class="upload-name">{{ f.name }}</span>
              <span class="upload-size">{{ formatSize(f.size) }}</span>
              <span v-if="uploadProgress[i] !== undefined" class="upload-progress">{{ uploadProgress[i] }}%</span>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" :disabled="uploadFiles.length === 0 || uploading" @click="doUpload">
              {{ uploading ? '上传中...' : '开始上传' }}
            </button>
            <button class="btn" @click="showUploadModal = false; uploadFiles = []">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- AI 生成弹窗 -->
    <div v-if="showAiModal" class="overlay" @click.self="closeAiModal">
      <div class="dialog dialog-md">
        <div class="dialog-header">
          <h3>AI 生成素材</h3>
          <button class="dialog-close" @click="closeAiModal">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-field">
            <label>素材类型</label>
            <div class="type-toggle">
              <button class="toggle-btn" :class="{ active: genType === 'image' }" @click="genType = 'image'">图片</button>
              <button class="toggle-btn" :class="{ active: genType === 'video' }" @click="genType = 'video'">视频</button>
            </div>
          </div>
          <div class="form-field">
            <label>描述</label>
            <textarea v-model="genDescription" class="gen-textarea" placeholder="描述你想要的素材，如：赛里木湖日落航拍"></textarea>
          </div>
          <div v-if="genProgress > 0 && genProgress < 100" class="gen-progress">
            <div class="progress-bar"><div class="progress-fill purple" :style="{ width: genProgress + '%' }"></div></div>
            <span>AI 正在生成... {{ genProgress }}%</span>
          </div>
          <div class="form-actions">
            <button v-if="genProgress === 0" class="btn btn-purple" :disabled="!genDescription" @click="startGenerate">生成</button>
            <button class="btn" @click="closeAiModal">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 外部导入弹窗 -->
    <div v-if="showPexelsModal" class="overlay" @click.self="showPexelsModal = false">
      <div class="dialog dialog-xl">
        <div class="dialog-header">
          <h3>外部导入 <span class="badge-pexels">Pexels</span></h3>
          <button class="dialog-close" @click="showPexelsModal = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="pexels-controls">
            <div class="type-toggle">
              <button class="toggle-btn" :class="{ active: pexelsType === 'image' }" @click="pexelsType = 'image'">图片</button>
              <button class="toggle-btn" :class="{ active: pexelsType === 'video' }" @click="pexelsType = 'video'">视频</button>
            </div>
            <div class="pexels-search-row">
              <input v-model="pexelsKeyword" class="search-input" placeholder="搜索 Pexels 素材，如：sunset landscape" @keyup.enter="searchPexels" />
              <button class="btn btn-primary" @click="searchPexels">搜索</button>
            </div>
          </div>
          <div v-if="pexelsLoading" class="loading">搜索中...</div>
          <div v-else-if="pexelsResults.length === 0 && pexelsSearched" class="empty-state-sm">未找到匹配素材，请尝试其他关键词</div>
          <div v-else class="pexels-grid">
            <div v-for="item in pexelsResults" :key="item.id" class="pexels-card">
              <img :src="item.thumbnail_url" :alt="item.description" loading="lazy" />
              <div class="pexels-overlay">
                <button class="btn-sm btn-primary" @click="importPexels(item)">导入</button>
              </div>
              <div class="pexels-info">
                <span>{{ item.description?.slice(0, 30) }}</span>
                <span>{{ item.author }}</span>
              </div>
            </div>
          </div>
          <div v-if="pexelsResults.length > 0" class="pexels-pagination">
            <span>共 {{ pexelsTotal }} 条结果 · 第 {{ pexelsPage }}/{{ pexelsTotalPages }} 页</span>
            <button class="btn-sm" :disabled="pexelsPage <= 1" @click="pexelsPage--; searchPexels()">上一页</button>
            <button class="btn-sm" :disabled="pexelsPage >= pexelsTotalPages" @click="pexelsPage++; searchPexels()">下一页</button>
          </div>
          <div class="pexels-notice">Pexels 素材遵循 Pexels License，可免费商用，无需署名</div>
        </div>
      </div>
    </div>

    <!-- 编辑素材弹窗 -->
    <div v-if="showEditModal" class="overlay" @click.self="showEditModal = false">
      <div class="dialog dialog-md">
        <div class="dialog-header">
          <h3>编辑素材信息</h3>
          <button class="dialog-close" @click="showEditModal = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-field">
            <label>素材名称</label>
            <input v-model="editForm.name" />
          </div>
          <div class="form-field">
            <label>标签（回车添加）</label>
            <div class="tags-input-wrap">
              <input v-model="tagInput" placeholder="输入标签后按回车" @keyup.enter="addTag" />
              <div class="tags-list">
                <span v-for="(tag, i) in editForm.tags" :key="i" class="custom-tag removable" @click="editForm.tags.splice(i, 1)">{{ tag }} &times;</span>
              </div>
            </div>
          </div>
          <div class="form-field">
            <label>版权状态</label>
            <select v-model="editForm.copyright_status">
              <option value="free_commercial">免费商用</option>
              <option value="purchased">已购买</option>
              <option value="ai_generated">AI生成</option>
              <option value="pending">待确认</option>
            </select>
          </div>
          <div class="form-field">
            <label>来源</label>
            <select v-model="editForm.source">
              <option value="pexels">Pexels</option>
              <option value="ai_generated">AI生成</option>
              <option value="self_shot">自拍</option>
              <option value="purchased">购买</option>
              <option value="external_import">外部导入</option>
            </select>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" @click="saveEdit">保存</button>
            <button class="btn" @click="showEditModal = false">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteModal" class="overlay" @click.self="showDeleteModal = false">
      <div class="dialog dialog-sm">
        <div class="dialog-header">
          <h3>确认删除</h3>
          <button class="dialog-close" @click="showDeleteModal = false">&times;</button>
        </div>
        <div class="dialog-body">
          <p>删除后该素材将从素材库移除。</p>
          <p v-if="deleteRefCount > 0" class="text-danger">该素材已被 {{ deleteRefCount }} 个视频引用，无法删除。</p>
          <div class="form-actions">
            <button class="btn btn-danger" :disabled="deleteRefCount > 0" @click="confirmDelete">确认删除</button>
            <button class="btn" @click="showDeleteModal = false">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api/client'
import { toast } from '@/utils/toast'

interface Material {
  id: string
  name: string
  type: string
  type_label: string
  source: string
  source_label: string
  copyright_status: string
  copyright_status_label: string
  file_url: string
  thumbnail_url: string | null
  file_size: number
  file_size_display: string
  tags: string[]
  use_count: number
  metadata: unknown
  created_at: string
  updated_at: string
}

interface PexelsItem {
  id: string
  thumbnail_url: string
  source_url: string
  type: string
  description: string
  author: string
}

interface Stats {
  total: number; image: number; video: number; music: number; sfx: number; map_animation: number
}

const materials = ref<Material[]>([])
const stats = ref<Stats | null>(null)
const loading = ref(false)
const typeFilter = ref('all')
const sortBy = ref('created_at')
const searchKeyword = ref('')
const currentPage = ref(1)
const total = ref(0)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Upload
const showUploadModal = ref(false)
const uploadFiles = ref<File[]>([])
const uploadProgress = ref<Record<number, number>>({})
const uploading = ref(false)
const isDragging = ref(false)

// AI Generate
const showAiModal = ref(false)
const genType = ref('image')
const genDescription = ref('')
const genProgress = ref(0)
const genTaskId = ref<string | null>(null)
let genPollTimer: ReturnType<typeof setInterval> | null = null

// Pexels
const showPexelsModal = ref(false)
const pexelsType = ref('image')
const pexelsKeyword = ref('')
const pexelsResults = ref<PexelsItem[]>([])
const pexelsTotal = ref(0)
const pexelsPage = ref(1)
const pexelsLoading = ref(false)
const pexelsSearched = ref(false)

// Edit
const showEditModal = ref(false)
const editingMaterial = ref<Material | null>(null)
const tagInput = ref('')
const editForm = reactive({ name: '', tags: [] as string[], copyright_status: 'pending', source: 'self_shot' })

// Delete
const showDeleteModal = ref(false)
const deletingMaterial = ref<Material | null>(null)
const deleteRefCount = ref(0)

const typeTabs = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'music', label: '音乐' },
  { value: 'sfx', label: '音效' },
  { value: 'map_animation', label: '地图动画' },
]

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / 20)))
const pexelsTotalPages = computed(() => Math.max(1, Math.ceil(pexelsTotal.value / 6)))

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function typeIcon(type: string): string {
  const icons: Record<string, string> = { image: 'IMG', video: 'VID', music: 'MUS', sfx: 'SFX', map_animation: 'MAP' }
  return icons[type] ?? 'FILE'
}

function handleImgError(e: Event): void {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
  const placeholder = img.parentElement?.querySelector('.thumb-placeholder') as HTMLElement | null
  if (placeholder) placeholder.style.display = 'flex'
}

function debouncedLoad(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => loadData(true), 300)
}

async function loadData(reset = false): Promise<void> {
  loading.value = true
  try {
    if (reset) currentPage.value = 1
    const params: string[] = []
    if (typeFilter.value !== 'all') params.push(`type=${typeFilter.value}`)
    if (sortBy.value !== 'created_at') params.push(`sort_by=${sortBy.value}`)
    if (searchKeyword.value) params.push(`keyword=${encodeURIComponent(searchKeyword.value)}`)
    params.push(`page=${currentPage.value}`)
    params.push('page_size=20')
    const query = `?${params.join('&')}`
    const res = await api.get<{ items: Material[]; total: number }>(`/materials${query}`)
    materials.value = res.items
    total.value = res.total
  } catch (e) { console.error(e); toast.error('加载素材列表失败') }
  finally { loading.value = false }
}

async function loadStats(): Promise<void> {
  try { stats.value = await api.get<Stats>('/materials/stats') } catch (e) { console.error(e); toast.error('加载统计数据失败') }
}

function handleFileSelect(e: Event): void {
  const input = e.target as HTMLInputElement
  if (input.files) {
    uploadFiles.value = [...uploadFiles.value, ...Array.from(input.files)]
    input.value = ''
  }
}

function handleDrop(e: DragEvent): void {
  isDragging.value = false
  if (e.dataTransfer?.files) {
    uploadFiles.value = [...uploadFiles.value, ...Array.from(e.dataTransfer.files)]
  }
}

async function doUpload(): Promise<void> {
  uploading.value = true
  uploadProgress.value = {}
  try {
    for (let i = 0; i < uploadFiles.value.length; i++) {
      const f = uploadFiles.value[i]
      uploadProgress.value[i] = 0
      const ext = f.name.split('.').pop()?.toLowerCase()
      const typeMap: Record<string, string> = { jpg: 'image', jpeg: 'image', png: 'image', mp4: 'video', mp3: 'music', wav: 'sfx' }
      await api.post('/materials', {
        name: f.name,
        type: typeMap[ext ?? ''] ?? 'image',
        source: 'self_shot',
        file_url: URL.createObjectURL(f),
        file_size: f.size,
      })
      uploadProgress.value[i] = 100
    }
    showUploadModal.value = false
    uploadFiles.value = []
    await loadData()
    await loadStats()
  } catch (e) { console.error(e); toast.error('上传失败') }
  finally { uploading.value = false }
}

async function startGenerate(): Promise<void> {
  genProgress.value = 1
  try {
    const res = await api.post<{ task_id: string }>('/materials/generate', { type: genType.value, description: genDescription.value })
    genTaskId.value = res.task_id
    genPollTimer = setInterval(async () => {
      try {
        const status = await api.get<{ status: string; progress: number }>(`/materials/generate/${res.task_id}/status`)
        genProgress.value = status.progress
        if (status.status === 'completed' || status.status === 'failed') {
          if (genPollTimer) clearInterval(genPollTimer)
          genProgress.value = status.status === 'completed' ? 100 : 0
          if (status.status === 'completed') {
            // 确认 AI 生成素材入库
            try {
              await api.post(`/materials/generate/${res.task_id}/confirm`)
            } catch (e) { console.error(e); toast.error('确认素材入库失败') }
            toast.success('素材生成完成')
            await loadData()
            await loadStats()
            closeAiModal()
          } else {
            toast.error('生成失败，请重试')
          }
        }
      } catch (e) { console.error(e); toast.error('查询生成状态失败') }
    }, 2000)
  } catch (e) { console.error(e); genProgress.value = 0; toast.error('启动生成失败') }
}

function closeAiModal(): void {
  showAiModal.value = false
  genDescription.value = ''
  genProgress.value = 0
  genTaskId.value = null
  if (genPollTimer) { clearInterval(genPollTimer); genPollTimer = null }
}

async function searchPexels(): Promise<void> {
  if (!pexelsKeyword.value) return
  pexelsLoading.value = true
  pexelsSearched.value = true
  try {
    const res = await api.get<{ items: PexelsItem[]; total: number }>(`/materials/pexels-search?keyword=${encodeURIComponent(pexelsKeyword.value)}&type=${pexelsType.value}&page=${pexelsPage.value}&page_size=6`)
    pexelsResults.value = res.items
    pexelsTotal.value = res.total
  } catch (e) { console.error(e); toast.error('搜索素材失败') }
  finally { pexelsLoading.value = false }
}

async function importPexels(item: PexelsItem): Promise<void> {
  try {
    await api.post('/materials/pexels-import', { pexels_id: item.id, type: item.type, source_url: item.source_url })
    toast.success('导入成功')
    await loadData()
    await loadStats()
  } catch (e) { console.error(e); toast.error('导入失败') }
}

function openEdit(m: Material): void {
  editingMaterial.value = m
  editForm.name = m.name
  editForm.tags = [...m.tags]
  editForm.copyright_status = m.copyright_status
  editForm.source = m.source
  showEditModal.value = true
}

function addTag(): void {
  const tag = tagInput.value.trim()
  if (tag && !editForm.tags.includes(tag)) {
    editForm.tags.push(tag)
  }
  tagInput.value = ''
}

async function saveEdit(): Promise<void> {
  if (!editingMaterial.value) return
  try {
    await api.put(`/materials/${editingMaterial.value.id}`, {
      name: editForm.name,
      tags: editForm.tags,
      copyright_status: editForm.copyright_status,
      source: editForm.source,
    })
    showEditModal.value = false
    await loadData()
  } catch (e) { console.error(e); toast.error('保存失败') }
}

async function openDelete(m: Material): Promise<void> {
  deletingMaterial.value = m
  deleteRefCount.value = 0
  showDeleteModal.value = true
  try {
    const res = await api.get<{ count: number }>(`/materials/${m.id}/references`)
    deleteRefCount.value = res.count
  } catch (e) { console.error(e); toast.error('查询引用失败') }
}

async function confirmDelete(): Promise<void> {
  if (!deletingMaterial.value || deleteRefCount.value > 0) return
  try {
    await api.delete(`/materials/${deletingMaterial.value.id}`)
    showDeleteModal.value = false
    await loadData()
    await loadStats()
  } catch (e) { console.error(e); toast.error('删除失败') }
}

async function downloadMaterial(m: Material): Promise<void> {
  try {
    const res = await api.get<{ url: string }>(`/materials/${m.id}/download`)
    window.open(res.url, '_blank')
  } catch (e) { console.error(e); toast.error('下载失败') }
}

onMounted(() => { loadData(); loadStats() })
</script>

<style scoped>
.materials-page { max-width: 1200px; margin: 0 auto; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.title-left { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.title-left h2 { margin: 0; font-size: 22px; color: #1a1a2e; }
.stats-text { font-size: 13px; color: #999; }
.title-actions { display: flex; gap: 8px; }
.btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-primary { background: #4a6cf7; color: #fff; }
.btn-purple { background: #9333ea; color: #fff; }
.btn-outline { background: #fff; border: 1px solid #ddd; color: #333; }
.btn-danger { background: #e53935; color: #fff; }
.btn-sm { padding: 4px 12px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 12px; }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm.btn-primary { border: none; background: #4a6cf7; color: #fff; }
.filter-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.filter-tabs { display: flex; gap: 4px; }
.filter-tab { padding: 6px 16px; border: 1px solid #ddd; border-radius: 20px; background: #fff; cursor: pointer; font-size: 13px; }
.filter-tab.active { background: #4a6cf7; color: #fff; border-color: #4a6cf7; }
.filter-right { display: flex; gap: 8px; }
.sort-select { padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; background: #fff; min-width: 120px; }
.search-input { padding: 7px 14px; border: 1px solid #ddd; border-radius: 20px; font-size: 13px; outline: none; width: 220px; }
.search-input:focus { border-color: #4a6cf7; }
.material-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.material-card { background: #fff; border: 1px solid #eee; border-radius: 10px; overflow: hidden; transition: box-shadow 0.2s, border-color 0.2s; }
.material-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08); border-color: #ccc; }
.card-thumb { position: relative; height: 160px; background: #f5f5f5; overflow: hidden; }
.card-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 24px; font-weight: 700; color: #999; }
.thumb-placeholder.image { color: #22c55e; }
.thumb-placeholder.video { color: #4f46e5; }
.thumb-placeholder.music { color: #f59e0b; }
.thumb-placeholder.sfx { color: #0ea5e9; }
.thumb-placeholder.map_animation { color: #9333ea; }
.card-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; gap: 8px; opacity: 0; transition: opacity 0.2s; }
.material-card:hover .card-overlay { opacity: 1; }
.overlay-btn { padding: 6px 14px; border-radius: 4px; border: none; background: rgba(255,255,255,0.9); cursor: pointer; font-size: 12px; }
.overlay-btn.btn-del { color: #e53935; }
.card-info { padding: 8px 10px 10px; }
.card-name { font-size: 13px; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 6px; }
.card-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px; }
.tag { padding: 1px 6px; border-radius: 8px; font-size: 11px; }
.tag-type-image { background: #dcfce7; color: #16a34a; }
.tag-type-video { background: #e0e7ff; color: #4338ca; }
.tag-type-music { background: #fef3c7; color: #d97706; }
.tag-type-sfx { background: #e0f2fe; color: #0284c7; }
.tag-type-map_animation { background: #f3e8ff; color: #7c3aed; }
.tag-source-pexels { background: #dcfce7; color: #16a34a; }
.tag-source-ai_generated { background: #f3e8ff; color: #7c3aed; }
.tag-source-self_shot { background: #e0e7ff; color: #4338ca; }
.tag-source-purchased { background: #fef3c7; color: #d97706; }
.tag-copy-free_commercial { background: #dcfce7; color: #16a34a; }
.tag-copy-purchased { background: #e0e7ff; color: #4338ca; }
.tag-copy-ai_generated { background: #f3e8ff; color: #7c3aed; }
.card-meta { display: flex; gap: 12px; font-size: 11px; color: #999; margin-top: 4px; }
.card-custom-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.custom-tag { padding: 1px 6px; border-radius: 8px; font-size: 11px; background: #f5f5f5; color: #666; }
.custom-tag.removable { cursor: pointer; }
.custom-tag.removable:hover { background: #fee2e2; color: #e53935; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 20px; }
.page-info { font-size: 13px; color: #999; }
.empty-state, .loading { text-align: center; padding: 60px; color: #999; background: #fff; border-radius: 10px; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #fff; border-radius: 12px; width: 480px; }
.dialog-lg { width: 560px; }
.dialog-md { width: 480px; }
.dialog-xl { width: 720px; }
.dialog-sm { width: 400px; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; }
.dialog-header h3 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px; }
.dialog-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.dialog-body { padding: 20px; }
.form-field { margin-bottom: 16px; }
.form-field label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; font-weight: 500; }
.form-field input, .form-field select { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.form-field input:focus, .form-field select:focus { outline: none; border-color: #4a6cf7; }
.form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
.badge-pexels { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #dcfce7; color: #16a34a; font-weight: 400; }
.text-danger { color: #e53935; }
.upload-drop-zone { border: 2px dashed #ccc; border-radius: 10px; padding: 40px; text-align: center; transition: all 0.2s; }
.upload-drop-zone.dragging { border-color: #4a6cf7; background: rgba(74,108,247,0.02); }
.drop-icon { font-size: 40px; color: #ccc; margin-bottom: 8px; }
.upload-drop-zone p { margin: 0 0 4px; font-size: 14px; color: #666; }
.upload-drop-zone span { font-size: 12px; color: #999; display: block; margin-bottom: 12px; }
.upload-list { margin-top: 16px; }
.upload-item { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; }
.upload-name { flex: 1; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.upload-size { color: #999; }
.upload-progress { color: #4a6cf7; font-weight: 500; }
.type-toggle { display: flex; gap: 0; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; width: fit-content; }
.toggle-btn { padding: 6px 16px; border: none; background: #fff; cursor: pointer; font-size: 13px; }
.toggle-btn.active { background: #4a6cf7; color: #fff; }
.gen-textarea { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical; min-height: 100px; box-sizing: border-box; }
.gen-textarea:focus { outline: none; border-color: #9333ea; }
.gen-progress { margin-bottom: 16px; font-size: 13px; color: #666; display: flex; align-items: center; gap: 8px; }
.progress-bar { flex: 1; height: 6px; background: #eee; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 3px; transition: width 0.3s; background: #4a6cf7; }
.progress-fill.purple { background: #9333ea; }
.pexels-controls { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pexels-search-row { display: flex; gap: 8px; flex: 1; }
.pexels-search-row .search-input { flex: 1; width: auto; }
.pexels-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
.pexels-card { position: relative; border-radius: 8px; overflow: hidden; height: 150px; }
.pexels-card img { width: 100%; height: 100%; object-fit: cover; }
.pexels-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; }
.pexels-card:hover .pexels-overlay { opacity: 1; }
.pexels-info { position: absolute; bottom: 0; left: 0; right: 0; padding: 4px 8px; background: linear-gradient(transparent, rgba(0,0,0,0.6)); color: #fff; font-size: 11px; display: flex; justify-content: space-between; }
.pexels-pagination { display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 13px; color: #999; }
.pexels-notice { font-size: 12px; color: #999; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0; }
.empty-state-sm { text-align: center; padding: 40px; color: #999; }
.tags-input-wrap { border: 1px solid #ddd; border-radius: 6px; padding: 8px; }
.tags-input-wrap input { width: 100%; border: none; outline: none; font-size: 13px; padding: 0; }
.tags-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
</style>
