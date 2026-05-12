<template>
  <div class="app-layout">
    <aside class="sidebar" :class="{ collapsed: appStore.sidebarCollapsed }">
      <div class="sidebar-header">
        <span v-if="!appStore.sidebarCollapsed" class="logo">Zimti</span>
      </div>
      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.route"
          :to="item.route"
          class="nav-item"
          active-class="nav-item--active"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>
    <main class="main-content">
      <header class="top-bar">
        <button class="toggle-btn" @click="appStore.toggleSidebar">☰</button>
        <span class="page-title">{{ currentTitle }}</span>
      </header>
      <div class="page-content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const appStore = useAppStore()

const currentTitle = computed(() => (route.meta.title as string) ?? '')

const navItems = [
  { label: '仪表盘', route: '/dashboard' },
  { label: '热点追踪', route: '/hotspots' },
  { label: '对标账号', route: '/benchmark-accounts' },
  { label: '数据采集', route: '/collect-tasks' },
  { label: '爆款视频', route: '/viral-videos' },
  { label: '选题工作台', route: '/topic-workbench' },
  { label: '人设配置', route: '/persona' },
  { label: '素材库', route: '/materials' },
  { label: 'AI工作室', route: '/ai-studio' },
  { label: 'AI工具箱', route: '/ai-toolbox' },
  { label: '知识库', route: '/knowledge' },
  { label: '数据监控', route: '/monitoring' },
  { label: '内容资产', route: '/content-assets' },
]
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
}
.sidebar {
  width: 220px;
  background: #1a1a2e;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  transition: width 0.2s;
  flex-shrink: 0;
}
.sidebar.collapsed {
  width: 56px;
}
.sidebar-header {
  padding: 16px;
  font-size: 20px;
  font-weight: bold;
}
.logo {
  color: #4fc3f7;
}
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
}
.nav-item {
  padding: 10px 12px;
  border-radius: 6px;
  text-decoration: none;
  color: #b0b0b0;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
}
.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}
.nav-item--active {
  background: rgba(79, 195, 247, 0.15);
  color: #4fc3f7;
}
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.top-bar {
  height: 48px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #e8e8e8;
  background: #fff;
  flex-shrink: 0;
}
.toggle-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}
.page-title {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}
.page-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  background: #f5f5f5;
}
</style>
