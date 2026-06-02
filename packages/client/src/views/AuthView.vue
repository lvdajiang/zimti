<template>
  <div class="auth-page">
    <!-- 未登录：登录/注册表单 -->
    <div v-if="!authStore.user" class="auth-card">
      <div class="auth-header">
        <h2 class="auth-title">Zimti</h2>
        <p class="auth-subtitle">AI 驱动的旅行自媒体内容生产系统</p>
      </div>

      <div class="auth-tabs">
        <button
          class="tab-btn"
          :class="{ active: mode === 'login' }"
          @click="mode = 'login'"
        >登录</button>
        <button
          class="tab-btn"
          :class="{ active: mode === 'register' }"
          @click="mode = 'register'"
        >注册</button>
      </div>

      <!-- 登录表单 -->
      <form v-if="mode === 'login'" class="auth-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="loginForm.username" type="text" placeholder="请输入用户名" required />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="loginForm.password" type="password" placeholder="请输入密码" required />
        </div>
        <p v-if="authStore.loginError" class="error-msg">{{ authStore.loginError }}</p>
        <button type="submit" class="submit-btn" :disabled="authStore.loading">
          {{ authStore.loading ? '登录中...' : '登录' }}
        </button>
        <button type="button" class="demo-btn" @click="handleDemoLogin" :disabled="authStore.loading">
          演示模式体验
        </button>
      </form>

      <!-- 注册表单 -->
      <form v-else class="auth-form" @submit.prevent="handleRegister">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="registerForm.username" type="text" placeholder="请输入用户名" required />
        </div>
        <div class="form-group">
          <label>邮箱 <span class="optional">(选填)</span></label>
          <input v-model="registerForm.email" type="email" placeholder="your@email.com" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="registerForm.password" type="password" placeholder="至少 6 位" required minlength="6" />
        </div>
        <div class="form-group">
          <label>确认密码</label>
          <input v-model="registerForm.confirmPassword" type="password" placeholder="再次输入密码" required />
        </div>
        <p v-if="authStore.loginError" class="error-msg">{{ authStore.loginError }}</p>
        <button type="submit" class="submit-btn" :disabled="authStore.loading">
          {{ authStore.loading ? '注册中...' : '注册' }}
        </button>
      </form>
    </div>

    <!-- 已登录：订阅管理 -->
    <div v-else class="subscription-page">
      <div class="sub-header">
        <div class="user-info">
          <span class="user-name">{{ authStore.user?.username }}</span>
          <span class="user-plan">{{ currentPlanLabel }}</span>
        </div>
        <button class="logout-btn" @click="handleLogout">退出登录</button>
      </div>

      <!-- 当前套餐 -->
      <div class="current-plan-card">
        <h3>当前套餐</h3>
        <div class="plan-detail" v-if="authStore.subscription">
          <div class="quota-bar">
            <div class="quota-progress" :style="{ width: quotaPercent + '%' }"></div>
          </div>
          <p class="quota-text">
            本月已使用 <strong>{{ authStore.subscription.quota_used }}</strong>
            / {{ authStore.subscription.quota_limit }} 次AI调用
          </p>
          <div class="features">
            <span v-for="f in authStore.subscription.features" :key="f" class="feature-tag">{{ f }}</span>
          </div>
        </div>
        <p v-else class="no-sub">暂无订阅信息</p>
      </div>

      <!-- 套餐升级 -->
      <div class="plans-section">
        <h3>升级套餐</h3>
        <div v-if="authStore.plans.length === 0" class="loading">加载套餐中...</div>
        <div v-else class="plans-grid">
          <div
            v-for="plan in authStore.plans"
            :key="plan.plan"
            class="plan-card"
            :class="{ current: plan.plan === authStore.subscription?.plan }"
          >
            <h4>{{ plan.plan }}</h4>
            <p class="plan-quota">AI 调用额度：{{ plan.quota_limit }} 次/月</p>
            <ul class="plan-features">
              <li v-for="f in plan.features" :key="f">{{ f }}</li>
            </ul>
            <button
              v-if="plan.plan !== authStore.subscription?.plan"
              class="upgrade-btn"
              @click="handleUpgrade(plan.plan)"
            >升级</button>
            <span v-else class="current-badge">当前套餐</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const mode = ref<'login' | 'register'>('login')

const loginForm = reactive({ username: '', password: '' })
const registerForm = reactive({ username: '', email: '', password: '', confirmPassword: '' })

const planLabels: Record<string, string> = {
  free: '免费版',
  personal: '个人版',
  professional: '专业版',
  enterprise: '企业版',
}

const currentPlanLabel = computed(() => {
  const plan = authStore.subscription?.plan
  return plan ? (planLabels[plan] ?? plan) : '免费版'
})

const quotaPercent = computed(() => {
  if (!authStore.subscription) return 0
  const { quota_used, quota_limit } = authStore.subscription
  return quota_limit > 0 ? Math.min((quota_used / quota_limit) * 100, 100) : 0
})

async function handleLogin(): Promise<void> {
  const ok = await authStore.doLogin(loginForm.username, loginForm.password)
  if (ok) {
    await afterLogin()
  }
}

async function handleDemoLogin(): Promise<void> {
  const ok = await authStore.doDemoLogin()
  if (ok) {
    await afterLogin()
  }
}

async function handleRegister(): Promise<void> {
  if (registerForm.password !== registerForm.confirmPassword) {
    authStore.loginError = '两次密码输入不一致'
    return
  }
  const ok = await authStore.doRegister({
    username: registerForm.username,
    email: registerForm.email || undefined,
    password: registerForm.password,
  })
  if (ok) {
    await afterLogin()
  }
}

async function afterLogin(): Promise<void> {
  await Promise.all([authStore.loadSubscription(), authStore.loadPlans()])
  router.push('/')
}

function handleLogout(): void {
  authStore.logout()
  mode.value = 'login'
}

async function handleUpgrade(plan: string): Promise<void> {
  await authStore.doUpgrade(plan)
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  padding: var(--space-6);
}

/* 登录/注册卡片 */
.auth-card {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-8);
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-md);
}
.auth-header {
  text-align: center;
  margin-bottom: var(--space-6);
}
.auth-title {
  font-size: 28px;
  color: var(--color-sidebar);
  margin: 0 0 var(--space-1);
}
.auth-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  margin: 0;
}
.auth-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border-light);
  margin-bottom: var(--space-6);
}
.tab-btn {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  font-size: var(--font-size-base);
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all var(--transition);
}
.tab-btn.active {
  color: var(--color-sidebar-active);
  border-bottom-color: var(--color-sidebar-active);
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
.optional {
  color: var(--color-text-disabled);
}
.form-group input {
  padding: 10px var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: var(--font-size-base);
  outline: none;
  transition: border-color var(--transition);
}
.form-group input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}
.error-msg {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  margin: 0;
}
.submit-btn {
  padding: var(--space-3);
  background: var(--color-sidebar-active);
  color: var(--color-bg);
  border: none;
  border-radius: var(--radius);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: background var(--transition);
}
.submit-btn:hover:not(:disabled) {
  background: #39b0d8;
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.demo-btn {
  padding: var(--space-3);
  background: var(--color-sidebar);
  color: var(--color-bg);
  border: none;
  border-radius: var(--radius);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: background var(--transition);
}
.demo-btn:hover:not(:disabled) {
  background: var(--color-sidebar-text);
}

/* 订阅管理页 */
.subscription-page {
  width: 100%;
  max-width: 960px;
}
.sub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}
.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.user-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-sidebar);
}
.user-plan {
  font-size: var(--font-size-sm);
  padding: var(--space-1) 10px;
  background: rgba(79, 195, 247, 0.12);
  color: var(--color-sidebar-active);
  border-radius: var(--radius-lg);
}
.logout-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  color: var(--color-text-secondary);
}
.logout-btn:hover {
  background: var(--color-border-light);
}
.current-plan-card {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
  box-shadow: var(--shadow-sm);
}
.current-plan-card h3 {
  margin: 0 0 var(--space-4);
  font-size: var(--font-size-lg);
  color: var(--color-sidebar);
}
.quota-bar {
  height: 8px;
  background: var(--color-border-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: var(--space-2);
}
.quota-progress {
  height: 100%;
  background: linear-gradient(90deg, var(--color-sidebar-active), var(--color-sidebar));
  border-radius: var(--radius-sm);
  transition: width var(--transition-slow);
}
.quota-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-3);
}
.features {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.feature-tag {
  font-size: var(--font-size-xs);
  padding: var(--space-1) 10px;
  background: var(--color-primary-light);
  color: var(--color-sidebar-active);
  border-radius: var(--radius-sm);
}
.no-sub {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-base);
}
.plans-section h3 {
  font-size: var(--font-size-lg);
  color: var(--color-sidebar);
  margin: 0 0 var(--space-4);
}
.loading {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-base);
}
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
}
.plan-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  text-align: center;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition);
}
.plan-card:hover {
  box-shadow: var(--shadow-md);
}
.plan-card.current {
  border-color: var(--color-sidebar-active);
}
.plan-card h4 {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-lg);
  color: var(--color-sidebar);
}
.plan-quota {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-3);
}
.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
.plan-features li {
  padding: 2px 0;
}
.upgrade-btn {
  padding: var(--space-2) 24px;
  background: var(--color-sidebar-active);
  color: var(--color-bg);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.upgrade-btn:hover {
  background: #39b0d8;
}
.current-badge {
  font-size: var(--font-size-xs);
  color: var(--color-sidebar-active);
  font-weight: 500;
}
</style>
