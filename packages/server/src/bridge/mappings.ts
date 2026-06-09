/**
 * 数据映射函数 — Zimti字段 ↔ 智派字段转换
 *
 * 桥接层不直接暴露两端的原始数据结构，通过映射函数解耦。
 */

/** Zimti客户创建后的完整记录（Prisma返回值） */
interface ZimtiCustomer {
  id: string
  name: string
  phone: string | null
  wechat: string | null
  sourceType: string
  sourceRefId: string | null
  intentLevel: string
  stage: string
  travelIntent: {
    people?: number
    date?: string
    destination?: string
    budget?: string
  } | null
  notes: string | null
}

/** 智派游客创建请求 */
interface ZhiPaiTouristCreate {
  name: string
  phone: string
  gender: string
  age: number
  tourist_type: string
  group_id: string
  source: string
  arrival_time: string
  notes: string
}

/**
 * Zimti客户 → 智派游客字段映射
 *
 * 智派游客必填字段: name, gender, age, tourist_type, group_id
 * 默认值: gender="未知", age=0, tourist_type="成人"
 */
export function customerToTourist(customer: ZimtiCustomer): ZhiPaiTouristCreate {
  // 组装备注信息
  const noteParts: string[] = []
  if (customer.wechat) noteParts.push(`微信: ${customer.wechat}`)
  if (customer.travelIntent?.destination) noteParts.push(`目的地: ${customer.travelIntent.destination}`)
  if (customer.travelIntent?.people) noteParts.push(`人数: ${customer.travelIntent.people}`)
  if (customer.travelIntent?.budget) noteParts.push(`预算: ${customer.travelIntent.budget}`)
  if (customer.notes) noteParts.push(customer.notes)

  return {
    name: customer.name,
    phone: customer.phone || '',
    gender: '未知',
    age: 0,
    tourist_type: '成人',
    group_id: '',  // 暂无团号，后续关联时更新
    source: `自媒体-${customer.sourceType}`,
    arrival_time: customer.travelIntent?.date || '',
    notes: noteParts.join(' | '),
  }
}

/** Zimti资源类型 → 智派资源类型映射 */
const RESOURCE_TYPE_MAP: Record<string, string> = {
  room: '住宿',
  meal: '餐饮',
  ticket: '门票',
  transport: '车辆',
  other: '其他',
}

/** 智派资源类型 → Zimti资源类型反向映射 */
const RESOURCE_TYPE_REVERSE: Record<string, string> = {
  '住宿': 'room',
  '酒店': 'room',
  '餐饮': 'meal',
  '用餐': 'meal',
  '门票': 'ticket',
  '景点': 'ticket',
  '游览': 'ticket',
  '车辆': 'transport',
  '用车': 'transport',
  '接机': 'transport',
  '送机': 'transport',
  '导游': 'guide',
  '保险': 'insurance',
}

export function mapResourceTypeToZhiPai(zimtiType: string): string {
  return RESOURCE_TYPE_MAP[zimtiType] || zimtiType
}

export function mapResourceTypeFromZhiPai(zhiPaiType: string): string {
  return RESOURCE_TYPE_REVERSE[zhiPaiType] || 'other'
}

/**
 * 报价请求参数（Zimti前端 → 桥接层）
 */
export interface QuotationRequest {
  customer_id: string
  destination: string
  days: number
  people_count: number
  grade: string        // "3钻" | "4钻" | "5钻" | "豪华"
  tour_date: string    // "2026-07-01"
}

/**
 * 报价结果（桥接层 → Zimti前端）
 */
export interface QuotationResult {
  quotation_id: string
  total_price: number
  total_cost: number
  profit_margin: number
  image_url: string | null
  details_count: number
}

/**
 * 智派游客注册 Webhook 数据（智派 → Zimti）
 */
export interface TouristRegisteredData {
  name: string
  phone: string
  wx_openid?: string
  source: string            // "miniprogram_wx" | "miniprogram_sms"
  partner_agency_id?: string | number
}

/**
 * 智派游客询价 Webhook 数据（智派 → Zimti）
 */
export interface TouristInquiryData {
  name: string
  phone: string
  inquiry_topic?: string    // 询价主题（目的地/路线名等）
  product_name?: string
  partner_agency_id?: string | number
}

/**
 * 智派游客 → Zimti 客户字段映射（反向同步）
 */
export function touristToCustomer(data: TouristRegisteredData): {
  name: string
  phone: string
  wechat: string
  sourceType: string
  notes: string
} {
  const noteParts: string[] = []
  if (data.wx_openid) noteParts.push(`微信OpenID: ${data.wx_openid}`)
  if (data.partner_agency_id) noteParts.push(`旅行社ID: ${data.partner_agency_id}`)

  return {
    name: data.name || '小程序用户',
    phone: data.phone || '',
    wechat: data.wx_openid || '',
    sourceType: data.source === 'miniprogram_wx' ? 'miniprogram_wx' : 'miniprogram',
    notes: noteParts.join(' | '),
  }
}
