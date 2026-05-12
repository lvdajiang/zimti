<template>
  <div class="page-skeleton">
    <div class="skeleton-header">
      <div class="skeleton-bar" style="width: 200px; height: 24px" />
      <div class="skeleton-bar" style="width: 120px; height: 32px" />
    </div>
    <div class="skeleton-body">
      <div v-for="i in rows" :key="i" class="skeleton-row">
        <div class="skeleton-bar" style="flex: 1; height: 16px" />
        <div class="skeleton-bar" style="width: 80px; height: 16px" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  rows?: number
}>(), {
  rows: 5,
})
</script>

<style scoped>
.page-skeleton {
  padding: 24px;
}
.skeleton-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.skeleton-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
}
.skeleton-bar {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
