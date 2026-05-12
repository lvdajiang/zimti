<template>
  <div class="knowledge">
    <div class="toolbar">
      <h2 class="page-title">知识库 <HelpTip title="知识库使用指引" :steps="[
        '收藏有价值的创作经验、行业知识、竞品分析等内容',
        '支持按分类和标签组织内容，方便查找',
        'AI 生成脚本时会参考知识库中的相关内容',
        '搜索框支持标题和正文内容检索',
      ]" /></h2>
      <button class="btn-primary" @click="openModal()">+ 收藏内容</button>
    </div>

    <div class="filters">
      <input
        v-model="keyword"
        class="input"
        placeholder="搜索标题或内容..."
        style="width: 240px"
        @keyup.enter="loadData"
      />
      <select v-model="category" class="input" style="width: 140px" @change="loadData">
        <option value="all">全部分类</option>
        <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
    </div>

    <div v-if="loading" class="loading-wrapper">加载中...</div>
    <div v-else-if="items.length === 0" class="empty-state">
      <div class="empty-icon">📭</div>
      <div class="empty-text">暂无收藏内容</div>
    </div>
    <div v-else class="item-list">
      <div v-for="item in items" :key="item.id" class="item-card">
        <div class="item-header">
          <span class="item-category" :class="'cat-' + item.category">{{ getCategoryLabel(item.category) }}</span>
          <span class="item-source">{{ item.source }}</span>
          <span class="item-date">{{ formatDate(item.updated_at) }}</span>
          <div class="item-actions">
            <button class="btn-link" @click="editItem(item)">编辑</button>
            <button class="btn-link btn-danger" @click="handleDelete(item.id)">删除</button>
          </div>
        </div>
        <div class="item-title">{{ item.title }}</div>
        <div class="item-content">{{ item.content.length > 200 ? item.content.slice(0, 200) + '...' : item.content }}</div>
        <div v-if="item.tags.length" class="item-tags">
          <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </div>

    <div v-if="total > pageSize" class="pagination">
      <button :disabled="page <= 1" @click="page--; loadData()">上一页</button>
      <span class="page-info">{{ page }} / {{ Math.ceil(total / pageSize) }}</span>
      <button :disabled="page >= Math.ceil(total / pageSize)" @click="page++; loadData()">下一页</button>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <h3 class="modal-title">{{ editingId ? '编辑内容' : '收藏内容' }}</h3>
        <div class="form-group">
          <label>标题 *</label>
          <input v-model="form.title" class="input" placeholder="输入标题" maxlength="200" />
        </div>
        <div class="form-group">
          <label>内容 *</label>
          <textarea v-model="form.content" class="input" rows="6" placeholder="粘贴或输入内容" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>来源</label>
            <select v-model="form.source" class="input">
              <option v-for="s in sourceOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>分类</label>
            <select v-model="form.category" class="input">
              <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>标签（回车添加）</label>
          <div class="tags-input">
            <span v-for="(tag, i) in form.tags" :key="i" class="tag tag-removable">
              {{ tag }} <button @click="form.tags.splice(i, 1)">&times;</button>
            </span>
            <input
              class="tags-input-field"
              placeholder="输入后按回车"
              @keyup.enter="addTag"
            />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showModal = false">取消</button>
          <button class="btn-primary" :disabled="submitting" @click="handleSubmit">
            {{ submitting ? '提交中...' : '确定' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import HelpTip from '@/components/HelpTip.vue'
import { formatDate } from '@/utils/format'
import { toast } from '@/utils/toast'
import { fetchKnowledge, createKnowledge, updateKnowledge, deleteKnowledge, type KnowledgeItem } from '@/api/knowledge'

const categories = [
  { value: 'copy_template', label: '文案模板' },
  { value: 'hook', label: '开头钩子' },
  { value: 'golden_sentence', label: '金句' },
  { value: 'research', label: '研究素材' },
  { value: 'script_fragment', label: '脚本片段' },
  { value: 'other', label: '其他' },
]

const sourceOptions = [
  { value: 'manual', label: '手动输入' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'doubao', label: '豆包' },
  { value: 'kimi', label: 'Kimi' },
  { value: 'jimeng', label: '即梦AI' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'claude', label: 'Claude' },
  { value: 'other', label: '其他' },
]

const items = ref<KnowledgeItem[]>([])
const loading = ref(false)
const keyword = ref('')
const category = ref('all')
const page = ref(1)
const pageSize = 20
const total = ref(0)

const showModal = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)
const form = ref({ title: '', content: '', source: 'manual', category: 'other', tags: [] as string[] })

function getCategoryLabel(val: string): string {
  return categories.find((c) => c.value === val)?.label ?? val
}

function addTag(e: Event) {
  const input = e.target as HTMLInputElement
  const val = input.value.trim()
  if (val && !form.value.tags.includes(val)) {
    form.value.tags.push(val)
  }
  input.value = ''
}

function openModal() {
  editingId.value = null
  form.value = { title: '', content: '', source: 'manual', category: 'other', tags: [] }
  showModal.value = true
}

async function loadData() {
  loading.value = true
  try {
    const res = await fetchKnowledge({ category: category.value, keyword: keyword.value, page: page.value, page_size: pageSize })
    items.value = res.items
    total.value = res.total
  } catch {
    toast.error('加载知识库失败')
  } finally {
    loading.value = false
  }
}

function editItem(item: KnowledgeItem) {
  editingId.value = item.id
  form.value = { title: item.title, content: item.content, source: item.source, category: item.category, tags: [...item.tags] }
  showModal.value = true
}

async function handleSubmit() {
  if (!form.value.title.trim() || !form.value.content.trim()) {
    toast.warning('标题和内容不能为空')
    return
  }
  submitting.value = true
  try {
    if (editingId.value) {
      await updateKnowledge(editingId.value, form.value)
      toast.success('更新成功')
    } else {
      await createKnowledge(form.value)
      toast.success('收藏成功')
    }
    showModal.value = false
    editingId.value = null
    form.value = { title: '', content: '', source: 'manual', category: 'other', tags: [] }
    await loadData()
  } catch {
    toast.error(editingId.value ? '更新失败' : '收藏失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id: string) {
  try {
    await deleteKnowledge(id)
    toast.success('已删除')
    await loadData()
  } catch {
    toast.error('删除失败')
  }
}

onMounted(loadData)
</script>

<style scoped>
.knowledge { max-width: 960px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 600; margin: 0; }
.filters { display: flex; gap: 12px; margin-bottom: 16px; }
.input { padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 6px; font-size: 13px; outline: none; }
.input:focus { border-color: #4fc3f7; }
.loading-wrapper { display: flex; justify-content: center; padding: 60px; color: #999; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 60px 20px; color: #999; }
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-text { font-size: 14px; }
.item-list { display: flex; flex-direction: column; gap: 12px; }
.item-card { background: #fff; border-radius: 8px; padding: 16px; border: 1px solid #eee; }
.item-header { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #999; margin-bottom: 8px; }
.item-category { padding: 1px 6px; border-radius: 4px; font-size: 11px; color: #fff; }
.cat-copy_template { background: #6366f1; }
.cat-hook { background: #f59e0b; }
.cat-golden_sentence { background: #10b981; }
.cat-research { background: #3b82f6; }
.cat-script_fragment { background: #8b5cf6; }
.cat-other { background: #6b7280; }
.item-source { background: #f3f4f6; padding: 1px 6px; border-radius: 4px; }
.item-actions { margin-left: auto; display: flex; gap: 4px; }
.btn-primary { padding: 6px 16px; background: #4fc3f7; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-primary:hover { background: #39b0e0; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-link { background: none; border: none; color: #4fc3f7; font-size: 12px; cursor: pointer; padding: 0 4px; }
.btn-danger { color: #ff4d4f; }
.item-title { font-size: 15px; font-weight: 500; color: #333; margin-bottom: 4px; }
.item-content { font-size: 13px; color: #666; line-height: 1.6; }
.item-tags { margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap; }
.tag { display: inline-block; padding: 1px 8px; background: #f0f5ff; color: #6366f1; border-radius: 4px; font-size: 11px; }
.tag-removable { display: inline-flex; align-items: center; gap: 2px; }
.tag-removable button { background: none; border: none; color: #999; cursor: pointer; font-size: 14px; padding: 0; line-height: 1; }
.pagination { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 16px; font-size: 13px; }
.page-info { color: #999; }
.btn { padding: 6px 16px; border: 1px solid #d9d9d9; border-radius: 6px; background: #fff; font-size: 13px; cursor: pointer; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 12px; padding: 24px; width: 520px; max-height: 80vh; overflow-y: auto; }
.modal-title { margin: 0 0 20px; font-size: 16px; font-weight: 600; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; color: #666; margin-bottom: 4px; }
.form-group .input { width: 100%; box-sizing: border-box; }
.form-group textarea.input { resize: vertical; }
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
.tags-input { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; border: 1px solid #d9d9d9; border-radius: 6px; align-items: center; min-height: 36px; }
.tags-input-field { border: none; outline: none; font-size: 13px; flex: 1; min-width: 80px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
</style>
