<template>
  <div class="gen-panel">
    <div class="gen-form">
      <div class="form-group">
        <label>图片</label>
        <div class="upload-area" :class="{ 'has-image': imageUrl }">
          <img v-if="imageUrl" :src="imageUrl" class="preview-img" />
          <div v-else class="upload-placeholder">
            <p>输入图片URL或从已生成素材中选择</p>
          </div>
        </div>
        <input v-model="imageUrl" class="form-input" placeholder="粘贴图片URL..." style="margin-top: 8px;" />
        <button v-if="projectAssets.length > 0" class="btn btn-text" @click="showAssetPicker = true">从项目素材选择</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>模型</label>
          <select v-model="model" class="form-input">
            <option value="seaweed_i2v">Seaweed（推荐）</option>
            <option value="seedance_i2v">Seedance</option>
            <option value="video_3_0_i2v">Video Gen 3.0</option>
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
      <div class="form-group">
        <label>首尾帧模式（可选）</label>
        <div class="checkbox-row">
          <label class="checkbox-label"><input type="checkbox" v-model="useFirstLastFrame" /> 启用首尾帧</label>
        </div>
        <input v-if="useFirstLastFrame" v-model="lastFrameUrl" class="form-input" placeholder="尾帧图片URL" style="margin-top: 8px;" />
      </div>
      <button class="btn btn-primary btn-lg" :disabled="!imageUrl || generating" @click="handleGenerate">
        {{ generating ? '生成中...' : '生成视频' }}
      </button>
    </div>

    <div v-if="showAssetPicker" class="overlay" @click.self="showAssetPicker = false">
      <div class="dialog dialog-lg">
        <div class="dialog-header">
          <h3>选择图片</h3>
          <button class="dialog-close" @click="showAssetPicker = false">&times;</button>
        </div>
        <div class="dialog-body asset-picker-grid">
          <div v-for="a in projectAssets.filter(x => x.type === 'image' && x.status === 'completed')" :key="a.id" class="picker-item" @click="imageUrl = a.file_url ?? ''; showAssetPicker = false">
            <img v-if="a.thumbnail_url" :src="a.thumbnail_url" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAiStudioStore } from '@/stores/aiStudio'
import { toast } from '@/utils/toast'

const props = defineProps<{ projectId: string }>()
const store = useAiStudioStore()

const imageUrl = ref('')
const model = ref('seaweed_i2v')
const duration = ref(5)
const useFirstLastFrame = ref(false)
const lastFrameUrl = ref('')
const generating = ref(false)
const showAssetPicker = ref(false)

const projectAssets = computed(() => store.assets)

async function handleGenerate() {
  if (!imageUrl.value) return
  generating.value = true
  try {
    const params: Record<string, unknown> = {
      project_id: props.projectId, task_type: 'jimeng_i2v',
      image_url: imageUrl.value, model: model.value, duration: duration.value,
    }
    if (useFirstLastFrame.value && lastFrameUrl.value) {
      params.first_frame_url = imageUrl.value
      params.last_frame_url = lastFrameUrl.value
      params.model = 'video_i2v_first_last'
    }
    await store.generate(params as any)
    toast.success('视频生成任务已提交')
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
.upload-area { border: 2px dashed var(--border-light, #e5e7eb); border-radius: 12px; overflow: hidden; min-height: 200px; display: flex; align-items: center; justify-content: center; }
.upload-placeholder { color: var(--text-tertiary); text-align: center; }
.preview-img { max-width: 100%; max-height: 300px; object-fit: contain; }
.checkbox-row { margin-top: 4px; }
.checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
.btn-lg { padding: 12px 24px; font-size: 15px; }
.btn-text { background: none; border: none; cursor: pointer; color: var(--brand-indigo, #6366F1); padding: 0; font-size: 13px; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.dialog { background: var(--bg-primary, #fff); border-radius: 12px; width: 600px; max-width: 90vw; max-height: 80vh; overflow-y: auto; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-light, #e5e7eb); }
.dialog-header h3 { margin: 0; }
.dialog-close { background: none; border: none; font-size: 20px; cursor: pointer; }
.asset-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; padding: 16px; }
.picker-item { border-radius: 8px; overflow: hidden; cursor: pointer; aspect-ratio: 1; }
.picker-item img { width: 100%; height: 100%; object-fit: cover; }
.picker-item:hover { box-shadow: 0 0 0 2px var(--brand-indigo, #6366F1); }
</style>
