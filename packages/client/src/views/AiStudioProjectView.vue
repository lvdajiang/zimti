<template>
  <div class="workspace">
    <div class="workspace-sidebar">
      <div class="sidebar-section">
        <h4>项目素材</h4>
        <div class="sidebar-stats">
          <span>图片 {{ imageCount }}</span>
          <span>视频 {{ videoCount }}</span>
        </div>
      </div>
      <div class="sidebar-section">
        <h4>任务队列</h4>
        <div v-if="pendingAssets.length === 0" class="sidebar-empty">暂无进行中任务</div>
        <div v-for="a in pendingAssets" :key="a.id" class="task-item">
          <span class="task-spinner">⏳</span>
          <span class="task-type">{{ taskLabel(a.task_type) }}</span>
          <button class="task-cancel" @click="store.stopPolling()" title="停止轮询">✕</button>
        </div>
      </div>
      <div class="sidebar-section sidebar-actions">
        <button class="btn btn-outline btn-block" @click="handlePushSelected" :disabled="!hasSelected">
          推送到素材库 ({{ selectedIds.size }})
        </button>
      </div>
      <button class="btn btn-text sidebar-back" @click="router.push('/ai-studio')">← 返回项目列表</button>
    </div>

    <div class="workspace-main">
      <div class="main-header">
        <div>
          <h2>{{ project?.title ?? '加载中...' }}</h2>
          <p v-if="project?.description">{{ project.description }}</p>
        </div>
      </div>

      <div class="main-tabs">
        <button v-for="tab in tabs" :key="tab.key" class="tab-btn" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
          {{ tab.label }}
        </button>
      </div>

      <div class="main-content">
        <TextToImagePanel v-if="activeTab === 't2i'" :project-id="projectId" />
        <ImageToVideoPanel v-else-if="activeTab === 'i2v'" :project-id="projectId" />
        <TextToVideoPanel v-else-if="activeTab === 't2v'" :project-id="projectId" />
        <ImageEditPanel v-else-if="activeTab === 'edit'" :project-id="projectId" />
        <DigitalHumanPanel v-else-if="activeTab === 'human'" :project-id="projectId" />
        <AssetGridPanel v-else-if="activeTab === 'assets'" :assets="completedAssets" :selected-ids="selectedIds" @toggle="toggleSelect" @delete="handleAssetDelete" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAiStudioStore } from '@/stores/aiStudio'
import { toast } from '@/utils/toast'
import TextToImagePanel from '@/components/ai-studio/TextToImagePanel.vue'
import ImageToVideoPanel from '@/components/ai-studio/ImageToVideoPanel.vue'
import TextToVideoPanel from '@/components/ai-studio/TextToVideoPanel.vue'
import ImageEditPanel from '@/components/ai-studio/ImageEditPanel.vue'
import DigitalHumanPanel from '@/components/ai-studio/DigitalHumanPanel.vue'
import AssetGridPanel from '@/components/ai-studio/AssetGridPanel.vue'
import type { AiStudioAsset } from '@/api/aiStudio'

const store = useAiStudioStore()
const route = useRoute()
const router = useRouter()

const projectId = route.params.projectId as string
const activeTab = ref('t2i')
const selectedIds = ref<Set<string>>(new Set())

const tabs = [
  { key: 't2i', label: '文生图' },
  { key: 'i2v', label: '图生视频' },
  { key: 't2v', label: '文生视频' },
  { key: 'edit', label: '图片编辑' },
  { key: 'human', label: '数字人' },
  { key: 'assets', label: '已生成素材' },
]

const project = computed(() => store.currentProject)
const completedAssets = computed(() => store.completedAssets)
const pendingAssets = computed(() => store.pendingAssets)

const imageCount = computed(() => completedAssets.value.filter((a: any) => a.type === 'image').length)
const videoCount = computed(() => completedAssets.value.filter((a: any) => a.type === 'video').length)
const hasSelected = computed(() => selectedIds.value.size > 0)

const taskLabel = (t: string) => ({ jimeng_t2i: '文生图', jimeng_i2v: '图生视频', jimeng_t2v: '文生视频', jimeng_edit: '图片编辑', jimeng_digital_human: '数字人' }[t] ?? t)

function toggleSelect(asset: AiStudioAsset) {
  if (selectedIds.value.has(asset.id)) selectedIds.value.delete(asset.id)
  else selectedIds.value.add(asset.id)
}

async function handlePushSelected() {
  for (const id of selectedIds.value) {
    try {
      await store.pushAsset(id)
      toast.success('已推送到素材库')
    } catch { toast.error('推送失败') }
  }
  selectedIds.value.clear()
}

async function handleAssetDelete(id: string) {
  await store.removeAsset(id)
  selectedIds.value.delete(id)
}

onMounted(async () => {
  await store.loadProject(projectId)
  store.startPolling()
})
onUnmounted(() => { store.stopPolling() })

watch(() => store.pendingAssets.length, (len) => {
  if (len > 0) store.startPolling()
})
</script>

<style scoped>
.workspace { display: flex; height: 100vh; overflow: hidden; }
.workspace-sidebar {
  width: 240px; background: var(--bg-secondary, #f9fafb); border-right: 1px solid var(--border-light, #e5e7eb);
  padding: 16px; overflow-y: auto; flex-shrink: 0;
}
.sidebar-section { margin-bottom: 24px; }
.sidebar-section h4 { font-size: 13px; font-weight: 600; margin: 0 0 8px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.sidebar-stats { display: flex; gap: 12px; font-size: 13px; color: var(--text-secondary); }
.sidebar-empty { font-size: 13px; color: var(--text-tertiary); padding: 8px 0; }
.task-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; }
.task-spinner { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.task-type { flex: 1; }
.task-cancel { background: none; border: none; cursor: pointer; color: var(--text-tertiary); font-size: 12px; }
.sidebar-actions { margin-top: auto; }
.btn-block { width: 100%; }
.sidebar-back { margin-top: 16px; font-size: 13px; }
.btn-text { background: none; border: none; cursor: pointer; color: var(--brand-indigo, #6366F1); padding: 0; }

.workspace-main { flex: 1; overflow-y: auto; padding: 24px 32px; }
.main-header { margin-bottom: 24px; }
.main-header h2 { margin: 0 0 4px; font-size: 20px; }
.main-header p { margin: 0; color: var(--text-secondary); font-size: 14px; }

.main-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-light, #e5e7eb); margin-bottom: 24px; }
.tab-btn {
  padding: 8px 16px; border: none; background: none; cursor: pointer;
  font-size: 14px; color: var(--text-secondary); border-bottom: 2px solid transparent;
  margin-bottom: -1px; transition: all 0.2s;
}
.tab-btn.active { color: var(--brand-indigo, #6366F1); border-bottom-color: var(--brand-indigo, #6366F1); font-weight: 500; }
.tab-btn:hover { color: var(--text-primary); }

.main-content { min-height: 400px; }
</style>
