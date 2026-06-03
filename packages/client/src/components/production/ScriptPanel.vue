<template>
  <div class="script-panel">
    <div class="panel-grid">
      <!-- 左侧：脚本编辑 -->
      <div class="editor-section">
        <div class="section-header">
          <h3>脚本编辑</h3>
          <div class="char-count">{{ charCount }} 字 · 预估 {{ estimatedDuration }}s</div>
        </div>
        <textarea
          v-model="store.fullText"
          class="script-textarea"
          placeholder="在这里编写或粘贴你的视频脚本...&#10;&#10;提示：口语化表达效果更好，每段控制在 3-5 句。"
          @input="handleInput"
        />
      </div>

      <!-- 右侧：配置 + 操作 -->
      <div class="config-section">
        <div class="config-card">
          <h4>视频设置</h4>
          <div class="form-group">
            <label>视频类型</label>
            <select v-model="store.videoType" class="input">
              <option value="knowledge">知识科普</option>
              <option value="story">故事叙述</option>
              <option value="list">清单列举</option>
              <option value="contrast">对比评测</option>
            </select>
          </div>
          <div class="form-group">
            <label>口语比例: {{ Math.round(store.oralRatio * 100) }}%</label>
            <input
              type="range"
              :value="store.oralRatio"
              min="0.3"
              max="1"
              step="0.05"
              class="range-input"
              @input="store.oralRatio = Number(($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <div class="config-card">
          <h4>AI 分镜</h4>
          <p class="hint-text">AI 将根据脚本内容自动拆分为分镜片段</p>
          <button
            class="btn btn-primary btn-block"
            :disabled="!store.fullText.trim() || store.executing"
            @click="handleGenerateStoryboard"
          >
            {{ store.executing ? '生成中...' : 'AI 生成分镜' }}
          </button>
        </div>

        <!-- 分镜预览 -->
        <div v-if="segmentCount > 0" class="config-card">
          <h4>分镜片段 ({{ segmentCount }})</h4>
          <div class="segment-preview">
            <div v-for="(seg, i) in segmentList" :key="seg.id" class="segment-item">
              <span class="seg-index">{{ i + 1 }}</span>
              <span class="seg-type">{{ seg.segmentType === 'oral' ? '口播' : seg.segmentType === 'visual' ? '画面' : '转场' }}</span>
              <span class="seg-text">{{ (seg.oralText || seg.visualDescription || '').slice(0, 40) }}{{ (seg.oralText || seg.visualDescription || '').length > 40 ? '...' : '' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProductionStore } from '@/stores/production'
import api from '@/api/client'

interface SegmentItem {
  id: number
  segmentType: string
  oralText: string | null
  visualDescription: string | null
  duration: number
}

const store = useProductionStore()
const segmentList = ref<SegmentItem[]>([])

const charCount = computed(() => store.fullText.length)
const estimatedDuration = computed(() => Math.max(1, Math.round(charCount.value / 5)))
const segmentCount = computed(() => segmentList.value.length)

function handleInput() {
  if (store.jobId && store.scriptId) {
    store.saveStepData(1, { full_text: store.fullText })
  }
}

async function handleGenerateStoryboard() {
  if (!store.scriptId) return

  // 先保存脚本文本
  await api.put(`/scripts/${store.scriptId}`, {
    full_text: store.fullText,
    video_type: store.videoType,
    oral_ratio: store.oralRatio,
  })

  // 执行分镜生成
  await store.runStep(1, { video_type: store.videoType })

  // 加载分镜列表
  if (store.scriptId) {
    try {
      const res = await api.get(`/scripts/${store.scriptId}`) as any
      segmentList.value = res.segments || []
    } catch {
      // 静默
    }
  }
}
</script>

<style scoped>
.script-panel {
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

.editor-section {
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
}

.char-count {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.script-textarea {
  flex: 1;
  min-height: 300px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
  width: 100%;
}

.script-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
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

.range-input {
  width: 100%;
}

.hint-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 10px;
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

.segment-preview {
  max-height: 200px;
  overflow-y: auto;
}

.segment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
}

.segment-item:last-child {
  border-bottom: none;
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

.seg-type {
  font-size: 12px;
  color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.seg-text {
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }

  .script-textarea {
    min-height: 200px;
  }
}
</style>
