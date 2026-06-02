<template>
  <div class="ai-float">
    <!-- 展开态 -->
    <div v-if="!collapsed" class="ai-float-panel">
      <div class="panel-header">
        <span class="panel-title">AI 建议</span>
        <button class="panel-close" @click="collapsed = true">−</button>
      </div>
      <div class="panel-body">
        <!-- loading -->
        <div v-if="loading" class="skeleton-list">
          <div v-for="i in 3" :key="i" class="skeleton-item">
            <div class="skeleton-bar w60"></div>
            <div class="skeleton-bar w100"></div>
          </div>
        </div>

        <!-- 有建议 -->
        <div v-else-if="suggestions.length > 0" class="suggest-list">
          <div v-for="item in suggestions" :key="item.title" class="suggest-item">
            <span class="priority-tag" :class="item.priority">{{ priorityLabel(item.priority) }}</span>
            <div class="suggest-body">
              <div class="suggest-title">{{ item.title }}</div>
              <div class="suggest-reason">{{ item.reason }}</div>
              <button class="suggest-action" @click="goAction(item)">
                {{ actionLabel(item.type) }}
              </button>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <div class="empty-icon">💡</div>
          <div class="empty-text">暂无建议</div>
          <div class="empty-hint">完善品牌画像后可获得个性化建议</div>
        </div>
      </div>
    </div>

    <!-- 收缩态 -->
    <button v-else class="ai-float-btn" @click="open">
      <span class="btn-icon">💡</span>
      <span v-if="suggestions.length > 0" class="btn-badge">{{ suggestions.length }}</span>
      <span class="btn-pulse"></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAiHubStore } from '@/stores/aiHub'
import type { StrategyRecommendation } from '@/api/aiHub'

const router = useRouter()
const aiHub = useAiHubStore()

const collapsed = ref(true)
const loading = ref(false)
const suggestions = ref<StrategyRecommendation[]>([])
let timer: ReturnType<typeof setInterval> | undefined

const ROUTE_MAP: Record<string, string> = {
  topic: '/topic-workbench',
  hotspot: '/topic-workbench',
  follow_up: '/crm',
  moments: '/private-domain',
  content_improve: '/ai-studio',
}

function priorityLabel(p: string): string {
  return { high: '高优', medium: '中优', low: '一般' }[p] ?? p
}

function actionLabel(type: string): string {
  return { topic: '去选题', hotspot: '去评估', follow_up: '去跟进', moments: '去私域', content_improve: '去优化' }[type] ?? '查看'
}

function goAction(item: StrategyRecommendation) {
  const route = ROUTE_MAP[item.type]
  if (route) router.push(route)
}

async function load() {
  loading.value = true
  try {
    await aiHub.loadRecommendations()
    suggestions.value = aiHub.recommendations
  } finally {
    loading.value = false
  }
}

function open() {
  collapsed.value = false
  load()
}

onMounted(() => {
  timer = setInterval(load, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.ai-float {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2000;
}

/* ---- 收缩按钮 ---- */
.ai-float-btn {
  position: relative;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
  transition: transform 0.2s, box-shadow 0.2s;
}
.ai-float-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 28px rgba(102, 126, 234, 0.55);
}
.btn-icon {
  font-size: 24px;
  line-height: 1;
}
.btn-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #ff4d4f;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(102, 126, 234, 0.5);
  animation: pulse 2s ease-out infinite;
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}

/* ---- 面板 ---- */
.ai-float-panel {
  width: 380px;
  max-height: 480px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.2s ease;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
}
.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
}
.panel-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 16px;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.panel-close:hover {
  background: #e8e8e8;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* ---- 建议卡片 ---- */
.suggest-item {
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  transition: background 0.15s;
}
.suggest-item:hover {
  background: #fafafa;
}

.priority-tag {
  flex-shrink: 0;
  width: 42px;
  height: 22px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}
.priority-tag.high {
  background: #fff1f0;
  color: #ff4d4f;
}
.priority-tag.medium {
  background: #fff7e6;
  color: #fa8c16;
}
.priority-tag.low {
  background: #f0f5ff;
  color: #2f54eb;
}

.suggest-body {
  flex: 1;
  min-width: 0;
}
.suggest-title {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  line-height: 1.4;
}
.suggest-reason {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
  margin-top: 2px;
}
.suggest-action {
  margin-top: 6px;
  padding: 2px 10px;
  border: 1px solid #1890ff;
  border-radius: 4px;
  background: transparent;
  color: #1890ff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.suggest-action:hover {
  background: #e6f7ff;
}

/* ---- 空状态 ---- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
}
.empty-icon {
  font-size: 36px;
  margin-bottom: 10px;
}
.empty-text {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}
.empty-hint {
  font-size: 12px;
  color: #bbb;
  margin-top: 4px;
}

/* ---- 骨架 ---- */
.skeleton-list {
  padding: 12px 16px;
}
.skeleton-item {
  margin-bottom: 16px;
}
.skeleton-bar {
  height: 14px;
  border-radius: 4px;
  background: #f0f0f0;
  animation: shimmer 1.2s infinite;
}
.skeleton-bar.w60 {
  width: 60%;
}
.skeleton-bar.w100 {
  width: 100%;
  margin-top: 8px;
}
@keyframes shimmer {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}
</style>
