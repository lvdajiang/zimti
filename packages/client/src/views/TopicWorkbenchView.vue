<template>
  <div class="topic-page">
    <div class="title-bar">
      <h2>选题工作台</h2>
      <HelpTip title="选题工作台使用指引" :steps="[
        '点击「+ 新建选题」手动创建，或通过热点追踪页推荐自动生成',
        '每个选题可关联热点和爆款视频，用于后续分析',
        '点击选题卡片上的「编辑脚本」进入脚本编辑器，开始写视频脚本',
        '脚本确认后会自动生成视频产品，可在视频预览页查看',
      ]" />
      <button class="btn btn-primary" @click="showCreate = true">+ 新建选题</button>
    </div>

    <!-- 搜索与筛选栏 -->
    <div class="filter-bar">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索选题标题..."
        @input="onSearchInput"
      />
      <div class="status-tabs">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          class="tab-btn"
          :class="{ active: currentStatus === tab.value }"
          @click="currentStatus = tab.value; page = 1; loadProposals()"
        >{{ tab.label }}</button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="proposals.length === 0" class="empty-state"><p>暂无选题，点击上方按钮新建或AI生成</p></div>
    <div v-else>
      <div class="proposal-grid">
        <div v-for="p in proposals" :key="p.id" class="proposal-card" :class="{ selected: p.status === 'selected' }">
          <!-- 状态标签 -->
          <div class="card-status" :class="statusClass(p.status)">{{ statusLabel(p.status) }}</div>

          <h4 class="card-title">{{ p.title }}</h4>

          <!-- 关键词标签 -->
          <div v-if="p.keywords && p.keywords.length > 0" class="keywords-row">
            <span v-for="(kw, i) in p.keywords" :key="i" class="keyword-tag">{{ kw }}</span>
          </div>

          <!-- 内容角度 -->
          <div v-if="p.angle" class="skeleton-item"><strong>角度:</strong> {{ p.angle }}</div>

          <div class="skeleton-preview">
            <div v-if="skeleton(p).hook" class="skeleton-item"><strong>钩子:</strong> {{ skeleton(p).hook }}</div>
            <div v-if="skeleton(p).main_points.length > 0" class="skeleton-item">
              <strong>要点:</strong>
              <span v-for="(pt, i) in skeleton(p).main_points.slice(0, 3)" :key="i">{{ pt }}{{ i < Math.min(skeleton(p).main_points.length, 3) - 1 ? '、' : '' }}</span>
            </div>
            <div v-if="skeleton(p).visual_direction" class="skeleton-item"><strong>画面:</strong> {{ skeleton(p).visual_direction }}</div>
          </div>

          <div class="card-meta">
            <span>口语比 {{ Math.round(p.voice_ratio * 100) }}%</span>
            <span>关联视频 {{ p.video_count ?? p.video_ids?.length ?? 0 }}</span>
          </div>

          <div class="card-actions">
            <button v-if="p.status !== 'selected' && p.status !== 'confirmed'" class="btn-sm btn-confirm" @click="changeStatus(p.id, 'confirmed')">确认</button>
            <button v-if="p.status !== 'discarded'" class="btn-sm btn-discard" @click="changeStatus(p.id, 'discarded')">废弃</button>
            <button v-if="p.status === 'discarded'" class="btn-sm btn-restore" @click="changeStatus(p.id, 'pending')">恢复</button>
            <button v-if="p.status !== 'selected'" class="btn-sm" @click="selectProposal(p.id)">选用</button>
            <button class="btn-sm btn-edit" @click="openEdit(p)">编辑</button>
            <button class="btn-sm" @click="goToScript(p)">编辑脚本</button>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="pagination">
        <span class="page-info">共 {{ total }} 条 第 {{ page }}/{{ totalPages }} 页</span>
        <button class="btn-sm" :disabled="page <= 1" @click="page--; loadProposals()">上一页</button>
        <button class="btn-sm" :disabled="page >= totalPages" @click="page++; loadProposals()">下一页</button>
      </div>
    </div>

    <!-- 新建选题弹窗 -->
    <div v-if="showCreate" class="overlay" @click.self="showCreate = false">
      <div class="dialog">
        <div class="dialog-header"><h3>新建选题</h3><button class="dialog-close" @click="showCreate = false">&times;</button></div>
        <div class="dialog-body">
          <div class="form-field"><label>选题标题 <span class="required">*</span></label><input v-model="createForm.title" placeholder="请输入选题标题" /></div>
          <div class="form-field"><label>钩子（开头吸引力）</label><input v-model="createForm.hook" placeholder="开头吸引点" /></div>
          <div class="form-field"><label>主要观点（逗号分隔）</label><input v-model="createForm.main_points" placeholder="观点1, 观点2, 观点3" /></div>
          <div class="form-field"><label>画面方向</label><input v-model="createForm.visual_direction" placeholder="画面风格方向" /></div>
          <div class="form-field"><label>口语比例</label><input v-model.number="createForm.voice_ratio" type="range" min="0" max="1" step="0.1" /><span>{{ Math.round(createForm.voice_ratio * 100) }}%</span></div>
          <div class="form-actions"><button class="btn btn-primary" @click="createProposal">创建</button><button class="btn" @click="showCreate = false">取消</button></div>
        </div>
      </div>
    </div>

    <!-- 编辑选题弹窗 -->
    <div v-if="showEdit" class="overlay" @click.self="showEdit = false">
      <div class="dialog">
        <div class="dialog-header"><h3>编辑选题</h3><button class="dialog-close" @click="showEdit = false">&times;</button></div>
        <div class="dialog-body">
          <div class="form-field"><label>选题标题 <span class="required">*</span></label><input v-model="editForm.title" placeholder="请输入选题标题" /></div>
          <div class="form-field"><label>描述</label><textarea v-model="editForm.description" placeholder="选题描述" rows="3" /></div>
          <div class="form-field"><label>关键词（逗号分隔）</label><input v-model="editForm.keywords_str" placeholder="关键词1, 关键词2, 关键词3" /></div>
          <div class="form-field"><label>内容角度</label><input v-model="editForm.angle" placeholder="内容角度" /></div>
          <div class="form-field"><label>视频数量</label><input v-model.number="editForm.video_count" type="number" min="0" /></div>
          <div class="form-actions"><button class="btn btn-primary" @click="saveEdit">保存</button><button class="btn" @click="showEdit = false">取消</button></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import HelpTip from '@/components/HelpTip.vue'
import { useRouter } from 'vue-router'
import api from '@/api/client'
import { toast } from '@/utils/toast'

const router = useRouter()

interface Proposal {
  id: number; task_id: string; title: string; description?: string
  keywords?: string[]; angle?: string; video_count?: number
  content_skeleton: {
    hook: string; main_points: string[]; visual_direction: string; structure_type: string
  }; voice_ratio: number; status: string; hotspot_ids: number[]; video_ids: number[];
  created_at: string; updated_at: string
}

interface ListResponse {
  items: Proposal[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// 状态筛选标签
const statusTabs = [
  { label: '全部', value: '' },
  { label: '待确认', value: 'pending' },
  { label: '已确认', value: 'confirmed' },
  { label: '已废弃', value: 'discarded' },
]

const proposals = ref<Proposal[]>([])
const loading = ref(false)
const showCreate = ref(false)
const showEdit = ref(false)
const keyword = ref('')
const currentStatus = ref('')
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const createForm = reactive({ title: '', hook: '', main_points: '', visual_direction: '', voice_ratio: 0.6 })
const editForm = reactive({ id: 0, title: '', description: '', keywords_str: '', angle: '', video_count: 0 })

function skeleton(p: Proposal) { return p.content_skeleton ?? { hook: '', main_points: [], visual_direction: '', structure_type: '' } }

function statusLabel(status: string): string {
  const map: Record<string, string> = { pending: '待确认', confirmed: '已确认', discarded: '已废弃', selected: '已选', generated: '已生成' }
  return map[status] ?? status
}

function statusClass(status: string): string {
  const map: Record<string, string> = { pending: 'pending', confirmed: 'confirmed', discarded: 'discarded', selected: 'selected', generated: 'generated' }
  return map[status] ?? ''
}

function onSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadProposals()
  }, 500)
}

async function loadProposals(): Promise<void> {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (keyword.value) params.set('keyword', keyword.value)
    if (currentStatus.value) params.set('status', currentStatus.value)
    params.set('page', String(page.value))
    params.set('page_size', '20')
    params.set('sort_by', 'created_at_desc')

    // 尝试走新的 GET /topic-proposals，若失败则 fallback
    let res: ListResponse
    try {
      res = await api.get<ListResponse>(`/topic-proposals?${params.toString()}`)
    } catch {
      // fallback: 旧逻辑
      const tasksRes = await api.get<{ items: { id: string }[] }>('/dashboard/workflow')
      let taskId = tasksRes.items[0]?.id
      if (!taskId) {
        const taskRes = await api.post<{ id: string }>('/tasks', { title: '默认任务' })
        taskId = taskRes.id
      }
      const fallbackRes = await api.get<{ items: Proposal[] }>(`/tasks?task_ids=${taskId}`)
      proposals.value = fallbackRes.items ?? []
      total.value = proposals.value.length
      totalPages.value = 1
      return
    }
    proposals.value = res.items ?? []
    total.value = res.total ?? 0
    totalPages.value = res.total_pages ?? 1
  } catch (e) {
    console.error(e)
    toast.error('加载选题列表失败')
    proposals.value = []
  }
  finally { loading.value = false }
}

async function createProposal(): Promise<void> {
  if (!createForm.title) { toast.warning('请输入标题'); return }
  try {
    const tasksRes = await api.get<{ items: { id: string }[] }>('/dashboard/workflow')
    let taskId = tasksRes.items[0]?.id
    if (!taskId) {
      const taskRes = await api.post<{ id: string }>('/tasks', { title: '默认任务' })
      taskId = taskRes.id
    }
    await api.post('/topic-proposals', {
      task_id: taskId,
      title: createForm.title,
      hook: createForm.hook,
      main_points: createForm.main_points ? createForm.main_points.split(',').map(s => s.trim()) : [],
      visual_direction: createForm.visual_direction,
      voice_ratio: createForm.voice_ratio,
    })
    showCreate.value = false
    createForm.title = ''; createForm.hook = ''; createForm.main_points = ''; createForm.visual_direction = ''
    toast.success('选题创建成功')
    await loadProposals()
  } catch (e) { console.error(e); toast.error('创建失败') }
}

async function selectProposal(id: number): Promise<void> {
  try {
    await api.post(`/topic-proposals/${id}/select`)
    toast.success('已选用该选题')
    await loadProposals()
  } catch (e) { console.error(e); toast.error('操作失败') }
}

async function changeStatus(id: number, status: string): Promise<void> {
  try {
    await api.put(`/topic-proposals/${id}`, { status })
    toast.success(`状态已更新为${statusLabel(status)}`)
    await loadProposals()
  } catch (e) { console.error(e); toast.error('状态更新失败') }
}

function openEdit(p: Proposal): void {
  editForm.id = p.id
  editForm.title = p.title
  editForm.description = p.description ?? ''
  editForm.keywords_str = (p.keywords ?? []).join(', ')
  editForm.angle = p.angle ?? ''
  editForm.video_count = p.video_count ?? p.video_ids?.length ?? 0
  showEdit.value = true
}

async function saveEdit(): Promise<void> {
  if (!editForm.title) { toast.warning('请输入标题'); return }
  try {
    await api.put(`/topic-proposals/${editForm.id}`, {
      title: editForm.title,
      description: editForm.description,
      keywords: editForm.keywords_str ? editForm.keywords_str.split(',').map(s => s.trim()).filter(Boolean) : [],
      angle: editForm.angle,
      video_count: editForm.video_count,
    })
    showEdit.value = false
    toast.success('保存成功')
    await loadProposals()
  } catch (e) { console.error(e); toast.error('保存失败') }
}

async function goToScript(p: Proposal): Promise<void> {
  try {
    const { createScript } = await import('@/api/script')
    const res = await createScript({ task_id: p.task_id, topic_id: p.id, full_text: '' })
    router.push(`/scripts/${res.id}`)
  } catch (e) {
    console.error(e)
    toast.error('创建脚本失败')
  }
}

onMounted(loadProposals)
onUnmounted(() => { if (searchTimer) clearTimeout(searchTimer) })
</script>

<style scoped>
.topic-page { max-width: 1100px; margin: 0 auto; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.title-bar h2 { margin: 0; font-size: 22px; color: #1a1a2e; }
.btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-primary { background: #4a6cf7; color: #fff; }
.btn-sm { padding: 4px 12px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 12px; }
.btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-edit { color: #4a6cf7; border-color: #4a6cf7; }
.btn-confirm { color: #16a34a; border-color: #16a34a; }
.btn-discard { color: #dc2626; border-color: #dc2626; }
.btn-restore { color: #d97706; border-color: #d97706; }

/* 搜索与筛选 */
.filter-bar { display: flex; gap: 16px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
.search-input { flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.search-input:focus { outline: none; border-color: #4a6cf7; }
.status-tabs { display: flex; gap: 4px; }
.tab-btn { padding: 6px 14px; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; color: #666; }
.tab-btn.active { background: #4a6cf7; color: #fff; border-color: #4a6cf7; }

/* 卡片网格 */
.proposal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.proposal-card { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 16px; position: relative; }
.proposal-card.selected { border-color: #4a6cf7; }
.card-status { position: absolute; top: 12px; right: 12px; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.card-status.selected { background: #dcfce7; color: #16a34a; }
.card-status.generated { background: #f5f5f5; color: #999; }
.card-status.pending { background: #fef3c7; color: #d97706; }
.card-status.confirmed { background: #dcfce7; color: #16a34a; }
.card-status.discarded { background: #fee2e2; color: #dc2626; }
.card-title { margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #333; padding-right: 60px; }

/* 关键词标签 */
.keywords-row { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
.keyword-tag { display: inline-block; padding: 1px 8px; background: #eff6ff; color: #3b82f6; border-radius: 10px; font-size: 11px; }

/* 骨架预览 */
.skeleton-preview { font-size: 13px; color: #666; margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.skeleton-item { font-size: 13px; color: #666; margin-bottom: 2px; }
.skeleton-item strong { color: #999; }
.card-meta { display: flex; gap: 16px; font-size: 12px; color: #999; margin-bottom: 12px; }
.card-actions { display: flex; gap: 6px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid #f0f0f0; }

/* 分页 */
.pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 24px; padding: 16px 0; }
.page-info { font-size: 13px; color: #666; }

/* 弹窗 */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #fff; border-radius: 12px; width: 480px; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; }
.dialog-header h3 { margin: 0; font-size: 16px; }
.dialog-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.dialog-body { padding: 20px; }
.form-field { margin-bottom: 16px; }
.form-field label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; font-weight: 500; }
.required { color: #e53935; }
.form-field textarea { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; resize: vertical; font-family: inherit; }
.form-field textarea:focus { outline: none; border-color: #4a6cf7; }
.form-field input[type="range"] { width: calc(100% - 40px); }
.form-field input[type="number"] { width: 120px; }
.form-field input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.form-field input:focus { outline: none; border-color: #4a6cf7; }
.form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
.empty-state, .loading { text-align: center; padding: 60px; color: #999; background: #fff; border-radius: 10px; }
</style>
