<template>
  <div class="ai-generate-panel">
    <div class="panel-header">
      <h4>AI 画面生成</h4>
      <span class="hint-text">用即梦 AI 为每个画面段生成视频</span>
    </div>

    <div v-if="loading" class="loading-wrapper">加载分镜中...</div>

    <div v-else-if="visualSegments.length === 0" class="empty-hint">
      没有画面类型的分镜段
    </div>

    <div v-else class="segment-list">
      <div
        v-for="seg in visualSegments"
        :key="seg.id"
        class="segment-card"
        :class="{ generated: hasMaterial(seg) }"
      >
        <div class="seg-header">
          <span class="seg-index">{{ seg.segmentIndex + 1 }}</span>
          <span class="seg-type">画面</span>
          <span v-if="hasMaterial(seg)" class="badge success">已生成</span>
          <span v-else-if="generatingMap[seg.segmentIndex]" class="badge running">生成中...</span>
          <span class="duration-tag">{{ Number(seg.duration) }}s</span>
        </div>
        <div class="seg-desc">{{ seg.visualDescription }}</div>
        <div class="seg-actions">
          <button
            v-if="!hasMaterial(seg) && !generatingMap[seg.segmentIndex]"
            class="btn btn-primary btn-sm"
            @click="handleGenerate(seg)"
          >
            🎬 AI 生成
          </button>
          <button
            v-if="generatingMap[seg.segmentIndex]"
            class="btn btn-sm"
            disabled
          >
            ⏳ 轮询中...
          </button>
          <button
            v-if="hasMaterial(seg)"
            class="btn btn-outline btn-sm"
            @click="handleRegenerate(seg)"
          >
            🔄 重新生成
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import api from '@/api/client'

interface SegmentItem {
  id: number
  segmentIndex: number
  segmentType: string
  visualDescription: string
  duration: number
  materialIds: string[]
  oralAudioUrl: string | null
}

const props = defineProps<{ jobId: string; scriptId: number }>()
const segments = ref<SegmentItem[]>([])
const loading = ref(false)
const generatingMap = ref<Record<number, boolean>>({})

const visualSegments = computed(() =>
  segments.value.filter(s => s.segmentType === 'visual' || s.segmentType === 'oral'),
)

function hasMaterial(seg: SegmentItem): boolean {
  return seg.materialIds.length > 0
}

onMounted(() => { loadSegments() })

async function loadSegments() {
  if (!props.scriptId) return
  loading.value = true
  try {
    const res = await api.get(`/scripts/${props.scriptId}`) as any
    segments.value = res.segments || []
  } catch {
    segments.value = []
  } finally {
    loading.value = false
  }
}

async function handleGenerate(seg: SegmentItem) {
  generatingMap.value[seg.segmentIndex] = true
  try {
    const res = await api.post(
      `/pipeline/production/${props.jobId}/segment/${seg.segmentIndex}/generate-visual`,
      { duration: Number(seg.duration) },
    ) as any

    // 轮询任务状态
    await pollTask(res.task_id, seg.segmentIndex)
  } catch {
    // toast by api client
  } finally {
    generatingMap.value[seg.segmentIndex] = false
  }
}

async function handleRegenerate(seg: SegmentItem) {
  await handleGenerate(seg)
}

async function pollTask(taskId: string, _segmentIndex: number, maxAttempts = 60): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000))
    try {
      const task = await api.get(
        `/pipeline/production/${props.jobId}/visual-task/${taskId}/status`,
      ) as any

      if (task.status === 'success') {
        await loadSegments()
        return
      }
      if (task.status === 'failed') {
        throw new Error(task.error || 'AI 画面生成失败')
      }
    } catch {
      // 继续轮询
    }
  }
  throw new Error('AI 画面生成超时')
}
</script>

<style scoped>
.ai-generate-panel {
  padding: 4px 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-header h4 { margin: 0; font-size: 15px; }

.hint-text { font-size: 12px; color: var(--color-text-secondary); }

.segment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow-y: auto;
}

.segment-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  border-left: 3px solid var(--color-border);
}

.segment-card.generated {
  border-left-color: #10B981;
}

.seg-header {
  display: flex;
  align-items: center;
  gap: 6px;
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

.seg-type {
  font-size: 11px;
  color: #8B5CF6;
  background: rgba(139, 92, 246, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.badge.success { color: #10B981; background: rgba(16, 185, 129, 0.1); }
.badge.running { color: #3B82F6; background: rgba(59, 130, 246, 0.1); }

.duration-tag {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: auto;
}

.seg-desc {
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.4;
  margin-bottom: 8px;
}

.seg-actions {
  display: flex;
  gap: 6px;
}

.btn {
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 12px;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn-outline { color: var(--color-primary); border-color: var(--color-primary); }
.btn-sm { padding: 4px 10px; font-size: 12px; }

.loading-wrapper { text-align: center; padding: 40px; color: var(--color-text-secondary); }
.empty-hint { text-align: center; padding: 30px; color: var(--color-text-secondary); font-size: 13px; }
</style>
