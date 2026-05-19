import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  // 全局忽略
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.pnpm/**', '**/prisma/**'],
  },

  // 基础推荐规则
  js.configs.recommended,

  // TypeScript 推荐规则
  ...tseslint.configs.recommended,

  // 全局规则：_ 前缀变量允许未使用，namespace 允许（Express 类型扩展）
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-namespace': 'warn',
    },
  },

  // Vue 推荐规则
  ...pluginVue.configs['flat/recommended'],

  // 服务端文件：Node 全局变量
  {
    files: ['packages/server/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // 前端文件：浏览器全局变量 + TypeScript 解析
  {
    files: ['**/*.vue'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // 前端 TS 文件
  {
    files: ['packages/client/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Prettier 兼容（必须放最后，关闭与 Prettier 冲突的规则）
  prettierConfig,
)
