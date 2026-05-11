<template>
  <div class="gen-panel">
    <div class="gen-form">
      <div class="form-group">
        <label>原始图片</label>
        <input v-model="imageUrl" class="form-input" placeholder="粘贴图片URL..." />
        <button v-if="projectAssets.length > 0" class="btn btn-text" @click="showPicker = true">从项目素材选择</button>
      </div>
      <div class="form-group">
        <label>编辑指令</label>
        <textarea v-model="instruction" class="form-input form-textarea" placeholder="描述你想做的修改，如：把背景换成海滩 / 添加文字'Hello' / 把天空变成日落..." rows="3"></textarea>
      </div>
      <button class="btn btn-primary btn-lg" :disabled="!imageUrl || !instruction.trim() || generating" @click="handleGenerate">
        {{ generating ? '编辑中...' : '开始编辑' }}
      </button>
    </div>

    <div v-if="showPicker" class="overlay" @click.self="showPicker = false">
      <div class="dialog dialog-lg">
        <div class="dialog-header">
          <h3>选择图片</h3>
          <button class="dialog-close" @click="showPicker = false">&times;</button>
        </div>
        <div class="dialog-body asset-picker-grid">
          <div v-for="a in projectAssets.filter(x => x.type === 'image' && x.status === 'completed')" :key="a.id" class="picker-item" @click="imageUrl = a.file_url ?? ''; showPicker = false">
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
const instruction = ref('')
const generating = ref(false)
const showPicker = ref(false)

const projectAssets = computed(() => store.assets)

async function handleGenerate() {
  if (!imageUrl.value || !instruction.value.trim()) return
  generating.value = true
  try {
    await store.generate({ project_id: props.projectId, task_type: 'jimeng_edit', image_url: imageUrl.value, edit_instruction: instruction.value.trim() })
    toast.success('图片编辑任务已提交')
    instruction.value = ''
  } catch (e: any) {
    toast.error(e?.response?.data?.error ?? '编辑失败')
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
.gen-panel { max-width: 640px; }
.gen-form { display: flex; flex-direction: column; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
.form-input { padding: 8px 12px; border: 1px solid var(--border-light, #e5e7eb); border-radius: 8px; font-size: 14px; box-sizing: border-box; }
.form-textarea { resize: vertical; font-family: inherit; min-height: 60px; }
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
