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
  background: #f5f5f5;
  padding: 24px;
}

/* 登录/注册卡片 */
.auth-card {
  background: #fff;
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.auth-header {
  text-align: center;
  margin-bottom: 24px;
}
.auth-title {
  font-size: 28px;
  color: #1a1a2e;
  margin: 0 0 4px;
}
.auth-subtitle {
  font-size: 13px;
  color: #999;
  margin: 0;
}
.auth-tabs {
  display: flex;
  border-bottom: 1px solid #eee;
  margin-bottom: 24px;
}
.tab-btn {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  font-size: 14px;
  color: #999;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab-btn.active {
  color: #4fc3f7;
  border-bottom-color: #4fc3f7;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: 13px;
  color: #666;
}
.optional {
  color: #bbb;
}
.form-group input {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.form-group input:focus {
  border-color: #4fc3f7;
}
.error-msg {
  color: #e74c3c;
  font-size: 13px;
  margin: 0;
}
.submit-btn {
  padding: 12px;
  background: #4fc3f7;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.submit-btn:hover:not(:disabled) {
  background: #39b0d8;
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.demo-btn {
  padding: 12px;
  background: #1a1a2e;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.demo-btn:hover:not(:disabled) {
  background: #2a2a4e;
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
  margin-bottom: 24px;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}
.user-plan {
  font-size: 13px;
  padding: 4px 10px;
  background: rgba(79, 195, 247, 0.12);
  color: #4fc3f7;
  border-radius: 12px;
}
.logout-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  color: #666;
}
.logout-btn:hover {
  background: #eee;
}
.current-plan-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}
.current-plan-card h3 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #1a1a2e;
}
.quota-bar {
  height: 8px;
  background: #eee;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}
.quota-progress {
  height: 100%;
  background: linear-gradient(90deg, #4fc3f7, #1a1a2e);
  border-radius: 4px;
  transition: width 0.3s;
}
.quota-text {
  font-size: 13px;
  color: #666;
  margin: 0 0 12px;
}
.features {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.feature-tag {
  font-size: 12px;
  padding: 4px 10px;
  background: #f0f8ff;
  color: #4fc3f7;
  border-radius: 4px;
}
.no-sub {
  color: #999;
  font-size: 14px;
}
.plans-section h3 {
  font-size: 16px;
  color: #1a1a2e;
  margin: 0 0 16px;
}
.loading {
  color: #999;
  font-size: 14px;
}
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.plan-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s;
}
.plan-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.plan-card.current {
  border-color: #4fc3f7;
}
.plan-card h4 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #1a1a2e;
}
.plan-quota {
  font-size: 13px;
  color: #666;
  margin: 0 0 12px;
}
.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  font-size: 13px;
  color: #888;
}
.plan-features li {
  padding: 2px 0;
}
.upgrade-btn {
  padding: 8px 24px;
  background: #4fc3f7;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.upgrade-btn:hover {
  background: #39b0d8;
}
.current-badge {
  font-size: 12px;
  color: #4fc3f7;
  font-weight: 500;
}
</style>
