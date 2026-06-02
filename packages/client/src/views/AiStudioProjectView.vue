<template>
  <div class="workspace">
    <div class="workspace-sidebar">
      <div class="sidebar-section sidebar-help">
        <HelpTip title="AI 工作室使用指引" :steps="[
          '左侧选择生成类型：文生图、图生视频、文生视频等',
          '填写描述后点击生成，AI 会异步处理并在任务队列显示进度',
          '生成完成后素材自动添加到项目素材区',
          '可对素材执行「推送到素材库」或「应用到脚本分段」',
        ]" />
      </div>
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
import HelpTip from '@/components/HelpTip.vue'
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
  width: 240px; background: var(--color-bg-secondary); border-right: 1px solid var(--color-border-light);
  padding: var(--space-4); overflow-y: auto; flex-shrink: 0;
}
.sidebar-section { margin-bottom: var(--space-6); }
.sidebar-section h4 { font-size: var(--font-size-sm); font-weight: 600; margin: 0 0 var(--space-2); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.sidebar-stats { display: flex; gap: var(--space-3); font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.sidebar-empty { font-size: var(--font-size-sm); color: var(--color-text-tertiary); padding: var(--space-2) 0; }
.task-item { display: flex; align-items: center; gap: var(--space-2); padding: 6px 0; font-size: var(--font-size-sm); }
.task-spinner { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.task-type { flex: 1; }
.task-cancel { background: none; border: none; cursor: pointer; color: var(--color-text-tertiary); font-size: var(--font-size-xs); }
.sidebar-actions { margin-top: auto; }
.btn-block { width: 100%; }
.sidebar-back { margin-top: var(--space-4); font-size: var(--font-size-sm); }
.btn-text { background: none; border: none; cursor: pointer; color: var(--color-primary); padding: 0; }

.workspace-main { flex: 1; overflow-y: auto; padding: var(--space-6) var(--space-8); }
.main-header { margin-bottom: var(--space-6); }
.main-header h2 { margin: 0 0 var(--space-1); font-size: var(--font-size-xl); }
.main-header p { margin: 0; color: var(--color-text-secondary); font-size: var(--font-size-base); }

.main-tabs { display: flex; gap: var(--space-1); border-bottom: 1px solid var(--color-border-light); margin-bottom: var(--space-6); }
.tab-btn {
  padding: var(--space-2) var(--space-4); border: none; background: none; cursor: pointer;
  font-size: var(--font-size-base); color: var(--color-text-secondary); border-bottom: 2px solid transparent;
  margin-bottom: -1px; transition: all var(--transition);
}
.tab-btn.active { color: var(--color-primary); border-bottom-color: var(--color-primary); font-weight: 500; }
.tab-btn:hover { color: var(--color-text); }

.main-content { min-height: 400px; }
</style>
