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
            <span>{{ formatDate(p.updated_at, true) }}</span>
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
import { formatDate } from '@/utils/format'

const store = useAiStudioStore()
const router = useRouter()

const showCreateModal = ref(false)
const newTitle = ref('')
const newDesc = ref('')

const { projects, loading } = store

onMounted(() => { store.loadProjects() })

const statusLabel = (s: string) => ({ draft: '草稿', active: '进行中', archived: '已归档' }[s] ?? s)

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
.ai-studio-page { padding: var(--space-6); }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
.title-left h2 { margin: 0; font-size: var(--font-size-xl); }
.stats-text { color: var(--color-text-secondary); font-size: var(--font-size-sm); margin-left: var(--space-3); }
.title-actions { display: flex; gap: var(--space-2); }

.project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); }
.project-card {
  background: var(--color-bg); border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg); padding: var(--space-5); cursor: pointer; position: relative;
  transition: box-shadow var(--transition);
}
.project-card:hover { box-shadow: var(--shadow-md); }
.card-icon { font-size: 28px; margin-bottom: var(--space-3); }
.card-body h3 { margin: 0 0 var(--space-2); font-size: var(--font-size-lg); }
.card-body p { margin: 0 0 var(--space-3); color: var(--color-text-secondary); font-size: var(--font-size-sm); }
.card-meta { display: flex; gap: var(--space-3); font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.meta-tag {
  background: var(--color-primary); color: var(--color-bg);
  padding: 2px var(--space-2); border-radius: var(--radius-sm); font-size: 11px;
}
.card-delete {
  position: absolute; top: var(--space-3); right: var(--space-3); background: none; border: none;
  font-size: var(--font-size-xl); color: var(--color-text-tertiary); cursor: pointer; line-height: 1;
}
.card-delete:hover { color: var(--color-danger); }

.empty-state { text-align: center; padding: 60px var(--space-5); color: var(--color-text-secondary); }
.empty-state .btn { margin-top: var(--space-4); }
.loading { text-align: center; padding: var(--space-8); color: var(--color-text-secondary); }

/* Dialog */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: var(--color-bg); border-radius: var(--radius-lg); width: 440px; max-width: 90vw; box-shadow: var(--shadow-lg); }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border-light); }
.dialog-header h3 { margin: 0; font-size: var(--font-size-lg); }
.dialog-close { background: none; border: none; font-size: var(--font-size-xl); cursor: pointer; color: var(--color-text-secondary); }
.dialog-body { padding: var(--space-5); }
.dialog-footer { display: flex; justify-content: flex-end; gap: var(--space-2); padding: var(--space-4) var(--space-5); border-top: 1px solid var(--color-border-light); }

.form-group { margin-bottom: var(--space-4); }
.form-group label { display: block; font-size: var(--font-size-sm); font-weight: 500; margin-bottom: 6px; }
.form-input { width: 100%; padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius); font-size: var(--font-size-base); box-sizing: border-box; outline: none; transition: border-color var(--transition-fast); }
.form-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2); }
.form-textarea { resize: vertical; font-family: inherit; }
</style>
