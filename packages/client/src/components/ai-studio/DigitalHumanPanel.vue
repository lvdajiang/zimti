<template>
  <div class="gen-panel">
    <div class="gen-form">
      <div class="form-group">
        <label>人物照片</label>
        <input v-model="imageUrl" class="form-input" placeholder="粘贴人物照片URL（正面半身照效果最佳）" />
      </div>
      <div class="form-group">
        <label>配音文本（将自动生成语音）</label>
        <textarea v-model="ttsText" class="form-input form-textarea" placeholder="输入口播文本，如：大家好，今天给大家分享一个旅行小技巧..." rows="4"></textarea>
      </div>
      <div class="form-group">
        <label>或上传音频文件URL（可选，优先级高于文本）</label>
        <input v-model="audioUrl" class="form-input" placeholder="粘贴音频文件URL" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>模型</label>
          <select v-model="model" class="form-input">
            <option value="omnihuman_1_0">OmniHuman 1.0</option>
            <option value="omnihuman_1_5">OmniHuman 1.5（推荐）</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-lg" :disabled="!imageUrl || (!ttsText.trim() && !audioUrl) || generating" @click="handleGenerate">
        {{ generating ? '生成中...' : '生成数字人视频' }}
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

const imageUrl = ref('')
const ttsText = ref('')
const audioUrl = ref('')
const model = ref('omnihuman_1_5')
const generating = ref(false)

async function handleGenerate() {
  if (!imageUrl.value) return
  generating.value = true
  try {
    const params: Record<string, unknown> = {
      project_id: props.projectId, task_type: 'jimeng_digital_human',
      image_url: imageUrl.value, model: model.value,
    }
    if (audioUrl.value) {
      params.audio_url = audioUrl.value
    } else {
      params.prompt = ttsText.value.trim()
    }
    await store.generate(params as any)
    toast.success('数字人视频生成任务已提交')
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
