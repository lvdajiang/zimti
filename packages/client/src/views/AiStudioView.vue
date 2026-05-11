<template>
  <div class="ai-studio-page">
    <div class="title-bar">
      <div class="title-left">
        <h2>AI工作室</h2>
        <span class="stats-text">{{ projects.length }} 个项目</span>
      </div>
      <div class="title-actions">
        <button class="btn btn-primary" @click="showCreateModal = true">新建项目</button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="projects.length === 0" class="empty-state">
      <p>还没有 AI 项目</p>
      <button class="btn btn-primary" @click="showCreateModal = true">创建第一个项目</button>
    </div>
    <div v-else class="project-grid">
      <div v-for="p in projects" :key="p.id" class="project-card" @click="goToProject(p.id)">
        <div class="card-icon">🎨</div>
        <div class="card-body">
          <h3>{{ p.title }}</h3>
          <p v-if="p.description">{{ p.description }}</p>
          <div class="card-meta">
            <span class="meta-tag">{{ statusLabel(p.status) }}</span>
            <span>{{ p.asset_count }} 个素材</span>
            <span>{{ formatDate(p.updated_at) }}</span>
          </div>
        </div>
        <button class="card-delete" @click.stop="handleDelete(p.id)" title="删除项目">&times;</button>
      </div>
    </div>

    <!-- 新建项目弹窗 -->
    <div v-if="showCreateModal" class="overlay" @click.self="showCreateModal = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>新建 AI 项目</h3>
          <button class="dialog-close" @click="showCreateModal = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>项目名称</label>
            <input v-model="newTitle" class="form-input" placeholder="例：旅行Vlog" maxlength="200" />
          </div>
          <div class="form-group">
            <label>描述（可选）</label>
            <textarea v-model="newDesc" class="form-input form-textarea" placeholder="简单描述项目目标..." rows="3"></textarea>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-outline" @click="showCreateModal = false">取消</button>
          <button class="btn btn-primary" :disabled="!newTitle.trim()" @click="handleCreate">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAiStudioStore } from '@/stores/aiStudio'
import { toast } from '@/utils/toast'

const store = useAiStudioStore()
const router = useRouter()

const showCreateModal = ref(false)
const newTitle = ref('')
const newDesc = ref('')

const { projects, loading } = store

onMounted(() => { store.loadProjects() })

const statusLabel = (s: string) => ({ draft: '草稿', active: '进行中', archived: '已归档' }[s] ?? s)

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function goToProject(id: string) { router.push(`/ai-studio/${id}`) }

async function handleCreate() {
  if (!newTitle.value.trim()) return
  const project = await store.create({ title: newTitle.value.trim(), description: newDesc.value.trim() || undefined })
  toast.success('项目创建成功')
  showCreateModal.value = false
  newTitle.value = ''
  newDesc.value = ''
  goToProject(project.id)
}

async function handleDelete(id: string) {
  if (!confirm('确定删除此项目？所有素材将一并删除。')) return
  await store.remove(id)
  toast.success('项目已删除')
}
</script>

<style scoped>
.ai-studio-page { padding: 24px; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.title-left h2 { margin: 0; font-size: 20px; }
.stats-text { color: var(--text-secondary); font-size: 13px; margin-left: 12px; }
.title-actions { display: flex; gap: 8px; }

.project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.project-card {
  background: var(--bg-secondary, #fff); border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 12px; padding: 20px; cursor: pointer; position: relative;
  transition: box-shadow 0.2s;
}
.project-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.card-icon { font-size: 28px; margin-bottom: 12px; }
.card-body h3 { margin: 0 0 8px; font-size: 16px; }
.card-body p { margin: 0 0 12px; color: var(--text-secondary); font-size: 13px; }
.card-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text-tertiary); }
.meta-tag {
  background: var(--brand-indigo, #6366F1); color: #fff;
  padding: 2px 8px; border-radius: 4px; font-size: 11px;
}
.card-delete {
  position: absolute; top: 12px; right: 12px; background: none; border: none;
  font-size: 20px; color: var(--text-tertiary); cursor: pointer; line-height: 1;
}
.card-delete:hover { color: #ef4444; }

.empty-state { text-align: center; padding: 60px 20px; color: var(--text-secondary); }
.empty-state .btn { margin-top: 16px; }
.loading { text-align: center; padding: 40px; color: var(--text-secondary); }

/* Dialog */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.dialog { background: var(--bg-primary, #fff); border-radius: 12px; width: 440px; max-width: 90vw; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-light, #e5e7eb); }
.dialog-header h3 { margin: 0; font-size: 16px; }
.dialog-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-secondary); }
.dialog-body { padding: 20px; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 16px 20px; border-top: 1px solid var(--border-light, #e5e7eb); }

.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.form-input { width: 100%; padding: 8px 12px; border: 1px solid var(--border-light, #e5e7eb); border-radius: 8px; font-size: 14px; box-sizing: border-box; }
.form-textarea { resize: vertical; font-family: inherit; }
</style>
