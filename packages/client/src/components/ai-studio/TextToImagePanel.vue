<template>
  <div class="gen-panel">
    <div class="gen-form">
      <div class="form-group">
        <label>描述</label>
        <textarea v-model="prompt" class="form-input form-textarea" placeholder="描述你想生成的图片，如：夕阳下的海边沙滩，椰子树，温暖的色调..." rows="4"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>模型</label>
          <select v-model="model" class="form-input">
            <option value="seedream_4_0">Seedream 4.0（推荐）</option>
            <option value="seedream_5_0">Seedream 5.0（最新）</option>
            <option value="seedream_3_0">Seedream 3.0</option>
          </select>
        </div>
        <div class="form-group">
          <label>尺寸</label>
          <select v-model="size" class="form-input">
            <option value="1024x1024">1024 x 1024（正方形）</option>
            <option value="1280x720">1280 x 720（横版16:9）</option>
            <option value="720x1280">720 x 1280（竖版9:16）</option>
            <option value="960x1280">960 x 1280（小红书）</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>批量数量</label>
          <select v-model.number="batchCount" class="form-input">
            <option :value="1">1 张</option>
            <option :value="2">2 张</option>
            <option :value="3">3 张</option>
            <option :value="4">4 张</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-lg" :disabled="!prompt.trim() || generating" @click="handleGenerate">
        {{ generating ? '生成中...' : '生成图片' }}
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
const model = ref('seedream_4_0')
const size = ref('1024x1024')
const batchCount = ref(1)
const generating = ref(false)

async function handleGenerate() {
  if (!prompt.value.trim()) return
  generating.value = true
  try {
    const [w, h] = size.value.split('x').map(Number)
    for (let i = 0; i < batchCount.value; i++) {
      await store.generate({ project_id: props.projectId, task_type: 'jimeng_t2i', prompt: prompt.value.trim(), model: model.value, width: w, height: h })
    }
    toast.success(`已提交 ${batchCount.value} 个生成任务`)
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
