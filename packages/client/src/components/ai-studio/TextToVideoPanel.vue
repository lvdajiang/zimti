<template>
  <div class="gen-panel">
    <div class="gen-form">
      <div class="form-group">
        <label>视频描述</label>
        <textarea v-model="prompt" class="form-input form-textarea" placeholder="描述你想生成的视频画面，如：一只猫在阳光下的窗台上伸懒腰..." rows="4"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>模型</label>
          <select v-model="model" class="form-input">
            <option value="seaweed_t2v">Seaweed（推荐）</option>
            <option value="seedance_t2v">Seedance</option>
            <option value="video_3_0_t2v">Video Gen 3.0</option>
          </select>
        </div>
        <div class="form-group">
          <label>时长</label>
          <select v-model.number="duration" class="form-input">
            <option :value="5">5 秒</option>
            <option :value="10">10 秒</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-lg" :disabled="!prompt.trim() || generating" @click="handleGenerate">
        {{ generating ? '生成中...' : '生成视频' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAiStudioStore } from '@/stores/aiStudio'
import { toast } from '@/utils/toast'

const props = defineProps<{ projectId: string }>()
const store = useAiStudioStore()

const prompt = ref('')
const model = ref('seaweed_t2v')
const duration = ref(5)
const generating = ref(false)

async function handleGenerate() {
  if (!prompt.value.trim()) return
  generating.value = true
  try {
    await store.generate({ project_id: props.projectId, task_type: 'jimeng_t2v', prompt: prompt.value.trim(), model: model.value, duration: duration.value })
    toast.success('视频生成任务已提交')
    prompt.value = ''
  } catch (e: any) {
    toast.error(e?.response?.data?.error ?? '生成失败')
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
.gen-panel { max-width: 640px; }
.gen-form { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
.form-input { padding: 8px 12px; border: 1px solid var(--border-light, #e5e7eb); border-radius: 8px; font-size: 14px; box-sizing: border-box; }
.form-textarea { resize: vertical; font-family: inherit; min-height: 80px; }
.btn-lg { padding: 12px 24px; font-size: 15px; }
</style>
