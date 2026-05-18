import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  // 全局忽略
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.pnpm/**', '**/prisma/**'],
  },

  // 基础推荐规则
  js.configs.recommended,

  // TypeScript 推荐规则
  ...tseslint.configs.recommended,

  // Vue 推荐规则
  ...pluginVue.configs['flat/recommended'],

  // Vue 文件使用 TypeScript 解析
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // Prettier 兼容（必须放最后，关闭与 Prettier 冲突的规则）
  prettierConfig,
)
