<template>
  <div class="empty-state">
    <div class="empty-state-icon">{{ icon }}</div>
    <div class="empty-state-text">{{ text }}</div>
    <div v-if="description" class="empty-state-desc">{{ description }}</div>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  text: string
  description?: string
}>(), {
  icon: '📭',
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #999;
}
.empty-state-icon {
  font-size: 40px;
  margin-bottom: 12px;
}
.empty-state-text {
  font-size: 14px;
  color: #666;
}
.empty-state-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>
