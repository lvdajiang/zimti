import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { getUserId, str, toInt } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'

const router: Router = Router()
router.use(optionalAuth)

// ============================================================
// CRUD
// ============================================================

// GET /api/v1/entities — 列表（搜索增强：name + aliases 匹配）
router.get('/entities', async (req: Request, res: Response) => {
  const entityType = str(req.query.entity_type)
  const keyword = str(req.query.keyword)
  const city = str(req.query.city)
  const p = toInt(req.query.page, 1)
  const ps = Math.min(toInt(req.query.page_size, 20), 100)
  const skip = (p - 1) * ps

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: getUserId(req as any) }
  if (entityType && entityType !== 'all') where.entityType = entityType
  if (city) where.city = { contains: city, mode: 'insensitive' }
  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { aliases: { contains: keyword, mode: 'insensitive' } },
      { address: { contains: keyword, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.entity.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: ps,
      include: { _count: { select: { resources: true } } },
    }),
    prisma.entity.count({ where }),
  ])

  res.json({
    items: items.map((e) => ({
      id: e.id,
      name: e.name,
      aliases: e.aliases,
      entity_type: e.entityType,
      region: e.region,
      city: e.city,
      address: e.address,
      phone: e.phone,
      longitude: e.longitude,
      latitude: e.latitude,
      remark: e.remark,
      resource_count: e._count.resources,
      created_at: e.createdAt.toISOString(),
      updated_at: e.updatedAt.toISOString(),
    })),
    total,
  })
})

// POST /api/v1/entities — 创建
router.post('/entities', async (req: Request, res: Response) => {
  const { name, aliases, entity_type, region, city, address, phone, longitude, latitude, remark } = req.body
  if (!name || !entity_type) {
    res.status(400).json({ error: 'name and entity_type are required' })
    return
  }

  const entity = await prisma.entity.create({
    data: {
      userId: getUserId(req as any),
      name: String(name).slice(0, 200),
      aliases: String(aliases ?? ''),
      entityType: String(entity_type),
      region: region ? String(region).slice(0, 100) : null,
      city: city ? String(city).slice(0, 100) : null,
      address: address ? String(address).slice(0, 500) : null,
      phone: phone ? String(phone).slice(0, 100) : null,
      longitude: longitude ? String(longitude).slice(0, 20) : null,
      latitude: latitude ? String(latitude).slice(0, 20) : null,
      remark: remark ? String(remark) : null,
    },
  })
  res.status(201).json({ id: entity.id })
})

// PUT /api/v1/entities/:id — 更新
router.put('/entities/:id', async (req: Request, res: Response) => {
  const { name, aliases, entity_type, region, city, address, phone, longitude, latitude, remark } = req.body

  const entity = await prisma.entity.update({
    where: { id: str(req.params.id), userId: getUserId(req as any) },
    data: {
      ...(name !== undefined && { name: String(name).slice(0, 200) }),
      ...(aliases !== undefined && { aliases: String(aliases) }),
      ...(entity_type !== undefined && { entityType: String(entity_type) }),
      ...(region !== undefined && { region: region ? String(region).slice(0, 100) : null }),
      ...(city !== undefined && { city: city ? String(city).slice(0, 100) : null }),
      ...(address !== undefined && { address: address ? String(address).slice(0, 500) : null }),
      ...(phone !== undefined && { phone: phone ? String(phone).slice(0, 100) : null }),
      ...(longitude !== undefined && { longitude: longitude ? String(longitude).slice(0, 20) : null }),
      ...(latitude !== undefined && { latitude: latitude ? String(latitude).slice(0, 20) : null }),
      ...(remark !== undefined && { remark: remark ? String(remark) : null }),
    },
  })
  res.json({ id: entity.id })
})

// DELETE /api/v1/entities/:id — 删除（级联删除资源）
router.delete('/entities/:id', async (req: Request, res: Response) => {
  await prisma.entity.delete({ where: { id: str(req.params.id), userId: getUserId(req as any) } })
  res.json({ success: true })
})

// ============================================================
// 合并
// ============================================================

// POST /api/v1/entities/merge — 合并重复实体
router.post('/entities/merge', async (req: Request, res: Response) => {
  const { source_ids, target_id } = req.body
  if (!Array.isArray(source_ids) || source_ids.length === 0 || !target_id) {
    res.status(400).json({ error: 'source_ids (array) and target_id are required' })
    return
  }

  const target = await prisma.entity.findUnique({ where: { id: String(target_id), userId: getUserId(req as any) } })
  if (!target) {
    res.status(404).json({ error: 'target entity not found' })
    return
  }

  const sources = await prisma.entity.findMany({
    where: { id: { in: source_ids.map(String) }, userId: getUserId(req as any) },
  })
  if (sources.length === 0) {
    res.status(404).json({ error: 'no source entities found' })
    return
  }

  // 收集所有别名（source 名字 + 已有别名 → 加入 target）
  const existingAliases = target.aliases ? target.aliases.split(',').map((s: string) => s.trim()).filter(Boolean) : []
  for (const src of sources) {
    existingAliases.push(src.name)
    if (src.aliases) {
      existingAliases.push(...src.aliases.split(',').map((s: string) => s.trim()).filter(Boolean))
    }
  }
  const uniqueAliases = [...new Set(existingAliases)]

  // 用 source 数据补充 target 空白字段
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = { aliases: uniqueAliases.join(',') }
  for (const src of sources) {
    if (!target.region && src.region) patch.region = src.region
    if (!target.city && src.city) patch.city = src.city
    if (!target.address && src.address) patch.address = src.address
    if (!target.phone && src.phone) patch.phone = src.phone
    if (!target.longitude && src.longitude) patch.longitude = src.longitude
    if (!target.latitude && src.latitude) patch.latitude = src.latitude
  }

  await prisma.$transaction(async (tx) => {
    // 更新 target
    await tx.entity.update({ where: { id: target.id }, data: patch })

    // 迁移所有 Resource.entity_id 从 source → target
    await tx.resource.updateMany({
      where: { entityId: { in: source_ids.map(String) } },
      data: { entityId: target.id },
    })

    // 删除 source 实体
    await tx.entity.deleteMany({ where: { id: { in: source_ids.map(String) } } })
  })

  res.json({ success: true, merged_count: sources.length, aliases_added: uniqueAliases.length })
})

// ============================================================
// 高德 POI 搜索
// ============================================================

// GET /api/v1/entities/amap-search — 高德 POI 搜索
router.get('/entities/amap-search', async (req: Request, res: Response) => {
  const keyword = str(req.query.keyword)
  const city = str(req.query.city)
  const entityType = str(req.query.entity_type)
  if (!keyword) {
    res.status(400).json({ error: 'keyword is required' })
    return
  }

  const apiKey = process.env.AMAP_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'AMAP_API_KEY 未配置' })
    return
  }

  // POI 类型编码映射
  const typeMap: Record<string, string> = {
    hotel: '190300',
    restaurant: '050000',
    scenic: '110100',
    vehicle: '150000',
  }
  const types = entityType && typeMap[entityType] ? typeMap[entityType] : ''

  const params = new URLSearchParams({
    key: apiKey,
    keywords: keyword,
    output: 'JSON',
    ...(city && { city }),
    ...(types && { types }),
  })

  try {
    const resp = await fetch(`https://restapi.amap.com/v3/place/text?${params}`)
    const data = await resp.json() as { status: string; pois?: Array<{
      name: string; address: string; tel: string; cityname: string;
      pname: string; location: string; type: string;
    }> }

    if (data.status !== '1' || !data.pois) {
      res.json({ items: [], total: 0 })
      return
    }

    res.json({
      items: data.pois.map((poi) => {
        const [lng, lat] = (poi.location ?? ',').split(',')
        return {
          name: poi.name,
          address: poi.address,
          phone: poi.tel,
          city: poi.cityname,
          region: poi.pname,
          longitude: lng || null,
          latitude: lat || null,
          amap_type: poi.type,
        }
      }),
      total: data.pois.length,
    })
  } catch (err) {
    res.status(502).json({ error: '高德 API 请求失败', detail: String(err) })
  }
})

// POST /api/v1/entities/from-amap — 高德一键创建实体
router.post('/entities/from-amap', async (req: Request, res: Response) => {
  const { name, address, phone, city, region, longitude, latitude, entity_type, amap_type } = req.body
  if (!name) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  // 同名+同地址防重复
  const existing = await prisma.entity.findFirst({
    where: {
      userId: getUserId(req as any),
      name: String(name),
      ...(address && { address: String(address) }),
    },
  })
  if (existing) {
    res.status(409).json({ error: '同名同地址实体已存在', id: existing.id })
    return
  }

  const entity = await prisma.entity.create({
    data: {
      userId: getUserId(req as any),
      name: String(name).slice(0, 200),
      aliases: '',
      entityType: entity_type ? String(entity_type) : guessEntityType(amap_type),
      region: region ? String(region).slice(0, 100) : null,
      city: city ? String(city).slice(0, 100) : null,
      address: address ? String(address).slice(0, 500) : null,
      phone: phone ? String(phone).slice(0, 100) : null,
      longitude: longitude ? String(longitude).slice(0, 20) : null,
      latitude: latitude ? String(latitude).slice(0, 20) : null,
    },
  })

  res.status(201).json({ id: entity.id })
})

// ============================================================
// 资源 CRUD（实体下的子资源）
// ============================================================

// GET /api/v1/entities/:entityId/resources — 实体下的资源列表
router.get('/entities/:entityId/resources', async (req: Request, res: Response) => {
  const entityId = str(req.params.entityId)
  const entity = await prisma.entity.findUnique({ where: { id: entityId, userId: getUserId(req as any) } })
  if (!entity) {
    res.status(404).json({ error: 'entity not found' })
    return
  }

  const resources = await prisma.resource.findMany({
    where: { entityId },
    orderBy: { createdAt: 'desc' },
  })

  res.json({
    items: resources.map((r) => ({
      id: r.id,
      entity_id: r.entityId,
      name: r.name,
      resource_type: r.resourceType,
      unit: r.unit,
      unit_price: r.unitPrice?.toString() ?? null,
      remark: r.remark,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    })),
  })
})

// POST /api/v1/entities/:entityId/resources — 创建资源
router.post('/entities/:entityId/resources', async (req: Request, res: Response) => {
  const entityId = str(req.params.entityId)
  const { name, resource_type, unit, unit_price, remark } = req.body
  if (!name || !resource_type) {
    res.status(400).json({ error: 'name and resource_type are required' })
    return
  }

  const entity = await prisma.entity.findUnique({ where: { id: entityId, userId: getUserId(req as any) } })
  if (!entity) {
    res.status(404).json({ error: 'entity not found' })
    return
  }

  const resource = await prisma.resource.create({
    data: {
      userId: getUserId(req as any),
      entityId,
      name: String(name).slice(0, 200),
      resourceType: String(resource_type),
      unit: unit ? String(unit).slice(0, 20) : null,
      unitPrice: unit_price ? Number(unit_price) : null,
      remark: remark ? String(remark) : null,
    },
  })
  res.status(201).json({ id: resource.id })
})

// PUT /api/v1/entities/resources/:id — 更新资源
router.put('/entities/resources/:id', async (req: Request, res: Response) => {
  const { name, resource_type, unit, unit_price, remark } = req.body

  const resource = await prisma.resource.update({
    where: { id: str(req.params.id), userId: getUserId(req as any) },
    data: {
      ...(name !== undefined && { name: String(name).slice(0, 200) }),
      ...(resource_type !== undefined && { resourceType: String(resource_type) }),
      ...(unit !== undefined && { unit: unit ? String(unit).slice(0, 20) : null }),
      ...(unit_price !== undefined && { unitPrice: unit_price ? Number(unit_price) : null }),
      ...(remark !== undefined && { remark: remark ? String(remark) : null }),
    },
  })
  res.json({ id: resource.id })
})

// DELETE /api/v1/entities/resources/:id — 删除资源
router.delete('/entities/resources/:id', async (req: Request, res: Response) => {
  await prisma.resource.delete({ where: { id: str(req.params.id), userId: getUserId(req as any) } })
  res.json({ success: true })
})

// ============================================================
// 辅助函数
// ============================================================

function guessEntityType(amapType: string | undefined): string {
  if (!amapType) return 'other'
  const t = String(amapType)
  if (t.includes('住宿') || t.includes('酒店') || t.includes('宾馆')) return 'hotel'
  if (t.includes('餐饮') || t.includes('餐厅') || t.includes('美食')) return 'restaurant'
  if (t.includes('景区') || t.includes('风景') || t.includes('公园') || t.includes('门票')) return 'scenic'
  if (t.includes('汽车') || t.includes('车辆') || t.includes('租车')) return 'vehicle'
  return 'other'
}

export default router
