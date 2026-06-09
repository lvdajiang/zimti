<template>
  <div class="export-panel">
    <div class="panel-header">
      <h4>导出</h4>
    </div>

    <div class="export-cards">
      <!-- Remotion MP4 -->
      <div class="export-card" :class="{ active: exportMode === 'remotion' }" @click="exportMode = 'remotion'">
        <div class="card-icon">📹</div>
        <div class="card-title">Remotion 渲染 MP4</div>
        <div class="card-desc">全自动渲染，适合不需要精剪的视频</div>
        <div class="card-tag">全自动</div>
      </div>

      <!-- 剪映草稿 -->
      <div class="export-card" :class="{ active: exportMode === 'jianying' }" @click="exportMode = 'jianying'">
        <div class="card-icon">✂️</div>
        <div class="card-title">导出剪映草稿</div>
        <div class="card-desc">生成剪映可编辑的草稿文件，用剪映精剪</div>
        <div class="card-tag">人工精剪</div>
      </div>
    </div>

    <div class="export-actions">
      <button
        class="btn btn-primary btn-block"
        :disabled="!exportMode || exporting"
        @click="handleExport"
      >
        {{ exporting ? '导出中...' : exportMode === 'remotion' ? '开始渲染 MP4' : '生成剪映草稿' }}
      </button>
    </div>

    <!-- Remotion 渲染进度 -->
    <div v-if="renderJobId" class="render-section">
      <p>渲染任务: {{ renderJobId }}</p>
      <p class="hint-text">渲染完成后可在「画面」步骤中查看和下载视频</p>
    </div>

    <!-- 剪映下载 -->
    <div v-if="jianyingDraft" class="jianying-section">
      <p>剪映草稿已生成 ✅</p>
      <button class="btn btn-outline" @click="handleDownload">⬇ 下载 draft_content.json</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import api from '@/api/client'

const props = defineProps<{ jobId: string }>()
const exportMode = ref<'remotion' | 'jianying' | ''>('')
const exporting = ref(false)
const renderJobId = ref('')
const jianyingDraft = ref<Record<string, unknown> | null>(null)

async function handleExport() {
  if (!exportMode.value) return
  exporting.value = true
  renderJobId.value = ''
  jianyingDraft.value = null

  try {
    if (exportMode.value === 'remotion') {
      const res = await api.post(`/pipeline/production/${props.jobId}/export/remotion`) as any
      renderJobId.value = res.render_job_id
    } else {
      const res = await api.post(`/pipeline/production/${props.jobId}/export/jianying`) as any
      jianyingDraft.value = res
    }
  } catch {
    // toast by api client
  } finally {
    exporting.value = false
  }
}

function handleDownload() {
  if (!jianyingDraft.value) return
  const blob = new Blob([JSON.stringify(jianyingDraft.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'draft_content.json'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.export-panel { padding: 4px 0; }

.panel-header { margin-bottom: 12px; }
.panel-header h4 { margin: 0; font-size: 15px; }

.export-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.export-card {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.export-card:hover { border-color: var(--color-primary); }
.export-card.active { border-color: var(--color-primary); background: rgba(59, 130, 246, 0.05); }

.card-icon { font-size: 24px; margin-bottom: 8px; }
.card-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.card-desc { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px; }
.card-tag { font-size: 11px; color: var(--color-primary); background: rgba(59, 130, 246, 0.1); padding: 2px 8px; border-radius: 4px; display: inline-block; }

.btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 14px;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn-outline { color: var(--color-primary); border-color: var(--color-primary); background: transparent; }
.btn-block { width: 100%; }

.render-section, .jianying-section {
  margin-top: 12px;
  padding: 12px;
  background: var(--color-background);
  border-radius: 6px;
  font-size: 13px;
}

.hint-text { font-size: 12px; color: var(--color-text-secondary); }
</style>
