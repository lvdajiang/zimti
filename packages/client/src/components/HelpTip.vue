<template>
  <div class="help-tip" :class="{ expanded }">
    <button class="help-trigger" @click="expanded = !expanded" :title="expanded ? '收起' : '使用指引'">
      <span class="help-icon">?</span>
    </button>
    <div v-if="expanded" class="help-content">
      <div class="help-header">
        <span class="help-title">{{ title }}</span>
        <button class="help-close" @click="expanded = false">&times;</button>
      </div>
      <div class="help-body">
        <div v-for="(step, i) in steps" :key="i" class="help-step">
          <span class="step-num">{{ i + 1 }}</span>
          <span class="step-text">{{ step }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title: string
  steps: string[]
}>()

const expanded = ref(false)
</script>

<style scoped>
.help-tip {
  position: relative;
  display: inline-block;
}
.help-trigger {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid #b0b0b0;
  background: #fff;
  color: #888;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  line-height: 1;
}
.help-trigger:hover {
  border-color: #4a6cf7;
  color: #4a6cf7;
}
.help-content {
  position: absolute;
  top: 28px;
  right: 0;
  width: 320px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  z-index: 100;
  overflow: hidden;
}
.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #f8f9fc;
  border-bottom: 1px solid #eee;
}
.help-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}
.help-close {
  background: none;
  border: none;
  font-size: 16px;
  color: #999;
  cursor: pointer;
  padding: 0 2px;
}
.help-body {
  padding: 12px 14px;
}
.help-step {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: flex-start;
}
.help-step:last-child {
  margin-bottom: 0;
}
.step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #4a6cf7;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.step-text {
  font-size: 13px;
  color: #555;
  line-height: 1.5;
}
</style>
