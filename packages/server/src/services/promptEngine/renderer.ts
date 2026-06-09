/**
 * 模板渲染器 — 纯函数，无数据库依赖
 * 将 {{variableName}} 占位符替换为实际值
 */

export interface PromptVariables {
  [key: string]: string | number | boolean | undefined
}

export interface RenderedPrompt {
  systemPrompt: string | undefined
  userPrompt: string
}

export interface VariableDef {
  name: string
  type: 'string' | 'number' | 'boolean'
  required: boolean
  description: string
}

/**
 * 渲染模板：将 {{variableName}} 替换为实际值
 * - 未提供的可选变量：移除包含该变量的整行
 * - 未提供的必填变量：抛出错误
 * - 清理多余空行
 */
export function renderTemplate(
  template: string,
  variables: PromptVariables,
  variableDefs: VariableDef[],
): string {
  let result = template

  for (const def of variableDefs) {
    const value = variables[def.name]
    const placeholder = `{{${def.name}}}`

    if (value === undefined || value === '') {
      if (def.required) {
        throw new Error(`必填变量 "${def.name}" 未提供`)
      }
      // 移除包含该可选变量的行（如果该行只有空格和这个变量）
      result = result.replace(
        new RegExp(`^[ \\t]*${escapeRegex(placeholder)}[ \\t]*$\\n?`, 'gm'),
        '',
      )
    } else {
      result = result.replaceAll(placeholder, String(value))
    }
  }

  // 清理连续空行（3个以上换行 → 2个）
  result = result.replace(/\n{3,}/g, '\n\n').trim()
  return result
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
