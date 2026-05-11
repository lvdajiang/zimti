/**
 * schema-check.ts — 自动检查代码是否与 shared-schema.ts 对齐
 *
 * 用法：
 *   npx tsx scripts/schema-check.ts              # 检查全部 src 文件
 *   npx tsx scripts/schema-check.ts --staged     # 只检查 git staged 文件
 *   npx tsx scripts/schema-check.ts --fix         # 自动尝试更新 schema（实验性）
 *
 * 原理：
 *   1. 从 shared-schema.ts 提取所有已知枚举值、API路径、表名/字段名
 *   2. 扫描源码中的字符串字面量，找出不在 schema 中的疑似命名
 *   3. 扫描编码模式违规（裸 Number() 转换、catch 静默错误）
 *   4. 输出违规报告
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================
// 配置
// ============================================================

const SCHEMA_PATH = path.resolve(__dirname, '../开发文档/06-架构/shared-schema.ts')
const SRC_DIRS = ['packages/server/src', 'packages/client/src']
const EXCLUDE_PATTERNS = ['node_modules', '.git', 'dist', '.nuxt', '.next', '.output']

// ============================================================
// 1. 从 shared-schema.ts 提取已知值
// ============================================================

interface SchemaValues {
  enumValues: Set<string>     // 所有枚举字面量值
  apiPaths: Set<string>       // 所有 API 路径
  tableNames: Set<string>     // 所有表名（interface 名去掉 Record）
  fieldNames: Set<string>     // 所有字段名
  routePaths: Set<string>     // 所有前端路由路径
}

function extractFromSchema(schemaContent: string): SchemaValues {
  const enumValues = new Set<string>()
  const apiPaths = new Set<string>()
  const tableNames = new Set<string>()
  const fieldNames = new Set<string>()
  const routePaths = new Set<string>()

  // 提取枚举值: 'value1' | 'value2' | 'value3'
  const unionTypeRegex = /['"]([^'"]+)['"]\s*\|/g
  let match
  while ((match = unionTypeRegex.exec(schemaContent)) !== null) {
    enumValues.add(match[1])
  }
  // 单独的枚举值 'value'
  const singleEnumRegex = /['"]([a-z][a-z0-9_]*)['"]/g
  while ((match = singleEnumRegex.exec(schemaContent)) !== null) {
    if (match[1].length >= 2 && !['string', 'number', 'boolean', 'null', 'undefined', 'any', 'unknown', 'true', 'false'].includes(match[1])) {
      enumValues.add(match[1])
    }
  }

  // 提取 API 路径: '/api/v1/xxx'
  const apiPathRegex = /['"]\/api\/v1\/[^'"]+['"]/g
  while ((match = apiPathRegex.exec(schemaContent)) !== null) {
    const p = match[0].slice(1, -1)
    if (p) apiPaths.add(p)
  }

  // 提取前端路由: '/dashboard', '/viral-videos/:id'
  const routePathRegex = /['"`](\/[a-z][-a-z0-9_/:]+)['"`]/g
  while ((match = routePathRegex.exec(schemaContent)) !== null) {
    const p = match[1] // 捕获组已不含引号
    if (p.startsWith('/') && p !== '/api') {
      routePaths.add(p)
    }
  }

  // 提取表名: interface XxxRecord
  const tableRegex = /interface\s+(\w+Record)\b/g
  while ((match = tableRegex.exec(schemaContent)) !== null) {
    tableNames.add(match[1].replace(/Record$/, '').replace(/([A-Z])/g, (m) => '_' + m.toLowerCase()).slice(1))
  }

  // 提取字段名: field_name:
  const fieldRegex = /(?:^\s*)([a-z][a-z0-9_]*)\s*[?:]/gm
  while ((match = fieldRegex.exec(schemaContent)) !== null) {
    const f = match[1]
    if (f.length >= 3 && !['const', 'let', 'var', 'function', 'interface', 'type', 'export', 'import', 'from', 'class', 'return', 'switch', 'case', 'break', 'default', 'throw', 'try', 'catch', 'finally', 'while', 'for', 'async', 'await', 'new', 'this', 'super', 'void', 'null', 'true', 'false', 'typeof', 'instanceof', 'delete', 'in', 'of'].includes(f)) {
      fieldNames.add(f)
    }
  }

  return { enumValues, apiPaths, tableNames, fieldNames, routePaths }
}

// ============================================================
// 2. 扫描源码中的字符串
// ============================================================

interface Violation {
  file: string
  line: number
  type: 'enum' | 'api_path' | 'route_path' | 'coding_pattern'
  value: string
  context: string
}

function extractFiles(dirs: string[]): string[] {
  const files: string[] = []
  for (const dir of dirs) {
    const fullDir = path.resolve(__dirname, '..', dir)
    if (!fs.existsSync(fullDir)) continue
    scanDir(fullDir, files)
  }
  return files
}

function scanDir(dir: string, files: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.') || EXCLUDE_PATTERNS.includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scanDir(full, files)
    } else if (entry.isFile() && /\.(ts|vue|tsx|jsx)$/.test(entry.name)) {
      files.push(full)
    }
  }
}

function getStagedFiles(): string[] {
  const { execSync } = require('child_process')
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' })
    return output.trim().split('\n')
      .filter(f => f.length > 0 && /\.(ts|vue|tsx|jsx)$/.test(f))
      .map(f => path.resolve(f))
  } catch {
    return []
  }
}

function checkFile(filePath: string, schema: SchemaValues): Violation[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const violations: Violation[] = []
  const relativePath = path.relative(path.resolve(__dirname, '..'), filePath)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 检查疑似枚举值: 字符串字面量赋给 status/type/platform 等字段
    const enumMatch = line.match(/(?:===|!==|===\s|!==\s|=s)['"]([a-z][a-z0-9_]*)['"]/)
    if (enumMatch) {
      const val = enumMatch[1]
      if (val.length < 3) continue
      if (['true', 'false', 'null', 'undefined', 'string', 'number', 'boolean'].includes(val)) continue
      if (val === val.toLowerCase() && (val.includes('_') || ['active', 'paused', 'pending', 'running', 'completed', 'failed', 'draft', 'published', 'unpublished', 'main', 'image', 'video', 'music', 'text', 'audio', 'admin', 'user', 'guest'].includes(val))) {
        // 跳过排序参数
        if (val.endsWith('_asc') || val.endsWith('_desc') || val.endsWith('_score')) continue
        if (!schema.enumValues.has(val)) {
          violations.push({
            file: relativePath,
            line: i + 1,
            type: 'enum',
            value: val,
            context: line.trim().slice(0, 100),
          })
        }
      }
    }

    // 文件级别判断
    const isTestFile = filePath.includes('.test.ts')
    const isServerRouteFile = filePath.includes('packages\\server\\src\\routes') || filePath.includes('packages/server/src/routes')
    const isApiFile = filePath.includes('packages\\client\\src\\api') || filePath.includes('packages/client/src/api')

    // 检查 API 路径（排除测试文件中的硬编码路径）
    const apiMatch = line.match(/['"`](\/api\/v1\/[a-z][-a-z0-9_/]*)['"`]/)
    if (apiMatch && !isTestFile) {
      const p = apiMatch[1]
      if (!schema.apiPaths.has(p)) {
        violations.push({
          file: relativePath,
          line: i + 1,
          type: 'api_path',
          value: p,
          context: line.trim().slice(0, 100),
        })
      }
    }

    // 检查前端路由（仅检查前端非 API 文件中的路径引用）
    if (!isServerRouteFile && !isTestFile && !isApiFile) {
      const routeMatch = line.match(/['"`](\/[a-z][-a-z0-9_/]*)['"`]/)
      if (routeMatch && !line.includes('api/v1') && !/\bapi\.(get|post|put|delete|del|patch)/.test(line)) {
        const p = routeMatch[1]
        if (p.length > 3 && !schema.routePaths.has(p) && !p.startsWith('/assets') && !p.startsWith('/static') && !p.startsWith('/uploads')) {
          violations.push({
            file: relativePath,
            line: i + 1,
            type: 'route_path',
            value: p,
            context: line.trim().slice(0, 100),
          })
        }
      }
    }

    // 编码模式: 裸 Number() 转换外部输入
    const numberMatch = line.match(/Number\((req\.(?:params|query)\.\w+)\)/)
    if (numberMatch && !line.includes('toInt')) {
      violations.push({
        file: relativePath,
        line: i + 1,
        type: 'coding_pattern',
        value: `裸 Number() 转换外部输入: ${numberMatch[1]}`,
        context: line.trim().slice(0, 100),
      })
    }

    // 编码模式: Number(route.params.xxx) 无 NaN 检查
    const routeNumberMatch = line.match(/Number\(route\.params\.\w+\)/)
    if (routeNumberMatch && !line.includes('isNaN') && !line.includes('isFinite') && !line.includes('||') && !line.includes('??')) {
      violations.push({
        file: relativePath,
        line: i + 1,
        type: 'coding_pattern',
        value: `Number(route.params) 无 NaN 检查`,
        context: line.trim().slice(0, 100),
      })
    }
  }

  // 编码模式: catch 块中只有 console.error 无用户反馈
  // 只检查前端文件（.vue），服务端 catch 返回 res.status 算有反馈
  if (filePath.endsWith('.vue')) {
    const catchBlockRegex = /catch\s*\([^)]*\)\s*\{([^}]*)\}/g
    let catchMatch
    while ((catchMatch = catchBlockRegex.exec(content)) !== null) {
      const body = catchMatch[1]
      const hasClientFeedback = body.includes('toast') || body.includes('alert') || body.includes('message') || body.includes('throw')
      if (body.includes('console.error') && !hasClientFeedback) {
        const lineOffset = content.slice(0, catchMatch.index).split('\n').length
        violations.push({
          file: relativePath,
          line: lineOffset,
          type: 'coding_pattern',
          value: 'catch 块仅 console.error，缺少用户反馈',
          context: `catch { ${body.trim().slice(0, 80)}`,
        })
      }
    }
  }

  return violations
}

// ============================================================
// 3. 输出报告
// ============================================================

function main() {
  const args = process.argv.slice(2)
  const stagedOnly = args.includes('--staged')
  const fixMode = args.includes('--fix')

  // 读取 schema
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.log(`⚠️  Schema 文件不存在: ${SCHEMA_PATH}`)
    console.log('   请先运行 /init-schema 建立共享定义')
    process.exit(1)
  }

  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8')
  const schema = extractFromSchema(schemaContent)

  console.log(`📋 Schema 检查`)
  console.log(`   枚举值: ${schema.enumValues.size}`)
  console.log(`   API路径: ${schema.apiPaths.size}`)
  console.log(`   路由路径: ${schema.routePaths.size}`)
  console.log('')

  // 获取要检查的文件
  let files: string[]
  if (stagedOnly) {
    files = getStagedFiles()
    console.log(`📂 检查 staged 文件: ${files.length} 个`)
  } else {
    files = extractFiles(SRC_DIRS)
    console.log(`📂 扫描源码目录: ${files.length} 个文件`)
  }
  console.log('')

  // 检查
  const allViolations: Violation[] = []
  for (const file of files) {
    const viols = checkFile(file, schema)
    allViolations.push(...viols)
  }

  // 输出结果
  if (allViolations.length === 0) {
    console.log('✅ 全部通过，代码与 schema 对齐')
    process.exit(0)
  }

  // 按类型分组
  const byType = {
    enum: allViolations.filter(v => v.type === 'enum'),
    api_path: allViolations.filter(v => v.type === 'api_path'),
    route_path: allViolations.filter(v => v.type === 'route_path'),
    coding_pattern: allViolations.filter(v => v.type === 'coding_pattern'),
  }

  console.log(`❌ 发现 ${allViolations.length} 个违规`)
  console.log('')

  if (byType.enum.length > 0) {
    console.log(`### 枚举值不在 schema 中 (${byType.enum.length})`)
    for (const v of byType.enum.slice(0, 20)) {
      console.log(`   ${v.file}:${v.line}  '${v.value}'`)
      console.log(`     ${v.context}`)
    }
    if (byType.enum.length > 20) console.log(`   ... 还有 ${byType.enum.length - 20} 个`)
  }

  if (byType.api_path.length > 0) {
    console.log(`\n### API 路径不在 schema 中 (${byType.api_path.length})`)
    for (const v of byType.api_path.slice(0, 10)) {
      console.log(`   ${v.file}:${v.line}  ${v.value}`)
    }
    if (byType.api_path.length > 10) console.log(`   ... 还有 ${byType.api_path.length - 10} 个`)
  }

  if (byType.route_path.length > 0) {
    console.log(`\n### 路由路径不在 schema 中 (${byType.route_path.length})`)
    for (const v of byType.route_path.slice(0, 10)) {
      console.log(`   ${v.file}:${v.line}  ${v.value}`)
    }
    if (byType.route_path.length > 10) console.log(`   ... 还有 ${byType.route_path.length - 10} 个`)
  }

  if (byType.coding_pattern.length > 0) {
    console.log(`\n### 编码模式违规 (${byType.coding_pattern.length})`)
    for (const v of byType.coding_pattern.slice(0, 20)) {
      console.log(`   ${v.file}:${v.line}  ${v.value}`)
      console.log(`     ${v.context}`)
    }
    if (byType.coding_pattern.length > 20) console.log(`   ... 还有 ${byType.coding_pattern.length - 20} 个`)
  }

  console.log('\n💡 请先更新 shared-schema.ts 或修复编码模式问题再提交')
  process.exit(1)
}

main()
