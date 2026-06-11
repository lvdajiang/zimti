<template>
  <div class="knowledge-page">
    <div class="toolbar">
      <h2 class="page-title">知识库 <HelpTip title="知识库使用指引" :steps="[
        '「创作素材」收藏文案、金句、脚本片段等创作参考',
        '「品牌知识」管理企业知识（产品、路线、FAQ），AI 生成 GEO 内容时自动注入',
        '支持按分类和标签组织内容，方便查找',
        'AI 生成脚本时会参考知识库中的相关内容',
      ]" /></h2>
    </div>

    <!-- Tab 切换 -->
    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'materials' }" @click="activeTab = 'materials'">创作素材</button>
      <button class="tab" :class="{ active: activeTab === 'brand' }" @click="activeTab = 'brand'">品牌知识</button>
    </div>

    <!-- ========== Tab1: 创作素材 ========== -->
    <template v-if="activeTab === 'materials'">
      <div class="filters">
        <input v-model="matKeyword" class="input" placeholder="搜索标题或内容..." style="width:240px" @keyup.enter="loadMaterials" />
        <select v-model="matCategory" class="input" style="width:140px" @change="loadMaterials">
          <option value="all">全部分类</option>
          <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <button class="btn-primary" @click="openMaterialForm()">+ 收藏内容</button>
      </div>

      <div v-if="matLoading" class="loading">加载中...</div>
      <div v-else-if="matItems.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">暂无收藏内容</div>
      </div>
      <div v-else class="item-list">
        <div v-for="item in matItems" :key="item.id" class="item-card">
          <div class="item-header">
            <span class="item-category" :class="'cat-' + item.category">{{ getCategoryLabel(item.category) }}</span>
            <span class="item-source">{{ item.source }}</span>
            <span class="item-date">{{ formatDate(item.updated_at) }}</span>
            <div class="item-actions">
              <button class="btn-link" @click="editMaterial(item)">编辑</button>
              <button class="btn-link btn-danger" @click="handleDelete(item.id)">删除</button>
            </div>
          </div>
          <div class="item-title">{{ item.title }}</div>
          <div class="item-content">{{ truncate(item.content, 200) }}</div>
          <div v-if="item.tags.length" class="item-tags">
            <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
      <div v-if="matTotal > matPageSize" class="pagination">
        <button :disabled="matPage <= 1" @click="matPage--; loadMaterials()">上一页</button>
        <span class="page-info">{{ matPage }} / {{ Math.ceil(matTotal / matPageSize) }}</span>
        <button :disabled="matPage >= Math.ceil(matTotal / matPageSize)" @click="matPage++; loadMaterials()">下一页</button>
      </div>

      <!-- 创作素材弹窗 -->
      <div v-if="showMaterialForm" class="modal-overlay" @click.self="showMaterialForm = false">
        <div class="modal">
          <h3 class="modal-title">{{ materialEditingId ? '编辑内容' : '收藏内容' }}</h3>
          <div class="form-group"><label>标题 *</label><input v-model="matForm.title" class="input" maxlength="200" /></div>
          <div class="form-group"><label>内容 *</label><textarea v-model="matForm.content" class="input" rows="6" /></div>
          <div class="form-row">
            <div class="form-group"><label>来源</label><select v-model="matForm.source" class="input">
              <option v-for="s in sourceOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select></div>
            <div class="form-group"><label>分类</label><select v-model="matForm.category" class="input">
              <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select></div>
          </div>
          <div class="form-group"><label>标签</label>
            <div class="tags-input">
              <span v-for="(tag, i) in matForm.tags" :key="i" class="tag tag-rm">{{ tag }} <button @click="matForm.tags.splice(i, 1)">&times;</button></span>
              <input class="tags-field" placeholder="回车添加" @keyup.enter="addMatTag" />
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn" @click="showMaterialForm = false">取消</button>
            <button class="btn-primary" :disabled="matSubmitting" @click="submitMaterial">{{ matSubmitting ? '提交中...' : '确定' }}</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== Tab2: 品牌知识 ========== -->
    <template v-if="activeTab === 'brand'">
      <div class="filter-bar">
        <div class="category-pills">
          <button class="pill" :class="{ active: brandCategory === 'all' }" @click="brandCategory = 'all'; loadBrand()">全部</button>
          <button v-for="(label, key) in brandCategoryLabels" :key="key" class="pill" :class="{ active: brandCategory === key }" @click="brandCategory = key as string; loadBrand()">{{ label }}</button>
        </div>
        <button class="btn-primary" :disabled="brandGenerating" @click="handleGenerateBrand">AI 生成</button>
        <button class="btn" :disabled="brandSearching" @click="showSearchPanel = !showSearchPanel">🔍 全网搜索</button>
        <button class="btn" @click="showBrandForm = true">手动添加</button>
      </div>

      <!-- 全网搜索建库 -->
      <div v-if="showSearchPanel" class="card search-panel">
        <div class="form-group"><label>搜索主题</label><input v-model="searchTopic" class="input" placeholder="如：新疆旅游攻略..." @keyup.enter="handleSearchBuild" /></div>
        <div class="form-row">
          <div class="form-group"><label>分类</label><select v-model="searchCategory" class="input">
            <option value="">自动分类</option><option v-for="(label, key) in brandCategoryLabels" :key="key" :value="key">{{ label }}</option>
          </select></div>
          <div class="form-group"><label>数量</label><input v-model.number="searchCount" type="number" class="input" min="1" max="10" /></div>
          <div class="form-group btn-group"><button class="btn-primary" :disabled="brandSearching || !searchTopic.trim()" @click="handleSearchBuild">{{ brandSearching ? '搜索中...' : '⚡ 搜索建库' }}</button></div>
        </div>
      </div>

      <!-- 添加品牌知识 -->
      <div v-if="showBrandForm" class="card form-card">
        <div class="form-group"><label>标题</label><input v-model="brandForm.title" class="input" placeholder="知识标题" /></div>
        <div class="form-group"><label>正文</label><textarea v-model="brandForm.content" class="input" rows="5" placeholder="知识内容..." /></div>
        <div class="form-row">
          <div class="form-group"><label>分类</label><select v-model="brandForm.category" class="input">
            <option v-for="(label, key) in brandCategoryLabels" :key="key" :value="key">{{ label }}</option>
          </select></div>
          <div class="form-group"><label>标签（逗号分隔）</label><input v-model="brandForm.tagsStr" class="input" placeholder="标签1,标签2" /></div>
        </div>
        <div class="form-actions">
          <button class="btn-primary" @click="handleAddBrand">添加</button>
          <button class="btn" @click="showBrandForm = false">取消</button>
        </div>
      </div>

      <!-- 品牌知识列表 -->
      <div v-if="brandLoading" class="loading">加载中...</div>
      <div v-else-if="brandItems.length === 0" class="empty-state">
        <div class="empty-text">暂无品牌知识。添加后 AI 生成 GEO 内容时会自动注入。</div>
      </div>
      <div v-else class="knowledge-list">
        <div v-for="item in brandItems" :key="item.id" class="card knowledge-card" :class="{ inactive: !item.is_active }">
          <div class="knowledge-header">
            <span class="knowledge-badge" :class="item.category">{{ brandCategoryLabels[item.category] || item.category }}</span>
            <span class="knowledge-source">{{ item.source === 'ai_generated' ? 'AI生成' : '手动' }}</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="item.is_active" @change="toggleBrand(item.id, !item.is_active)" />
              <span class="toggle-text">{{ item.is_active ? '启用' : '停用' }}</span>
            </label>
          </div>
          <div class="knowledge-title">{{ item.title }}</div>
          <div class="knowledge-content">{{ truncate(item.content, 200) }}</div>
          <div v-if="item.tags?.length" class="knowledge-tags"><span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span></div>
          <div class="knowledge-actions"><button class="btn btn-sm btn-danger" @click="handleDeleteBrand(item.id)">删除</button></div>
        </div>
      </div>
      <div class="brand-footer-links">
        <router-link to="/geo/build" class="link">🔧 构建引擎</router-link>
        <router-link to="/geo/fact-extract" class="link">📋 事实提取</router-link>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import HelpTip from '@/components/HelpTip.vue'
import { formatDate } from '@/utils/format'
import { toast } from '@/utils/toast'
import { fetchKnowledge, createKnowledge, updateKnowledge, deleteKnowledge, type KnowledgeItem } from '@/api/knowledge'
import {
  fetchGeoKnowledge, createGeoKnowledge, updateGeoKnowledge, deleteGeoKnowledge,
  generateGeoKnowledge, getGenerateKnowledgeStatus, searchAndBuildKnowledge, getSearchAndBuildStatus,
  type BrandKnowledgeItem,
} from '@/api/geo'
import type { BrandKnowledgeCategory } from '@zimti/shared'

// ========== 通用 ==========
const activeTab = ref<'materials' | 'brand'>('materials')

function truncate(text: string, len: number): string {
  return text.length > len ? text.slice(0, len) + '...' : text
}

// ========== 创作素材 Tab ==========
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

const matItems = ref<KnowledgeItem[]>([])
const matLoading = ref(false)
const matKeyword = ref('')
const matCategory = ref('all')
const matPage = ref(1)
const matPageSize = 20
const matTotal = ref(0)
const showMaterialForm = ref(false)
const materialEditingId = ref<string | null>(null)
const matSubmitting = ref(false)
const matForm = ref({ title: '', content: '', source: 'manual', category: 'other', tags: [] as string[] })

function getCategoryLabel(val: string): string {
  return categories.find(c => c.value === val)?.label ?? val
}

function addMatTag(e: Event) {
  const input = e.target as HTMLInputElement
  const val = input.value.trim()
  if (val && !matForm.value.tags.includes(val)) matForm.value.tags.push(val)
  input.value = ''
}

function openMaterialForm() {
  materialEditingId.value = null
  matForm.value = { title: '', content: '', source: 'manual', category: 'other', tags: [] }
  showMaterialForm.value = true
}

async function loadMaterials() {
  matLoading.value = true
  try {
    const res = await fetchKnowledge({ category: matCategory.value, keyword: matKeyword.value, page: matPage.value, page_size: matPageSize })
    matItems.value = res.items
    matTotal.value = res.total
  } catch { toast.error('加载失败') }
  finally { matLoading.value = false }
}

function editMaterial(item: KnowledgeItem) {
  materialEditingId.value = item.id
  matForm.value = { title: item.title, content: item.content, source: item.source, category: item.category, tags: [...item.tags] }
  showMaterialForm.value = true
}

async function submitMaterial() {
  if (!matForm.value.title.trim() || !matForm.value.content.trim()) {
    toast.warning('标题和内容不能为空'); return
  }
  matSubmitting.value = true
  try {
    if (materialEditingId.value) {
      await updateKnowledge(materialEditingId.value, matForm.value)
      toast.success('更新成功')
    } else {
      await createKnowledge(matForm.value)
      toast.success('收藏成功')
    }
    showMaterialForm.value = false
    await loadMaterials()
  } catch { toast.error(materialEditingId.value ? '更新失败' : '收藏失败') }
  finally { matSubmitting.value = false }
}

async function handleDelete(id: string) {
  try { await deleteKnowledge(id); toast.success('已删除'); await loadMaterials() }
  catch { toast.error('删除失败') }
}

// ========== 品牌知识 Tab ==========
const brandCategoryLabels: Record<string, string> = {
  brand_intro: '产品介绍',
  route: '路线特色',
  service: '服务承诺',
  case: '案例故事',
  faq: '常见问答',
  industry: '行业知识',
}

const brandItems = ref<BrandKnowledgeItem[]>([])
const brandLoading = ref(false)
const brandCategory = ref<string>('all')
const brandGenerating = ref(false)
const brandSearching = ref(false)
const showSearchPanel = ref(false)
const showBrandForm = ref(false)

const searchTopic = ref('')
const searchCategory = ref('')
const searchCount = ref(5)

const brandForm = ref({ title: '', content: '', category: 'brand_intro' as BrandKnowledgeCategory, tagsStr: '' })

async function loadBrand() {
  brandLoading.value = true
  try {
    const res = await fetchGeoKnowledge({ category: brandCategory.value })
    brandItems.value = res.items
  } catch { toast.error('加载品牌知识失败') }
  finally { brandLoading.value = false }
}

async function handleAddBrand() {
  if (!brandForm.value.title.trim() || !brandForm.value.content.trim()) {
    toast.warning('标题和内容不能为空'); return
  }
  try {
    await createGeoKnowledge({
      title: brandForm.value.title,
      content: brandForm.value.content,
      category: brandForm.value.category,
      tags: brandForm.value.tagsStr ? brandForm.value.tagsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : undefined,
    })
    toast.success('添加成功')
    showBrandForm.value = false
    brandForm.value = { title: '', content: '', category: 'brand_intro', tagsStr: '' }
    await loadBrand()
  } catch { toast.error('添加失败') }
}

async function toggleBrand(id: string, isActive: boolean) {
  try { await updateGeoKnowledge(id, { is_active: isActive }); await loadBrand() }
  catch { toast.error('更新失败') }
}

async function handleDeleteBrand(id: string) {
  try { await deleteGeoKnowledge(id); toast.success('已删除'); await loadBrand() }
  catch { toast.error('删除失败') }
}

async function handleGenerateBrand() {
  brandGenerating.value = true
  try {
    const res = await generateGeoKnowledge({ count: 5 })
    toast.success('AI 生成已启动')
    // 轮询完成
    const poll = async () => {
      const status = await getGenerateKnowledgeStatus(res.task_id)
      if (status.status === 'completed') {
        brandGenerating.value = false
        toast.success('生成完成')
        await loadBrand()
      } else {
        setTimeout(poll, 2000)
      }
    }
    poll()
  } catch { brandGenerating.value = false; toast.error('AI 生成失败') }
}

async function handleSearchBuild() {
  if (!searchTopic.value.trim()) return
  brandSearching.value = true
  try {
    const res = await searchAndBuildKnowledge({
      topic: searchTopic.value,
      category: (searchCategory.value || undefined) as BrandKnowledgeCategory | undefined,
      count: searchCount.value,
    })
    // 轮询
    const poll = async () => {
      const result = await getSearchAndBuildStatus(res.task_id)
      if (result.status === 'completed') {
        brandSearching.value = false
        toast.success(`搜索完成，写入 ${result.output?.created_count || 0} 条知识`)
        await loadBrand()
      } else {
        setTimeout(poll, 2000)
      }
    }
    if (res.task_id) poll()
  } catch { brandSearching.value = false; toast.error('搜索建库失败') }
}

onMounted(() => { loadMaterials() })
</script>

<style scoped>
.knowledge-page { max-width: 960px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
.page-title { font-size: var(--font-size-xl); font-weight: 600; margin: 0; }

/* Tabs */
.tabs { display: flex; gap: 0; margin-bottom: var(--space-4); border-bottom: 2px solid var(--color-border); }
.tab { padding: 8px 20px; font-size: 14px; border: none; background: transparent; color: var(--color-text-secondary); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); font-weight: 600; }

/* Filters */
.filters { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); align-items: center; flex-wrap: wrap; }

/* Inputs */
.input { padding: 6px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: var(--font-size-sm); outline: none; background: var(--color-surface); color: var(--color-text); }
.input:focus { border-color: #4fc3f7; }
select.input { cursor: pointer; }

/* Buttons */
.btn-primary { padding: 6px var(--space-4); background: #4fc3f7; color: var(--color-bg); border: none; border-radius: var(--radius); font-size: var(--font-size-sm); cursor: pointer; }
.btn-primary:hover { background: #39b0e0; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn { padding: 6px var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); color: var(--color-text); font-size: var(--font-size-sm); cursor: pointer; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-danger { color: var(--color-danger); border-color: var(--color-danger); }
.btn-link { background: none; border: none; color: #4fc3f7; font-size: var(--font-size-xs); cursor: pointer; padding: 0 var(--space-1); }
.btn-danger { color: #EF4444; }

/* Loading / Empty */
.loading { display: flex; justify-content: center; padding: 60px; color: var(--color-text-tertiary); }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 60px var(--space-5); color: var(--color-text-tertiary); }
.empty-icon { font-size: 40px; margin-bottom: var(--space-3); }

/* Pagination */
.pagination { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-4); font-size: var(--font-size-sm); }
.page-info { color: var(--color-text-tertiary); }

/* ========== 创作素材卡片 ========== */
.item-list { display: flex; flex-direction: column; gap: var(--space-3); }
.item-card { background: var(--color-bg); border-radius: var(--radius); padding: var(--space-4); border: 1px solid var(--color-border-light); }
.item-header { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: var(--space-2); flex-wrap: wrap; }
.item-category { padding: 1px 6px; border-radius: var(--radius-sm); font-size: var(--font-size-xs); color: var(--color-bg); display: inline-block; }
.cat-copy_template { background: #6366f1; }
.cat-hook { background: #F59E0B; }
.cat-golden_sentence { background: #10b981; }
.cat-research { background: #3b82f6; }
.cat-script_fragment { background: #8b5cf6; }
.cat-other { background: #6b7280; }
.item-source { background: #f3f4f6; padding: 1px 6px; border-radius: var(--radius-sm); }
.item-actions { margin-left: auto; display: flex; gap: var(--space-1); }
.item-title { font-size: var(--font-size-md); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-1); }
.item-content { font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.6; }
.item-tags { margin-top: var(--space-2); display: flex; gap: var(--space-1); flex-wrap: wrap; }
.tag { display: inline-block; padding: 1px var(--space-2); background: #f0f5ff; color: #6366f1; border-radius: var(--radius-sm); font-size: var(--font-size-xs); }
.tag-rm { display: inline-flex; align-items: center; gap: 2px; }
.tag-rm button { background: none; border: none; color: var(--color-text-tertiary); cursor: pointer; font-size: 14px; padding: 0; line-height: 1; }
.tags-input { display: flex; flex-wrap: wrap; gap: var(--space-1); padding: 6px; border: 1px solid var(--color-border); border-radius: var(--radius); align-items: center; min-height: 36px; background: var(--color-surface); }
.tags-field { border: none; outline: none; font-size: var(--font-size-sm); flex: 1; min-width: 80px; background: transparent; color: var(--color-text); }
.form-group { margin-bottom: var(--space-4); }
.form-group label { display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1); }
.form-group .input { width: 100%; box-sizing: border-box; }
.form-group textarea.input { resize: vertical; }
.form-row { display: flex; gap: var(--space-3); }
.form-row .form-group { flex: 1; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: var(--color-bg); border-radius: var(--radius-lg); padding: var(--space-6); width: 520px; max-height: 80vh; overflow-y: auto; }
.modal-title { margin: 0 0 var(--space-5); font-size: var(--font-size-lg); font-weight: 600; }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-5); }

/* ========== 品牌知识 ========== */
.filter-bar { display: flex; gap: 8px; margin-bottom: var(--space-4); flex-wrap: wrap; align-items: center; }
.category-pills { display: flex; gap: 4px; flex-wrap: wrap; }
.pill { padding: 4px 12px; border: 1px solid var(--color-border); border-radius: 16px; background: transparent; font-size: 12px; color: var(--color-text-secondary); cursor: pointer; }
.pill.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 14px; margin-bottom: 12px; }
.search-panel { max-width: 600px; }
.form-card { max-width: 600px; }
.form-actions { display: flex; gap: 8px; margin-top: 12px; }
.knowledge-list { display: flex; flex-direction: column; gap: 12px; }
.knowledge-card { position: relative; }
.knowledge-card.inactive { opacity: 0.55; }
.knowledge-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 12px; }
.knowledge-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; color: #fff; }
.knowledge-badge.brand_intro { background: #6366f1; }
.knowledge-badge.route { background: #10b981; }
.knowledge-badge.service { background: #3b82f6; }
.knowledge-badge.case { background: #f59e0b; }
.knowledge-badge.faq { background: #ef4444; }
.knowledge-badge.industry { background: #8b5cf6; }
.knowledge-source { background: #f3f4f6; padding: 1px 6px; border-radius: 4px; }
.toggle-label { display: flex; align-items: center; gap: 4px; margin-left: auto; cursor: pointer; }
.toggle-text { font-size: 11px; }
.knowledge-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.knowledge-content { font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }
.knowledge-tags { margin-top: 8px; }
.knowledge-actions { margin-top: 8px; }
.btn-group { display: flex; align-items: flex-end; }
.brand-footer-links { display: flex; gap: 16px; margin-top: 16px; padding: 12px; border-top: 1px solid var(--color-border); }
.link { font-size: 13px; color: var(--color-text-secondary); text-decoration: none; }
.link:hover { color: var(--color-primary); }
</style>
