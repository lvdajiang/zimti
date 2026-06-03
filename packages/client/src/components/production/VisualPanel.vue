<template>
  <div class="visual-panel">
    <div class="panel-grid">
      <!-- 左侧：视频画面 -->
      <div class="video-section">
        <div class="section-header">
          <h3>视频画面</h3>
          <div class="mode-switch">
            <button class="mode-btn" :class="{ active: mode === 'material' }" @click="mode = 'material'">素材拼接</button>
            <button class="mode-btn" :class="{ active: mode === 'digital_human' }" @click="mode = 'digital_human'">数字人</button>
          </div>
        </div>

        <!-- 素材拼接模式 -->
        <template v-if="mode === 'material'">
          <div class="segment-materials">
            <div v-for="(seg, i) in segments" :key="seg.id" class="seg-material-card">
              <div class="seg-info">
                <span class="seg-index">{{ i + 1 }}</span>
                <span class="seg-type-badge">{{ seg.segmentType === 'oral' ? '口播' : '画面' }}</span>
                <span class="seg-desc">{{ (seg.visualDescription || seg.oralText || '').slice(0, 50) }}</span>
              </div>
              <div class="seg-material-slot">
                <div v-if="seg.materialIds && seg.materialIds.length > 0" class="material-preview">
                  已选 {{ seg.materialIds.length }} 个素材
                </div>
                <div v-else class="material-empty">
                  <span>暂无素材</span>
                  <button class="btn btn-sm" @click="openMaterialPicker(seg.id)">选择素材</button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 数字人模式（占位） -->
        <template v-else>
          <div class="digital-human-placeholder">
            <div class="placeholder-icon">🤖</div>
            <h4>数字人视频生成</h4>
            <p>数字人 API 正在对接中，敬请期待</p>
            <p class="hint">当前可使用「素材拼接」模式制作视频</p>
          </div>
        </template>

        <!-- 渲染进度 -->
        <div v-if="rendering" class="render-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: store.renderProgress + '%' }" />
          </div>
          <span class="progress-text">渲染中 {{ store.renderProgress }}%</span>
        </div>

        <!-- 视频预览 -->
        <div v-if="store.videoUrl" class="video-preview">
          <h4>预览</h4>
          <video controls :src="store.videoUrl" class="preview-player" />
        </div>
      </div>

      <!-- 右侧：操作 -->
      <div class="config-section">
        <div class="config-card">
          <h4>渲染设置</h4>
          <div class="form-group">
            <label>分辨率</label>
            <select v-model="resolution" class="input">
              <option value="1080x1920">竖屏 1080x1920（抖音/小红书）</option>
              <option value="1920x1080">横屏 1920x1080（B站/YouTube）</option>
            </select>
          </div>
        </div>

        <button
          class="btn btn-primary btn-block"
          :disabled="segments.length === 0 || store.executing"
          @click="handleRender"
        >
          {{ rendering ? '渲染中...' : '开始渲染' }}
        </button>

        <div v-if="store.videoUrl" class="config-card success-card">
          <div class="success-icon">✅</div>
          <p>视频已生成</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useProductionStore } from '@/stores/production'
import api from '@/api/client'

interface SegmentItem {
  id: number
  segmentType: string
  oralText: string | null
  visualDescription: string | null
  materialIds: number[]
  oralAudioUrl: string | null
}

const store = useProductionStore()
const segments = ref<SegmentItem[]>([])
const mode = ref<'material' | 'digital_human'>('material')
const resolution = ref('1080x1920')
const rendering = ref(false)

onMounted(() => { loadSegments() })
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

function openMaterialPicker(_segmentId: number) {
  // TODO: 打开素材库选择弹窗
}

async function handleRender() {
  rendering.value = true
  try {
    await store.runStep(3, { resolution: resolution.value })
  } finally {
    rendering.value = false
  }
}
</script>

<style scoped>
.visual-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 20px;
}

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

.section-header h3 {
  margin: 0;
  font-size: 16px;
}

.mode-switch {
  display: flex;
  gap: 4px;
  background: var(--color-background);
  border-radius: 6px;
  padding: 2px;
}

.mode-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 13px;
}

.mode-btn.active {
  background: var(--color-primary);
  color: #fff;
}

.segment-materials {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.seg-material-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
}

.seg-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.seg-index {
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

.seg-type-badge {
  font-size: 12px;
  color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.seg-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seg-material-slot {
  padding-left: 28px;
}

.material-preview {
  font-size: 13px;
  color: #10b981;
}

.material-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.digital-human-placeholder {
  text-align: center;
  padding: 60px 20px;
  color: var(--color-text-secondary);
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.digital-human-placeholder h4 {
  margin: 0 0 8px;
  color: var(--color-text);
}

.digital-human-placeholder p {
  margin: 0 0 4px;
  font-size: 14px;
}

.hint {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.render-progress {
  margin-top: 16px;
}

.progress-bar {
  height: 6px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: width 0.5s;
}

.progress-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 4px;
  display: block;
}

.video-preview {
  margin-top: 16px;
}

.video-preview h4 {
  margin: 0 0 8px;
  font-size: 14px;
}

.preview-player {
  width: 100%;
  max-height: 360px;
  border-radius: 8px;
  background: #000;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px;
}

.config-card h4 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 10px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 14px;
  box-sizing: border-box;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 14px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.btn-block {
  width: 100%;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.success-card {
  text-align: center;
}

.success-icon {
  font-size: 32px;
  margin-bottom: 4px;
}

.success-card p {
  margin: 0;
  font-size: 14px;
  color: #10b981;
}

@media (max-width: 768px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}
</style>
