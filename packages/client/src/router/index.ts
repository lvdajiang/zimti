import { createRouter, createWebHistory } from 'vue-router'
import { ROUTES } from '@zimti/shared'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: ROUTES.DASHBOARD,
    },
    {
      path: ROUTES.DASHBOARD,
      name: 'Dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: '仪表盘' },
    },
    {
      path: ROUTES.HOTSPOTS,
      name: 'Hotspots',
      component: () => import('@/views/HotspotsView.vue'),
      meta: { title: '热点追踪' },
    },
    {
      path: ROUTES.BENCHMARK_ACCOUNTS,
      name: 'BenchmarkAccounts',
      component: () => import('@/views/BenchmarkAccountsView.vue'),
      meta: { title: '对标账号' },
    },
    {
      path: ROUTES.COLLECT_TASKS,
      name: 'CollectTasks',
      component: () => import('@/views/CollectTasksView.vue'),
      meta: { title: '数据采集' },
    },
    {
      path: ROUTES.VIRAL_VIDEOS,
      name: 'ViralVideos',
      component: () => import('@/views/ViralVideosView.vue'),
      meta: { title: '爆款视频库' },
    },
    {
      path: ROUTES.VIRAL_VIDEO_DETAIL,
      name: 'ViralVideoDetail',
      component: () => import('@/views/ViralVideoDetailView.vue'),
      meta: { title: '视频详情' },
    },
    {
      path: ROUTES.TOPIC_WORKBENCH,
      name: 'TopicWorkbench',
      component: () => import('@/views/TopicWorkbenchView.vue'),
      meta: { title: '选题工作台' },
    },
    {
      path: ROUTES.PERSONA,
      name: 'Persona',
      component: () => import('@/views/PersonaView.vue'),
      meta: { title: '人设配置' },
    },
    {
      path: ROUTES.SCRIPT_EDITOR,
      name: 'ScriptEditor',
      component: () => import('@/views/ScriptEditorView.vue'),
      meta: { title: '脚本编辑器' },
    },
    {
      path: ROUTES.MATERIALS,
      name: 'Materials',
      component: () => import('@/views/MaterialsView.vue'),
      meta: { title: '素材库' },
    },
    {
      path: ROUTES.VIDEO_PREVIEW,
      name: 'VideoPreview',
      component: () => import('@/views/VideoPreviewView.vue'),
      meta: { title: '视频预览与渲染' },
    },
    {
      path: ROUTES.PUBLISH,
      name: 'Publish',
      component: () => import('@/views/PublishView.vue'),
      meta: { title: '发布工作台' },
    },
    {
      path: ROUTES.MONITORING,
      name: 'Monitoring',
      component: () => import('@/views/MonitoringView.vue'),
      meta: { title: '数据监控' },
    },
    {
      path: ROUTES.CONTENT_ASSETS,
      name: 'ContentAssets',
      component: () => import('@/views/ContentAssetsView.vue'),
      meta: { title: '内容资产库' },
    },
    {
      path: ROUTES.AI_STUDIO,
      name: 'AiStudio',
      component: () => import('@/views/AiStudioView.vue'),
      meta: { title: 'AI工作室' },
    },
    {
      path: ROUTES.AI_STUDIO_PROJECT,
      name: 'AiStudioProject',
      component: () => import('@/views/AiStudioProjectView.vue'),
      meta: { title: 'AI工作室' },
    },
    {
      path: '/ai-toolbox',
      name: 'AiToolbox',
      component: () => import('@/views/AiToolboxView.vue'),
      meta: { title: 'AI工具箱' },
    },
    {
      path: '/knowledge',
      name: 'Knowledge',
      component: () => import('@/views/KnowledgeView.vue'),
      meta: { title: '知识库' },
    },
  ],
})

router.beforeEach((to) => {
  const title = (to.meta.title as string) ?? 'Zimti'
  document.title = `${title} — Zimti`
})

export default router
