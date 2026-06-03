<template>
  <div class="subtitle-panel">
    <div class="panel-grid">
      <!-- 左侧：预览 -->
      <div class="preview-section">
        <h3>字幕预览</h3>
        <div class="preview-box" :style="previewBoxStyle">
          <div class="preview-video-placeholder">
            <span>视频画面区域</span>
          </div>
          <div class="subtitle-overlay" :style="subtitleStyle">
            这是字幕预览文字效果
          </div>
        </div>
      </div>

      <!-- 右侧：配置 -->
      <div class="config-section">
        <div class="config-card">
          <h4>字幕样式</h4>

          <div class="form-group">
            <label>字号: {{ store.subtitleStyle.font_size }}px</label>
            <input
              type="range"
              v-model.number="store.subtitleStyle.font_size"
              min="24"
              max="72"
              step="2"
              class="range-input"
            />
          </div>

          <div class="form-group">
            <label>颜色</label>
            <div class="color-row">
              <input type="color" v-model="store.subtitleStyle.color" class="color-input" />
              <span class="color-value">{{ store.subtitleStyle.color }}</span>
            </div>
          </div>

          <div class="form-group">
            <label>位置</label>
            <div class="position-btns">
              <button
                class="pos-btn"
                :class="{ active: store.subtitleStyle.position === 'top' }"
                @click="store.subtitleStyle.position = 'top'"
              >顶部</button>
              <button
                class="pos-btn"
                :class="{ active: store.subtitleStyle.position === 'center' }"
                @click="store.subtitleStyle.position = 'center'"
              >居中</button>
              <button
                class="pos-btn"
                :class="{ active: store.subtitleStyle.position === 'bottom' }"
                @click="store.subtitleStyle.position = 'bottom'"
              >底部</button>
            </div>
          </div>

          <div class="form-group">
            <label>背景色</label>
            <div class="color-row">
              <input type="color" v-model="store.subtitleStyle.bg_color" class="color-input" />
              <span class="color-value">{{ store.subtitleStyle.bg_color }}</span>
            </div>
          </div>

          <div class="form-group">
            <label>背景透明度: {{ Math.round(store.subtitleStyle.bg_opacity * 100) }}%</label>
            <input
              type="range"
              v-model.number="store.subtitleStyle.bg_opacity"
              min="0"
              max="1"
              step="0.05"
              class="range-input"
            />
          </div>
        </div>

        <button
          class="btn btn-primary btn-block"
          :disabled="store.executing"
          @click="handleSave"
        >
          {{ store.executing ? '保存中...' : '保存字幕设置' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProductionStore } from '@/stores/production'

const store = useProductionStore()

const previewBoxStyle = computed(() => ({
  position: 'relative' as const,
}))

const subtitleStyle = computed(() => ({
  fontSize: store.subtitleStyle.font_size + 'px',
  color: store.subtitleStyle.color,
  backgroundColor: store.subtitleStyle.bg_color,
  opacity: 1,
}))

async function handleSave() {
  await store.runStep(4, {
    subtitle_style: store.subtitleStyle,
  })
}
</script>

<style scoped>
.subtitle-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 20px;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
}

.preview-section h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.preview-box {
  width: 100%;
  aspect-ratio: 9 / 16;
  max-height: 500px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
}

.preview-video-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 14px;
}

.subtitle-overlay {
  width: 100%;
  text-align: center;
  padding: 8px 12px;
  font-weight: 600;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
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
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.range-input {
  width: 100%;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-input {
  width: 36px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 2px;
  cursor: pointer;
}

.color-value {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-family: monospace;
}

.position-btns {
  display: flex;
  gap: 4px;
}

.pos-btn {
  flex: 1;
  padding: 6px 0;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 13px;
}

.pos-btn.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
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

@media (max-width: 768px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }

  .preview-box {
    max-height: 300px;
  }
}
</style>
