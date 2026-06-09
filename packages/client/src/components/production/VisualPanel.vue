<template>
  <div class="visual-panel">
    <!-- 标签页导航 -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.icon }} {{ tab.label }}
      </button>
    </div>

    <!-- 标签页内容 -->
    <div class="tab-content">
      <!-- 素材拼接（原有功能） -->
      <template v-if="activeTab === 'material'">
        <div class="panel-grid">
          <div class="video-section">
            <div class="section-header">
              <h3>视频画面</h3>
            </div>
            <div v-if="segments.length === 0" class="empty-hint">请先在「脚本」步骤中生成分镜</div>
            <div v-else class="segment-materials">
              <div v-for="(seg, i) in segments" :key="seg.id" class="seg-material-card">
                <div class="seg-info">
                  <span class="seg-index">{{ i + 1 }}</span>
                  <span class="seg-type-badge">{{ seg.segment_type === 'oral' ? '口播' : seg.segment_type === 'visual' ? '画面' : '转场' }}</span>
                  <span class="seg-desc">{{ (seg.visual_description || seg.oral_text || '').slice(0, 50) }}</span>
                </div>
                <div class="seg-material-slot">
                  <div v-if="seg.material_ids && seg.material_ids.length > 0" class="material-preview">
                    已选 {{ seg.material_ids.length }} 个素材
                    <button class="btn btn-sm" @click="openMaterialPicker(seg.id, seg.material_ids)">更换</button>
                  </div>
                  <div v-else class="material-empty">
                    <span>暂无素材</span>
                    <button class="btn btn-sm btn-primary" @click="openMaterialPicker(seg.id, [])">选择素材</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 渲染进度 -->
            <div v-if="rendering" class="render-progress">
              <div class="progress-header">
                <span>渲染中</span>
                <span class="progress-pct">{{ renderProgress }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: renderProgress + '%' }" />
              </div>
            </div>

            <!-- 视频预览 -->
            <div v-if="store.videoUrl" class="video-preview">
              <h4>✅ 视频已生成</h4>
              <video controls :src="videoPath" class="preview-player" />
            </div>
          </div>

          <div class="config-section">
            <div class="config-card">
              <h4>渲染设置</h4>
              <div class="form-group">
                <label>分辨率</label>
                <select v-model="resolution" class="input">
                  <option value="1080x1920">竖屏 1080×1920（抖音/小红书）</option>
                  <option value="1920x1080">横屏 1920×1080（B站/YouTube）</option>
                </select>
              </div>
            </div>

            <button
              class="btn btn-primary btn-block"
              :disabled="segments.length === 0 || rendering || store.executing"
              @click="handleRender"
            >
              <template v-if="rendering">渲染中 {{ renderProgress }}%...</template>
              <template v-else-if="store.videoUrl">重新渲染</template>
              <template v-else>开始渲染</template>
            </button>

            <button v-if="rendering" class="btn btn-block" @click="handleCancelRender">取消渲染</button>

            <div v-if="store.steps[2]?.status === 'completed'" class="config-card success-card">
              <span class="success-icon">✅</span> 视频已生成，可以进入下一步
            </div>
          </div>
        </div>
      </template>

      <!-- 拍摄清单 -->
      <ShootingPlanPanel v-if="activeTab === 'plan'" :job-id="store.jobId || ''" />

      <!-- AI 生成 -->
      <AiGeneratePanel v-if="activeTab === 'generate'" :job-id="store.jobId || ''" :script-id="store.scriptId" />

      <!-- 时间轴 -->
      <TimelinePanel v-if="activeTab === 'timeline'" :job-id="store.jobId || ''" />

      <!-- 导出 -->
      <ExportPanel v-if="activeTab === 'export'" :job-id="store.jobId || ''" />
    </div>

    <!-- 素材选择弹窗 -->
    <div v-if="showMaterialPicker" class="overlay" @click.self="showMaterialPicker = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>选择素材</h3>
          <button class="dialog-close" @click="showMaterialPicker = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="filter-bar">
            <select v-model="materialFilter" class="input" @change="loadMaterials">
              <option value="">全部类型</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
            </select>
            <button class="btn btn-sm" @click="loadMaterials">刷新</button>
          </div>
          <div v-if="materialsLoading" class="loading-wrapper">加载中...</div>
          <div v-else-if="materials.length === 0" class="empty-hint">暂无素材，请先到素材库上传</div>
          <div v-else class="material-grid">
            <div
              v-for="m in materials"
              :key="m.id"
              class="material-item"
              :class="{ selected: selectedMaterialIds.includes(m.id) }"
              @click="toggleMaterialSelection(m.id)"
            >
              <div class="material-thumb">
                <img v-if="m.thumbnail_url" :src="m.thumbnail_url" />
                <span v-else class="thumb-icon">{{ m.type === 'image' ? '🖼' : '🎬' }}</span>
              </div>
              <span class="material-name">{{ m.name }}</span>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <span class="selected-count">已选 {{ selectedMaterialIds.length }} 个</span>
          <button class="btn" @click="showMaterialPicker = false">取消</button>
          <button class="btn btn-primary" @click="confirmMaterialSelection">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useProductionStore } from '@/stores/production'
import api from '@/api/client'
import ShootingPlanPanel from './visual/ShootingPlanPanel.vue'
import AiGeneratePanel from './visual/AiGeneratePanel.vue'
import TimelinePanel from './visual/TimelinePanel.vue'
import ExportPanel from './visual/ExportPanel.vue'

interface SegmentItem {
  id: number
  segment_type: string
  oral_text: string | null
  visual_description: string
  material_ids: string[]
  oral_audio_url: string | null
}

interface MaterialItem {
  id: number
  name: string
  type: string
  thumbnail_url: string | null
  file_url: string
}

const store = useProductionStore()
const segments = ref<SegmentItem[]>([])
const resolution = ref('1080x1920')
const rendering = ref(false)
const renderProgress = ref(0)
const activeTab = ref('material')
let pollTimer: ReturnType<typeof setInterval> | null = null

const tabs = [
  { key: 'material', label: '素材拼接', icon: '🖼' },
  { key: 'plan', label: '拍摄清单', icon: '📋' },
  { key: 'generate', label: 'AI 生成', icon: '🤖' },
  { key: 'timeline', label: '时间轴', icon: '🎬' },
  { key: 'export', label: '导出', icon: '📤' },
]

// 素材选择
const showMaterialPicker = ref(false)
const currentSegmentId = ref(0)
const selectedMaterialIds = ref<number[]>([])
const materials = ref<MaterialItem[]>([])
const materialsLoading = ref(false)
const materialFilter = ref('')

const videoPath = computed(() => {
  if (!store.videoUrl) return ''
  if (store.videoUrl.startsWith('http')) return store.videoUrl
  return `/static/${store.videoUrl.replace(/\\/g, '/').split('/').slice(-2).join('/')}`
})

onMounted(() => { loadSegments() })
onUnmounted(() => { stopPolling() })
watch(() => store.scriptId, () => { loadSegments() })

async function loadSegments() {
  if (!store.scriptId) return
  try {
    const res = await api.get(`/scripts/${store.scriptId}`) as any
    segments.value = res.segments || []
  } catch {
    // 静默
  }
}

async function handleRender() {
  rendering.value = true
  renderProgress.value = 0
  await store.runStep(3, { resolution: resolution.value })
  if (store.videoProductId) {
    startPolling()
  } else {
    await store.refreshProgress()
    rendering.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    if (!store.videoProductId) return
    try {
      const res = await api.get(`/video-products/${store.videoProductId}/render-status`) as any
      renderProgress.value = res.progress || 0
      if (res.status === 'completed') {
        stopPolling()
        const vp = await api.get(`/video-products/${store.videoProductId}/preview`) as any
        if (vp?.video_product?.video_url) {
          store.videoUrl = vp.video_product.video_url
          await store.saveStepData(3, { video_url: vp.video_product.video_url })
        }
        store.steps[2].status = 'completed'
        rendering.value = false
        if (store.currentStep === 3) store.currentStep = 4
      } else if (res.status === 'failed') {
        stopPolling()
        rendering.value = false
        renderProgress.value = 0
      }
    } catch {
      stopPolling()
      rendering.value = false
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function handleCancelRender() {
  if (!store.videoProductId) return
  stopPolling()
  try { await api.post(`/video-products/${store.videoProductId}/render-cancel`) } catch { /* 静默 */ }
  rendering.value = false
  renderProgress.value = 0
}

function openMaterialPicker(segmentId: number, currentIds: string[]) {
  currentSegmentId.value = segmentId
  selectedMaterialIds.value = currentIds.map(Number)
  showMaterialPicker.value = true
  loadMaterials()
}

async function loadMaterials() {
  materialsLoading.value = true
  try {
    const params = new URLSearchParams()
    if (materialFilter.value) params.set('type', materialFilter.value)
    params.set('page_size', '50')
    const res = await api.get(`/materials?${params}`) as any
    materials.value = res.items || []
  } catch { /* 静默 */ } finally { materialsLoading.value = false }
}

function toggleMaterialSelection(id: number) {
  const idx = selectedMaterialIds.value.indexOf(id)
  if (idx >= 0) selectedMaterialIds.value.splice(idx, 1)
  else selectedMaterialIds.value.push(id)
}

async function confirmMaterialSelection() {
  if (!currentSegmentId.value) return
  try {
    await api.put(`/scripts/${store.scriptId}/segments/${currentSegmentId.value}/materials`, {
      material_ids: selectedMaterialIds.value,
    })
    await loadSegments()
  } catch { /* 静默 */ }
  showMaterialPicker.value = false
}
</script>

<style scoped>
.visual-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 20px;
}

/* 标签页 */
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}

.tab-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px 6px 0 0;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.tab-btn:hover { color: var(--color-primary); }
.tab-btn.active {
  background: var(--color-primary);
  color: #fff;
}

.tab-content { min-height: 300px; }

/* 素材拼接面板 */
.panel-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 { margin: 0; font-size: 16px; }

.segment-materials {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 500px;
  overflow-y: auto;
}

.seg-material-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
}

.seg-info { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.seg-index {
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--color-primary); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; flex-shrink: 0;
}
.seg-type-badge {
  font-size: 12px; color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.1);
  padding: 2px 6px; border-radius: 4px;
}
.seg-desc {
  font-size: 13px; color: var(--color-text-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.seg-material-slot { padding-left: 28px; }
.material-preview { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #10b981; }
.material-empty { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-secondary); }

.render-progress { margin-top: 16px; }
.progress-header { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; color: var(--color-text-secondary); }
.progress-pct { color: var(--color-primary); font-weight: 600; }
.progress-bar { height: 6px; background: var(--color-border); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-primary); border-radius: 3px; transition: width 0.5s; }

.video-preview { margin-top: 16px; }
.video-preview h4 { margin: 0 0 8px; font-size: 14px; color: #10b981; }
.preview-player { width: 100%; max-height: 360px; border-radius: 8px; background: #000; }

.config-section { display: flex; flex-direction: column; gap: 12px; }
.config-card { background: var(--color-background); border: 1px solid var(--color-border); border-radius: 8px; padding: 14px; }
.config-card h4 { margin: 0 0 10px; font-size: 14px; font-weight: 600; }
.form-group { margin-bottom: 10px; }
.form-group label { display: block; font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; }
.input { width: 100%; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font-size: 14px; box-sizing: border-box; }

.btn { padding: 8px 16px; border: 1px solid var(--color-border); border-radius: 6px; background: transparent; color: var(--color-text); cursor: pointer; font-size: 14px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn-block { width: 100%; }
.btn-sm { padding: 4px 10px; font-size: 12px; }

.success-card { text-align: center; color: #10b981; font-size: 14px; }
.success-icon { margin-right: 4px; }
.empty-hint { text-align: center; padding: 40px; color: var(--color-text-secondary); font-size: 14px; }
.loading-wrapper { text-align: center; padding: 20px; color: var(--color-text-secondary); }

/* 弹窗 */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.dialog { background: var(--color-surface); border-radius: 10px; width: 90%; max-width: 640px; max-height: 80vh; display: flex; flex-direction: column; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
.dialog-header h3 { margin: 0; font-size: 16px; }
.dialog-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-secondary); }
.dialog-body { padding: 16px 20px; overflow-y: auto; flex: 1; }
.dialog-footer { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--color-border); }
.selected-count { flex: 1; font-size: 13px; color: var(--color-text-secondary); }
.filter-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.material-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
.material-item { display: flex; flex-direction: column; align-items: center; padding: 8px; border: 2px solid var(--color-border); border-radius: 8px; cursor: pointer; transition: all 0.15s; }
.material-item:hover { border-color: var(--color-primary); }
.material-item.selected { border-color: var(--color-primary); background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.06); }
.material-thumb { width: 64px; height: 64px; background: var(--color-background); border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 4px; }
.material-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-icon { font-size: 24px; }
.material-name { font-size: 11px; color: var(--color-text-secondary); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80px; }

@media (max-width: 768px) {
  .panel-grid { grid-template-columns: 1fr; }
  .material-grid { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); }
}
</style>
