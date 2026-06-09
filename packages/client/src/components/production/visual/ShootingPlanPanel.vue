<template>
  <div class="shooting-plan-panel">
    <div class="panel-header">
      <h4>拍摄清单</h4>
      <button
        class="btn btn-primary btn-sm"
        :disabled="generating"
        @click="handleGenerate"
      >
        {{ generating ? '生成中...' : '✨ AI 生成拍摄清单' }}
      </button>
    </div>

    <div v-if="generating" class="loading-wrapper">AI 正在分析分镜，生成拍摄方案...</div>

    <div v-else-if="plans.length === 0" class="empty-hint">
      点击「AI 生成拍摄清单」，为每个分镜自动生成拍摄方案
    </div>

    <div v-else class="plan-list">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="plan-card"
        :class="{ [`status-${plan.status}`]: true }"
      >
        <div class="plan-header">
          <span class="plan-index">{{ plan.segmentIndex + 1 }}</span>
          <span class="camera-badge">{{ cameraLabels[plan.cameraMovement || 'static'] }}</span>
          <span class="status-badge" :class="plan.status">{{ statusLabels[plan.status] }}</span>
          <span class="duration-tag">{{ Number(plan.duration) }}s</span>
        </div>

        <div class="plan-scene">{{ plan.scene }}</div>

        <div v-if="plan.props.length > 0" class="plan-props">
          <span v-for="prop in plan.props" :key="prop" class="prop-tag">{{ prop }}</span>
        </div>

        <div v-if="plan.notes" class="plan-notes">{{ plan.notes }}</div>

        <div class="plan-actions">
          <button class="btn btn-sm btn-outline" @click="handleEdit(plan)">✏️ 编辑</button>
          <button
            v-if="plan.status === 'pending'"
            class="btn btn-sm btn-outline"
            @click="handleMarkShot(plan)"
          >
            📷 已拍摄
          </button>
          <button
            v-if="plan.status === 'shot'"
            class="btn btn-sm btn-outline"
            @click="handleMatch(plan)"
          >
            📎 匹配素材
          </button>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="editingPlan" class="modal-overlay" @click.self="editingPlan = null">
      <div class="modal-card">
        <h4>编辑拍摄方案 #{{ editingPlan.segmentIndex + 1 }}</h4>
        <div class="form-group">
          <label>场景描述</label>
          <textarea v-model="editForm.scene" class="input textarea" rows="3" />
        </div>
        <div class="form-group">
          <label>道具（逗号分隔）</label>
          <input v-model="editForm.propsText" class="input" placeholder="三脚架, 稳定器, 道具A" />
        </div>
        <div class="form-group">
          <label>运镜</label>
          <select v-model="editForm.cameraMovement" class="input">
            <option v-for="(label, key) in cameraLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>时长（秒）</label>
          <input v-model.number="editForm.duration" type="number" class="input" min="0.5" step="0.5" />
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea v-model="editForm.notes" class="input textarea" rows="2" />
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="editingPlan = null">取消</button>
          <button class="btn btn-primary" @click="handleSaveEdit">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/api/client'

interface ShootingPlanItem {
  id: string
  scriptId: number
  segmentIndex: number
  scene: string
  props: string[]
  cameraMovement: string | null
  duration: number
  notes: string | null
  status: string
  materialIds: string[]
  source: string
}

const props = defineProps<{ jobId: string }>()
const plans = ref<ShootingPlanItem[]>([])
const generating = ref(false)
const editingPlan = ref<ShootingPlanItem | null>(null)
const editForm = ref({
  scene: '',
  propsText: '',
  cameraMovement: 'static',
  duration: 3,
  notes: '',
})

const statusLabels: Record<string, string> = {
  pending: '待拍摄',
  shot: '已拍摄',
  matched: '已匹配',
  skipped: '已跳过',
}

const cameraLabels: Record<string, string> = {
  static: '固定机位',
  pan_left: '左摇',
  pan_right: '右摇',
  tracking: '跟踪',
  close_up: '特写',
  wide_shot: '全景',
  aerial: '航拍',
}

onMounted(() => { loadPlans() })

async function loadPlans() {
  if (!props.jobId) return
  try {
    plans.value = (await api.get(`/pipeline/production/${props.jobId}/shooting-plan`)) as unknown as ShootingPlanItem[]
  } catch {
    plans.value = []
  }
}

async function handleGenerate() {
  generating.value = true
  try {
    await api.post(`/pipeline/production/${props.jobId}/shooting-plan/generate`)
    await loadPlans()
  } catch {
    // toast by api client
  } finally {
    generating.value = false
  }
}

function handleEdit(plan: ShootingPlanItem) {
  editingPlan.value = plan
  editForm.value = {
    scene: plan.scene,
    propsText: plan.props.join(', '),
    cameraMovement: plan.cameraMovement || 'static',
    duration: Number(plan.duration),
    notes: plan.notes || '',
  }
}

async function handleSaveEdit() {
  if (!editingPlan.value) return
  try {
    await api.put(`/pipeline/production/${props.jobId}/shooting-plan/${editingPlan.value.id}`, {
      scene: editForm.value.scene,
      props: editForm.value.propsText.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      cameraMovement: editForm.value.cameraMovement,
      duration: editForm.value.duration,
      notes: editForm.value.notes,
    })
    editingPlan.value = null
    await loadPlans()
  } catch {
    // toast by api client
  }
}

async function handleMarkShot(plan: ShootingPlanItem) {
  try {
    await api.put(`/pipeline/production/${props.jobId}/shooting-plan/${plan.id}/status`, {
      status: 'shot',
    })
    await loadPlans()
  } catch {
    // toast by api client
  }
}

async function handleMatch(plan: ShootingPlanItem) {
  // TODO: 打开素材选择器弹窗（Step 2 实现）
  console.log('TODO: match materials for plan', plan.id)
}
</script>

<style scoped>
.shooting-plan-panel {
  padding: 4px 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-header h4 {
  margin: 0;
  font-size: 15px;
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow-y: auto;
}

.plan-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  border-left: 3px solid var(--color-border);
}

.plan-card.status-pending { border-left-color: #9CA3AF; }
.plan-card.status-shot { border-left-color: #3B82F6; }
.plan-card.status-matched { border-left-color: #10B981; }
.plan-card.status-skipped { border-left-color: #F59E0B; opacity: 0.6; }

.plan-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.plan-index {
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

.camera-badge {
  font-size: 11px;
  color: #8B5CF6;
  background: rgba(139, 92, 246, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.status-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.status-badge.pending { color: #9CA3AF; background: rgba(156, 163, 175, 0.1); }
.status-badge.shot { color: #3B82F6; background: rgba(59, 130, 246, 0.1); }
.status-badge.matched { color: #10B981; background: rgba(16, 185, 129, 0.1); }
.status-badge.skipped { color: #F59E0B; background: rgba(245, 158, 11, 0.1); }

.duration-tag {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: auto;
}

.plan-scene {
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text);
  margin-bottom: 6px;
}

.plan-props {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.prop-tag {
  font-size: 11px;
  color: #F59E0B;
  background: rgba(245, 158, 11, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
}

.plan-notes {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.plan-actions {
  display: flex;
  gap: 6px;
}

.btn {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 13px;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn-outline { color: var(--color-primary); border-color: var(--color-primary); }
.btn-sm { padding: 4px 10px; font-size: 12px; }

.loading-wrapper {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.empty-hint {
  text-align: center;
  padding: 30px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: var(--color-surface);
  border-radius: 10px;
  padding: 20px;
  width: 420px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-card h4 { margin: 0 0 16px; font-size: 16px; }

.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; }

.input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
  box-sizing: border-box;
}

.textarea { resize: vertical; font-family: inherit; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
