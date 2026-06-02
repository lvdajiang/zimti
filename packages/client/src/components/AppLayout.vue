<template>
  <div class="app-layout">
    <!-- Mobile overlay -->
    <div v-if="mobileMenuOpen" class="sidebar-overlay" @click="mobileMenuOpen = false"></div>

    <aside class="sidebar" :class="{ collapsed: appStore.sidebarCollapsed, 'mobile-open': mobileMenuOpen }">
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
          @click="mobileMenuOpen = false"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <main class="main-content">
      <header class="top-bar">
        <button class="toggle-btn" @click="appStore.sidebarCollapsed ? appStore.sidebarCollapsed = false : appStore.toggleSidebar(); mobileMenuOpen = true">☰</button>
        <span class="page-title">{{ currentTitle }}</span>
      </header>
      <div class="page-content">
        <RouterView v-slot="{ Component }">
          <Transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>
    </main>

    <AiSuggestFloat />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import AiSuggestFloat from './AiSuggestFloat.vue'

const route = useRoute()
const appStore = useAppStore()
const mobileMenuOpen = ref(false)

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
  { label: '视频预览', route: '/video-preview' },
  { label: 'AI工作室', route: '/ai-studio' },
  { label: 'AI工具箱', route: '/ai-toolbox' },
  { label: '知识库', route: '/knowledge' },
  { label: '供应商', route: '/entities' },
  { label: '客户管理', route: '/crm' },
  { label: '私域运营', route: '/private-domain' },
  { label: '群聊分析', route: '/group-chat' },
  { label: '运营日历', route: '/operation-calendar' },
  { label: '一键流水线', route: '/pipeline' },
  { label: 'IP 定位', route: '/interview' },
  { label: '数据监控', route: '/monitoring' },
  { label: '内容资产', route: '/content-assets' },
]
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
}

/* ---- Sidebar ---- */
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-sidebar);
  color: var(--color-sidebar-text);
  display: flex;
  flex-direction: column;
  transition: width var(--transition), transform var(--transition);
  flex-shrink: 0;
  overflow-y: auto;
}
.sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}
.sidebar-header {
  padding: var(--space-4);
  font-size: var(--font-size-xl);
  font-weight: bold;
  flex-shrink: 0;
}
.logo {
  color: var(--color-sidebar-active);
}
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2);
}
.nav-item {
  padding: 10px var(--space-3);
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--color-sidebar-text);
  font-size: var(--font-size-base);
  white-space: nowrap;
  overflow: hidden;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}
.nav-item--active {
  background: rgba(79, 195, 247, 0.15);
  color: var(--color-sidebar-active);
}

/* Mobile overlay */
.sidebar-overlay {
  display: none;
}
/* ---- Main content ---- */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}
.top-bar {
  height: var(--topbar-height);
  padding: 0 var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  flex-shrink: 0;
}
.toggle-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  color: var(--color-text);
}
.page-title {
  font-size: var(--font-size-md);
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-content {
  flex: 1;
  padding: var(--content-padding);
  overflow-y: auto;
  background: var(--color-bg-secondary);
}

/* ---- Responsive: Mobile ---- */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 900;
    width: var(--sidebar-width);
    transform: translateX(-100%);
  }
  .sidebar.mobile-open {
    transform: translateX(0);
  }
  .sidebar.collapsed {
    width: var(--sidebar-width);
  }
  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 899;
    background: rgba(0, 0, 0, 0.45);
  }
  .page-content {
    padding: var(--space-3);
  }
  .top-bar {
    padding: 0 var(--space-3);
  }
}
</style>
