<template>
  <div class="asset-grid-panel">
    <div v-if="assets.length === 0" class="empty-state">
      <p>暂无已生成的素材</p>
    </div>
    <div v-else class="asset-grid">
      <div v-for="asset in assets" :key="asset.id" class="asset-card" :class="{ selected: selectedIds.has(asset.id), failed: asset.status === 'failed' }">
        <div class="asset-thumb">
          <img v-if="asset.thumbnail_url" :src="asset.thumbnail_url" loading="lazy" />
          <video v-else-if="asset.type === 'video' && asset.file_url" :src="asset.file_url" muted preload="metadata" />
          <div v-else class="thumb-placeholder">{{ asset.type === 'image' ? '🖼' : '🎬' }}</div>
          <div class="asset-check" @click.stop="$emit('toggle', asset)">
            <span v-if="selectedIds.has(asset.id)">✓</span>
          </div>
          <div v-if="asset.status === 'failed'" class="asset-error-badge">失败</div>
          <div v-if="asset.type === 'video' && asset.duration" class="asset-duration">{{ asset.duration }}s</div>
        </div>
        <div class="asset-info">
          <span class="asset-type-badge">{{ taskLabel(asset.task_type) }}</span>
          <button class="asset-delete" @click.stop="$emit('delete', asset.id)" title="删除">&times;</button>
        </div>
        <div v-if="asset.error" class="asset-error-text">{{ asset.error }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiStudioAsset } from '@/api/aiStudio'

defineProps<{
  assets: AiStudioAsset[]
  selectedIds: Set<string>
}>()

defineEmits<{
  toggle: [asset: AiStudioAsset]
  delete: [id: string]
}>()

const taskLabel = (t: string) => ({ jimeng_t2i: '文生图', jimeng_i2v: '图生视频', jimeng_t2v: '文生视频', jimeng_edit: '图片编辑', jimeng_digital_human: '数字人' }[t] ?? t)
</script>

<style scoped>
.asset-grid-panel { width: 100%; }
.empty-state { text-align: center; padding: 40px; color: var(--text-tertiary); }

.asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.asset-card {
  border: 2px solid var(--border-light, #e5e7eb); border-radius: 10px; overflow: hidden;
  transition: border-color 0.2s; cursor: pointer; position: relative;
}
.asset-card.selected { border-color: var(--brand-indigo, #6366F1); }
.asset-card.failed { border-color: #ef4444; }

.asset-thumb { position: relative; aspect-ratio: 1; overflow: hidden; background: #f3f4f6; }
.asset-thumb img, .asset-thumb video { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 32px; }

.asset-check {
  position: absolute; top: 6px; left: 6px; width: 22px; height: 22px;
  border-radius: 4px; border: 2px solid rgba(255,255,255,0.8); background: rgba(0,0,0,0.2);
  display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: bold;
}
.asset-card.selected .asset-check { background: var(--brand-indigo, #6366F1); border-color: var(--brand-indigo, #6366F1); }

.asset-error-badge { position: absolute; top: 6px; right: 6px; background: #ef4444; color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
.asset-duration { position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 4px; }

.asset-info { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; }
.asset-type-badge { font-size: 11px; color: var(--text-secondary); }
.asset-delete { background: none; border: none; cursor: pointer; font-size: 16px; color: var(--text-tertiary); }
.asset-delete:hover { color: #ef4444; }

.asset-error-text { padding: 0 8px 8px; font-size: 11px; color: #ef4444; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
