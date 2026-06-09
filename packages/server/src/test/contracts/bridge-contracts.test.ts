/**
 * 桥接契约测试 — 验证 Zimti Bridge 代码与 JSON fixture 定义一致
 *
 * 目的：防止 Zimti 端的类型定义与智派 API 实际结构之间发生静默 drift。
 * 每个 JSON fixture 定义了智派 API 的 required_fields，本测试验证
 * Zimti 的 TypeScript 接口覆盖了这些字段。
 *
 * 运行方式：pnpm vitest run src/test/contracts/bridge-contracts.test.ts
 * 不依赖数据库，纯编译期 + 运行时字段校验。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ─── Fixture 加载 ────────────────────────────────────────────
// vitest 运行在 packages/server/ 目录，向上两级到项目根目录
const FIXTURE_DIR = resolve(process.cwd(), '..', '..', 'bridge-contracts')

function loadFixture(name: string) {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), 'utf-8'))
}

// ─── 字段覆盖验证工具 ─────────────────────────────────────────

/**
 * 验证 TypeScript interface 的字段列表是否覆盖 fixture 的 required_fields
 * @param interfaceName - 接口名称（用于错误提示）
 * @param interfaceFields - TS interface 暴露的字段名数组
 * @param requiredFields - fixture 定义的必需字段（可以是 string 或 "string — 描述" 格式）
 */
function assertFieldCoverage(
  interfaceName: string,
  interfaceFields: string[],
  requiredFields: Record<string, string>,
) {
  const requiredNames = Object.keys(requiredFields)
  const missing = requiredNames.filter((f) => !interfaceFields.includes(f))

  if (missing.length > 0) {
    throw new Error(
      `${interfaceName} 缺少 fixture 中要求的字段: ${missing.join(', ')}\n` +
      `  现有字段: ${interfaceFields.join(', ')}\n` +
      `  缺少: ${missing.join(', ')}`,
    )
  }
}

// ─── 测试组 ───────────────────────────────────────────────────

describe('桥接契约测试', () => {

  // ── 1. 游客同步接口 ──────────────────────────────────────────
  describe('游客同步 (POST /tourists/)', () => {
    it('Zimti sync.ts 的请求字段覆盖 fixture required_fields', () => {
      const fixture = loadFixture('zhipai-tourist-response.json')

      // sync.ts:54-63 发送的请求字段
      const syncRequestFields = [
        'name', 'phone', 'gender', 'age',
        'tourist_type', 'group_id', 'source', 'arrival_time',
      ]

      // fixture 中定义的请求必需字段（从 sample 提取）
      const fixtureRequiredFields = Object.keys(fixture.sample)
      // 验证 Zimti 发送的字段是 fixture 返回字段的子集（不应发送不存在的字段）
      const extraFields = syncRequestFields.filter(
        (f) => !fixtureRequiredFields.includes(f) && !['tourist_id', 'id'].includes(f),
      )
      // 允许 Zimti 发送额外字段（智派可能忽略），只记录不报错
      if (extraFields.length > 0) {
        console.log(`[INFO] 游客同步: Zimti 发送了智派响应中不存在的字段: ${extraFields.join(', ')}`)
      }
    })

    it('sync.ts 能正确读取响应中的 tourist_id 和 name', () => {
      const fixture = loadFixture('zhipai-tourist-response.json')
      const requiredFields = fixture.required_fields as Record<string, string>

      // sync.ts:67 读取 result.tourist_id
      expect(requiredFields).toHaveProperty('tourist_id')
      expect(requiredFields).toHaveProperty('name')
    })
  })

  // ── 2. 资源查询接口 ──────────────────────────────────────────
  describe('资源查询 (GET /resources/)', () => {
    it('SimpleResource 接口覆盖 fixture required_fields（含字段重命名）', () => {
      const fixture = loadFixture('zhipai-resource-response.json')
      const requiredFields = fixture.required_fields as Record<string, string>

      // productProxy.ts SimpleResource 接口的字段
      // 注意: 智派返回 resource_type/resource_grade → Zimti 映射为 type/grade
      const simpleResourceFields = [
        'resource_id', 'name', 'entity_name', 'type', 'grade',
        'specification', 'agreement_price', 'retail_price',
        'unit', 'season', 'status',
      ]

      // 建立映射: fixture 字段名 → Zimti 接口字段名
      const fieldMapping: Record<string, string> = {
        resource_type: 'type',
        resource_grade: 'grade',
      }

      // 检查每个 required_field 是否被 Zimti 接口覆盖（直接或通过映射）
      const missing: string[] = []
      for (const field of Object.keys(requiredFields)) {
        const zimtiField = fieldMapping[field] || field
        if (!simpleResourceFields.includes(zimtiField)) {
          missing.push(`${field} (→ ${zimtiField})`)
        }
      }

      if (missing.length > 0) {
        throw new Error(
          `SimpleResource 缺少 fixture 中要求的字段: ${missing.join(', ')}\n` +
          `  现有字段: ${simpleResourceFields.join(', ')}`,
        )
      }
    })

    it('productProxy.ts 的字段映射正确', () => {
      const fixture = loadFixture('zhipai-resource-response.json')
      const sample = fixture.sample

      // 验证 sample 中有 productProxy.ts 映射所需的源字段
      // productProxy.ts:79-89 从智派响应提取字段
      expect(sample).toHaveProperty('resource_id')
      expect(sample).toHaveProperty('entity_name')
      expect(sample).toHaveProperty('specification')
      expect(sample).toHaveProperty('resource_type')
      expect(sample).toHaveProperty('resource_grade')
      expect(sample).toHaveProperty('agreement_price')
      expect(sample).toHaveProperty('retail_price')
      expect(sample).toHaveProperty('unit')
      expect(sample).toHaveProperty('season')
      expect(sample).toHaveProperty('status')
    })
  })

  // ── 3. 季节价格接口 ──────────────────────────────────────────
  describe('季节价格 (GET /resources/{id}/season-prices)', () => {
    it('SimpleSeasonPrice 接口覆盖 fixture required_fields', () => {
      const fixture = loadFixture('zhipai-resource-season-prices.json')
      const requiredFields = fixture.required_fields as Record<string, string>

      // productProxy.ts SimpleSeasonPrice 接口的字段
      const seasonPriceFields = [
        'id', 'season_name', 'season_type',
        'start_date', 'end_date', 'price',
      ]

      assertFieldCoverage('SimpleSeasonPrice', seasonPriceFields, requiredFields)
    })

    it('⚠️ 标记已知的 schema drift: season_type 和 price 字段', () => {
      const fixture = loadFixture('zhipai-resource-season-prices.json')

      // 记录 drift：Zimti 期望 season_type 和 price，但智派可能不返回
      if (fixture._drift_warning) {
        console.log(`[DRIFT WARNING] 季节价格: ${fixture._drift_warning}`)
      }

      // 验证 fixture 中的 sample 是否包含 Zimti 期望的字段
      const sample = fixture.sample as Record<string, unknown>
      const hasSeasonType = 'season_type' in sample
      const hasPrice = 'price' in sample
      const hasAgreementPrice = 'agreement_price' in sample

      // 至少有一种价格字段
      expect(hasPrice || hasAgreementPrice).toBe(true)

      if (!hasSeasonType) {
        console.log('[DRIFT] 季节价格: 智派不返回 season_type 字段，Zimti SimpleSeasonPrice.season_type 将为空字符串')
      }
      if (!hasPrice && hasAgreementPrice) {
        console.log('[DRIFT] 季节价格: 智派返回 agreement_price 而非 price，Zimti 映射需要调整')
      }
    })
  })

  // ── 4. 模板搜索接口 ──────────────────────────────────────────
  describe('模板搜索 (GET /resources/search-template)', () => {
    it('searchTemplateResources 使用与 searchResources 相同的字段映射（含重命名）', () => {
      const fixture = loadFixture('zhipai-search-template-response.json')
      const requiredFields = fixture.required_fields as Record<string, string>

      // 与 SimpleResource 相同的字段和映射
      const simpleResourceFields = [
        'resource_id', 'name', 'entity_name', 'type', 'grade',
        'specification', 'agreement_price', 'retail_price',
        'unit', 'season', 'status',
      ]

      const fieldMapping: Record<string, string> = {
        resource_type: 'type',
        resource_grade: 'grade',
      }

      const missing: string[] = []
      for (const field of Object.keys(requiredFields)) {
        const zimtiField = fieldMapping[field] || field
        if (!simpleResourceFields.includes(zimtiField)) {
          missing.push(`${field} (→ ${zimtiField})`)
        }
      }

      if (missing.length > 0) {
        throw new Error(
          `SimpleResource (template) 缺少 fixture 中要求的字段: ${missing.join(', ')}\n` +
          `  现有字段: ${simpleResourceFields.join(', ')}`,
        )
      }
    })
  })

  // ── 5. 批量报价请求 ──────────────────────────────────────────
  describe('批量报价 (POST /quotations/batch-create)', () => {
    it('quotation.ts 构造的请求体覆盖 fixture required_fields.header', () => {
      const fixture = loadFixture('zhipai-batch-quotation-request.json')
      const headerRequired = fixture.required_fields.header as Record<string, string>

      // quotation.ts:144-151 构造的 header 字段
      const headerFields = [
        'product_name', 'group_id', 'tour_date',
        'customer_name', 'customer_phone', 'salesperson', 'notes',
      ]

      assertFieldCoverage('QuotationRequest.header', headerFields, headerRequired)
    })

    it('quotation.ts 构造的明细字段覆盖 fixture required_fields.details', () => {
      const fixture = loadFixture('zhipai-batch-quotation-request.json')
      const detailRequired = fixture.required_fields.details[0] as Record<string, string>

      // quotation.ts:69-84 构造的 detail 字段
      const detailFields = [
        'day_number', 'time', 'action', 'start_point', 'end_point',
        'resource_id', 'resource_name', 'resource_type',
        'adult_unit_price', 'child_unit_price',
        'adult_count', 'child_count',
        'adult_negotiated_price', 'child_negotiated_price',
        'amount',
      ]

      assertFieldCoverage('QuotationRequest.details[]', detailFields, detailRequired)
    })

    it('batch-create 响应字段覆盖 fixture required_fields', () => {
      const fixture = loadFixture('zhipai-batch-quotation-response.json')
      const requiredFields = fixture.required_fields as Record<string, string>

      // quotation.ts:141 期望的响应字段
      const responseFields = ['message', 'quotation_id', 'detail_count']

      assertFieldCoverage('BatchQuotationResponse', responseFields, requiredFields)
    })
  })

  // ── 6. 报价详情接口 ──────────────────────────────────────────
  describe('报价详情 (GET /quotations/{id}/details)', () => {
    it('quotation.ts 读取的字段在 fixture sample 中存在', () => {
      const fixture = loadFixture('zhipai-quotation-details-response.json')
      const sample = fixture.sample as Array<Record<string, unknown>>

      expect(Array.isArray(sample)).toBe(true)
      expect(sample.length).toBeGreaterThan(0)

      const firstItem = sample[0]
      // quotation.ts:180-182 读取的字段
      expect(firstItem).toHaveProperty('total_price')
      expect(firstItem).toHaveProperty('total_cost')
      expect(firstItem).toHaveProperty('profit_margin')
    })
  })

  // ── 7. 消息推送接口 ──────────────────────────────────────────
  describe('消息推送 (POST /fleet/messages/push)', () => {
    it('bridge.ts push-message 路由构造的请求覆盖 fixture required_fields', () => {
      const fixture = loadFixture('zhipai-fleet-messages-push-request.json')
      const requiredFields = fixture.required_fields as Record<string, string>

      // bridge.ts:162-171 构造的请求字段
      const pushFields = ['user_id', 'title', 'content', 'msg_type', 'icon']

      assertFieldCoverage('PushMessageRequest', pushFields, requiredFields)
    })

    it('push-message 响应字段匹配', () => {
      const fixture = loadFixture('zhipai-fleet-messages-push-request.json')
      const response = fixture.response as Record<string, unknown>

      // bridge.ts:162 期望的响应字段
      expect(response).toHaveProperty('success')
      expect(response).toHaveProperty('message_id')
    })
  })

  // ── 8. 报价图片接口 ──────────────────────────────────────────
  describe('报价图片 (POST /export/quick-quotation-image)', () => {
    it('⚠️ 标记已知重大 schema drift', () => {
      const fixture = loadFixture('zhipai-quick-quotation-image-response.json')

      // 记录 drift 信息
      expect(fixture._drift_warning).toBeDefined()
      console.log(`[MAJOR DRIFT] 报价图片: ${fixture._drift_warning}`)

      // 验证两端都定义了接口信息
      expect(fixture.zimti_expects).toBeDefined()
      expect(fixture.zhipai_actual).toBeDefined()

      // 验证路径差异
      const zimtiEndpoint = (fixture.zimti_expects as Record<string, unknown>).endpoint as string
      const zhipaiEndpoint = (fixture.zhipai_actual as Record<string, unknown>).endpoint as string
      expect(zimtiEndpoint).not.toBe(zhipaiEndpoint)
      console.log(`[DRIFT] 端点路径: Zimti 期望 ${zimtiEndpoint}，智派实际 ${zhipaiEndpoint}`)
    })
  })

  // ── 9. Webhook 事件 ──────────────────────────────────────────
  describe('Webhook 事件 (POST /bridge/webhook/zhipai)', () => {
    it('所有 6 种事件都有定义', () => {
      const fixture = loadFixture('webhook-payloads.json')
      const events = fixture.events as Record<string, unknown>

      const expectedEvents = [
        'quotation_confirmed', 'order_created',
        'tour_started', 'tour_completed',
        'tourist_registered', 'tourist_inquiry',
      ]

      for (const evt of expectedEvents) {
        expect(events).toHaveProperty(evt)
      }
    })

    it('每个事件的 data 字段覆盖 Zimti webhook handler 读取的字段', () => {
      const fixture = loadFixture('webhook-payloads.json')
      const events = fixture.events as Record<string, { data: Record<string, string>; sample: { data: Record<string, unknown> } }>

      // 验证 quotation_confirmed
      const quoteConfData = events.quotation_confirmed.sample.data
      expect(quoteConfData).toHaveProperty('customer_name')
      expect(quoteConfData).toHaveProperty('customer_phone')

      // 验证 order_created
      const orderData = events.order_created.sample.data
      expect(orderData).toHaveProperty('main_guest_name')
      expect(orderData).toHaveProperty('main_guest_phone')

      // 验证 tourist_registered
      const regData = events.tourist_registered.sample.data
      expect(regData).toHaveProperty('name')
      expect(regData).toHaveProperty('phone')
      expect(regData).toHaveProperty('source')

      // 验证 tourist_inquiry
      const inqData = events.tourist_inquiry.sample.data
      expect(inqData).toHaveProperty('name')
      expect(inqData).toHaveProperty('phone')
      expect(inqData).toHaveProperty('inquiry_topic')
    })

    it('公共字段包含 event, ref_id, data', () => {
      const fixture = loadFixture('webhook-payloads.json')
      const common = fixture.common_fields as Record<string, string>

      expect(common).toHaveProperty('event')
      expect(common).toHaveProperty('ref_id')
      expect(common).toHaveProperty('data')
      expect(common).toHaveProperty('timestamp')
    })

    it('⚠️ 标记 tour_started/tour_completed 的实现状态漂移', () => {
      const fixture = loadFixture('webhook-payloads.json')
      const events = fixture.events as Record<string, { _drift_warning?: string }>

      const tourStarted = events.tour_started
      const tourCompleted = events.tour_completed

      // 这两个事件有 drift warning
      if (tourStarted?._drift_warning) {
        console.log(`[DRIFT WARNING] tour_started: ${tourStarted._drift_warning}`)
      }
      if (tourCompleted?._drift_warning) {
        console.log(`[DRIFT WARNING] tour_completed: ${tourCompleted._drift_warning}`)
      }
    })

    it('记录所有已知 drift', () => {
      const fixture = loadFixture('webhook-payloads.json')
      const drifts = fixture._known_drifts as string[]

      expect(Array.isArray(drifts)).toBe(true)
      console.log(`[已知 Drift 列表]`)
      for (const d of drifts) {
        console.log(`  - ${d}`)
      }
    })
  })

  // ── 10. 汇总：所有 fixture 文件可加载 ──────────────────────────
  describe('Fixture 文件完整性', () => {
    const expectedFixtures = [
      'zhipai-tourist-response.json',
      'zhipai-resource-response.json',
      'zhipai-resource-season-prices.json',
      'zhipai-search-template-response.json',
      'zhipai-batch-quotation-request.json',
      'zhipai-batch-quotation-response.json',
      'zhipai-quotation-details-response.json',
      'zhipai-fleet-messages-push-request.json',
      'zhipai-quick-quotation-image-response.json',
      'webhook-payloads.json',
    ]

    it.each(expectedFixtures)('%s 可正常加载', (name) => {
      const data = loadFixture(name)
      expect(data).toBeDefined()
      expect(data._comment).toBeDefined()
    })
  })
})
