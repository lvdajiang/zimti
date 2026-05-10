<template>
  <div class="topic-page">
    <div class="title-bar">
      <h2>选题工作台</h2>
      <button class="btn btn-primary" @click="showCreate = true">+ 新建选题</button>
    </div>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="proposals.length === 0" class="empty-state"><p>暂无选题，点击上方按钮新建或AI生成</p></div>
    <div v-else class="proposal-grid">
      <div v-for="p in proposals" :key="p.id" class="proposal-card" :class="{ selected: p.status === 'selected' }">
        <div class="card-status" :class="p.status">{{ p.status === 'selected' ? '已选' : '待选' }}</div>
        <h4 class="card-title">{{ p.title }}</h4>
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
          <span>关联视频 {{ p.video_ids.length }}</span>
        </div>
        <div class="card-actions">
          <button v-if="p.status !== 'selected'" class="btn-sm" @click="selectProposal(p.id)">选用</button>
          <button class="btn-sm" @click="goToScript(p)">编辑脚本</button>
        </div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/client'
import { toast } from '@/utils/toast'

const router = useRouter()

interface Proposal {
  id: number; task_id: string; title: string; content_skeleton: {
    hook: string; main_points: string[]; visual_direction: string; structure_type: string
  }; voice_ratio: number; status: string; hotspot_ids: number[]; video_ids: number[];
  created_at: string; updated_at: string
}

const proposals = ref<Proposal[]>([])
const loading = ref(false)
const showCreate = ref(false)
const createForm = reactive({ title: '', hook: '', main_points: '', visual_direction: '', voice_ratio: 0.6 })

function skeleton(p: Proposal) { return p.content_skeleton ?? { hook: '', main_points: [], visual_direction: '', structure_type: '' } }

async function loadProposals(): Promise<void> {
  loading.value = true
  try {
    // 创建一个默认 task 来关联选题
    const tasksRes = await api.get<{ items: { id: string }[] }>('/dashboard/workflow')
    let taskId = tasksRes.items[0]?.id
    if (!taskId) {
      const taskRes = await api.post<{ id: string }>('/tasks', { title: '默认任务' })
      taskId = taskRes.id
    }
    const res = await api.get<{ items: Proposal[] }>(`/tasks?task_ids=${taskId}`)
    proposals.value = res.items ?? []
  } catch (e) {
    console.error(e)
    toast.error('加载选题列表失败')
    proposals.value = []
  }
  finally { loading.value = false }
}

async function createProposal(): Promise<void> {
  if (!createForm.title) { alert('请输入标题'); return }
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
    await loadProposals()
  } catch (e) { console.error(e); alert('创建失败') }
}

async function selectProposal(id: number): Promise<void> {
  try { await api.post(`/topic-proposals/${id}/select`); await loadProposals() } catch (e) { console.error(e); alert('操作失败') }
}

function goToScript(p: Proposal): void { router.push(`/scripts/${p.id}`) }

onMounted(loadProposals)
</script>

<style scoped>
.topic-page { max-width: 1100px; margin: 0 auto; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.title-bar h2 { margin: 0; font-size: 22px; color: #1a1a2e; }
.btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-primary { background: #4a6cf7; color: #fff; }
.btn-sm { padding: 4px 12px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 12px; }
.proposal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.proposal-card { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 16px; position: relative; }
.proposal-card.selected { border-color: #4a6cf7; }
.card-status { position: absolute; top: 12px; right: 12px; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.card-status.selected { background: #dcfce7; color: #16a34a; }
.card-status.generated { background: #f5f5f5; color: #999; }
.card-title { margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #333; }
.skeleton-preview { font-size: 13px; color: #666; margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.skeleton-item strong { color: #999; }
.card-meta { display: flex; gap: 16px; font-size: 12px; color: #999; margin-bottom: 12px; }
.card-actions { display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid #f0f0f0; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #fff; border-radius: 12px; width: 480px; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; }
.dialog-header h3 { margin: 0; font-size: 16px; }
.dialog-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.dialog-body { padding: 20px; }
.form-field { margin-bottom: 16px; }
.form-field label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; font-weight: 500; }
.required { color: #e53935; }
.form-field input[type="range"] { width: calc(100% - 40px); }
.form-field input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.form-field input:focus { outline: none; border-color: #4a6cf7; }
.form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
.empty-state, .loading { text-align: center; padding: 60px; color: #999; background: #fff; border-radius: 10px; }
</style>
