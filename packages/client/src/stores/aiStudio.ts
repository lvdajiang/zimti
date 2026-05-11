import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AiStudioProject, AiStudioAsset, GenerateParams } from '@/api/aiStudio'
import {
  fetchProjects, fetchProject, createProject, updateProject, deleteProject,
  fetchAssets, deleteAsset, submitGeneration, fetchAssetStatus,
  pushToMaterials, pushToSegment,
} from '@/api/aiStudio'

export const useAiStudioStore = defineStore('aiStudio', () => {
  const projects = ref<AiStudioProject[]>([])
  const currentProject = ref<AiStudioProject | null>(null)
  const assets = ref<AiStudioAsset[]>([])
  const generatingAssetIds = ref<Set<string>>(new Set())
  const loading = ref(false)
  const assetsLoading = ref(false)

  const pendingAssets = computed(() => assets.value.filter(a => a.status === 'pending' || a.status === 'generating'))
  const completedAssets = computed(() => assets.value.filter(a => a.status === 'completed'))
  const failedAssets = computed(() => assets.value.filter(a => a.status === 'failed'))

  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function loadProjects(): Promise<void> {
    loading.value = true
    try {
      projects.value = await fetchProjects()
    } finally {
      loading.value = false
    }
  }

  async function loadProject(id: string): Promise<void> {
    loading.value = true
    try {
      currentProject.value = await fetchProject(id)
      await loadAssets(id)
    } finally {
      loading.value = false
    }
  }

  async function create(data: { title: string; description?: string }): Promise<AiStudioProject> {
    const project = await createProject(data)
    projects.value.unshift(project)
    return project
  }

  async function update(id: string, data: { title?: string; description?: string; status?: string }): Promise<void> {
    const updated = await updateProject(id, data)
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx !== -1) projects.value[idx] = updated
    if (currentProject.value?.id === id) currentProject.value = updated
  }

  async function remove(id: string): Promise<void> {
    await deleteProject(id)
    projects.value = projects.value.filter(p => p.id !== id)
    if (currentProject.value?.id === id) {
      currentProject.value = null
      assets.value = []
    }
  }

  async function loadAssets(projectId: string): Promise<void> {
    assetsLoading.value = true
    try {
      assets.value = await fetchAssets(projectId)
      generatingAssetIds.value = new Set(
        assets.value.filter(a => a.status === 'pending' || a.status === 'generating').map(a => a.id),
      )
    } finally {
      assetsLoading.value = false
    }
  }

  async function generate(params: GenerateParams): Promise<string> {
    const result = await submitGeneration(params)
    generatingAssetIds.value.add(result.asset_id)
    assets.value.unshift({
      id: result.asset_id,
      project_id: params.project_id,
      type: (['jimeng_t2i', 'jimeng_edit'].includes(params.task_type)) ? 'image' : 'video',
      task_type: params.task_type,
      status: 'generating',
      input_params: params as unknown as Record<string, unknown>,
      file_url: null, thumbnail_url: null, width: null, height: null,
      duration: null, file_size: null, error: null, jimeng_task_id: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    return result.asset_id
  }

  async function removeAsset(id: string): Promise<void> {
    await deleteAsset(id)
    assets.value = assets.value.filter(a => a.id !== id)
    generatingAssetIds.value.delete(id)
  }

  async function pushAsset(assetId: string): Promise<string> {
    const result = await pushToMaterials(assetId)
    return result.material_id
  }

  async function pushAssetToSegment(assetId: string, segmentId: number): Promise<void> {
    await pushToSegment(assetId, segmentId)
  }

  function startPolling(): void {
    stopPolling()
    pollTimer = setInterval(async () => {
      if (generatingAssetIds.value.size === 0) { stopPolling(); return }
      for (const assetId of [...generatingAssetIds.value]) {
        try {
          const status = await fetchAssetStatus(assetId)
          const idx = assets.value.findIndex(a => a.id === assetId)
          if (idx !== -1) assets.value[idx] = { ...assets.value[idx], ...status }
          if (status.status === 'completed' || status.status === 'failed') {
            generatingAssetIds.value.delete(assetId)
          }
        } catch { /* skip */ }
      }
    }, 5000)
  }

  function stopPolling(): void {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  return {
    projects, currentProject, assets, generatingAssetIds, loading, assetsLoading,
    pendingAssets, completedAssets, failedAssets,
    loadProjects, loadProject, create, update, remove,
    loadAssets, generate, removeAsset, pushAsset, pushAssetToSegment,
    startPolling, stopPolling,
  }
})
