import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID } from '../../constants.js'

const router = Router()

async function ensureDemoUser(): Promise<void> {
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    create: { id: DEMO_USER_ID, username: 'demo' },
    update: {},
  })
}

// GET /api/v1/persona — 加载人设配置（全局单例）
router.get('/persona', async (_req: Request, res: Response) => {
  try {
    await ensureDemoUser()
    let config = await prisma.personaConfig.findUnique({
      where: { userId: DEMO_USER_ID },
    })

    if (!config) {
      config = await prisma.personaConfig.create({
        data: { userId: DEMO_USER_ID },
      })
    }

    res.json({
      data: {
        id: config.id,
        display_name: config.displayName,
        age: config.age,
        career_background: config.careerBackground,
        years_of_experience: config.yearsOfExperience,
        core_experience: config.coreExperience,
        one_line_positioning: config.oneLinePositioning,
        core_philosophy: config.corePhilosophy,
        unique_selling_point: config.uniqueSellingPoint,
        language_styles: config.languageStyles,
        style_description: config.styleDescription,
        catchphrases: config.catchphrases,
        narrative_viewpoint: config.narrativeViewpoint,
        sample_texts: config.sampleTexts,
        sample_audios: config.sampleAudios,
        created_at: config.createdAt.toISOString(),
        updated_at: config.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[GET /persona]', error)
    res.status(500).json({ error: 'Failed to load persona config' })
  }
})

// PUT /api/v1/persona — 保存人设配置（全量更新）
router.put('/persona', async (req: Request, res: Response) => {
  try {
    const data = req.body

    const config = await prisma.personaConfig.upsert({
      where: { userId: DEMO_USER_ID },
      create: {
        userId: DEMO_USER_ID,
        displayName: data.display_name ?? '',
        age: data.age ?? null,
        careerBackground: data.career_background ?? '',
        yearsOfExperience: data.years_of_experience ?? null,
        coreExperience: data.core_experience ?? '',
        oneLinePositioning: data.one_line_positioning ?? '',
        corePhilosophy: data.core_philosophy ?? '',
        uniqueSellingPoint: data.unique_selling_point ?? [],
        languageStyles: data.language_styles ?? [],
        styleDescription: data.style_description ?? '',
        catchphrases: data.catchphrases ?? [],
        narrativeViewpoint: data.narrative_viewpoint ?? 'first',
        sampleTexts: data.sample_texts ?? [],
        sampleAudios: data.sample_audios ?? [],
      },
      update: {
        displayName: data.display_name,
        age: data.age,
        careerBackground: data.career_background,
        yearsOfExperience: data.years_of_experience,
        coreExperience: data.core_experience,
        oneLinePositioning: data.one_line_positioning,
        corePhilosophy: data.core_philosophy,
        uniqueSellingPoint: data.unique_selling_point,
        languageStyles: data.language_styles,
        styleDescription: data.style_description,
        catchphrases: data.catchphrases,
        narrativeViewpoint: data.narrative_viewpoint,
        sampleTexts: data.sample_texts,
        sampleAudios: data.sample_audios,
      },
    })

    res.json({
      data: {
        id: config.id,
        updated_at: config.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[PUT /persona]', error)
    res.status(500).json({ error: 'Failed to save persona config' })
  }
})

// POST /api/v1/persona/samples — 上传样稿文件（桩实现，后续接入对象存储）
router.post('/persona/samples', async (req: Request, res: Response) => {
  try {
    // TODO: 接入 MinIO/S3 文件上传
    // 当前返回模拟数据
    const { type } = req.body
    res.json({
      data: {
        id: Date.now(),
        url: `https://placeholder.example.com/sample_${Date.now()}`,
        filename: 'uploaded_file.txt',
        size: 0,
        type: type ?? 'text',
      },
    })
  } catch (error) {
    console.error('[POST /persona/samples]', error)
    res.status(500).json({ error: 'Failed to upload sample file' })
  }
})

// DELETE /api/v1/persona/samples/:id — 删除样稿文件（桩实现）
router.delete('/persona/samples/:id', async (req: Request, res: Response) => {
  try {
    // TODO: 从 MinIO/S3 删除文件，并从 persona_config JSONB 中移除记录
    res.json({ success: true })
  } catch (error) {
    console.error('[DELETE /persona/samples/:id]', error)
    res.status(500).json({ error: 'Failed to delete sample file' })
  }
})

// POST /api/v1/persona/preview — AI 生成预览文案（桩实现）
router.post('/persona/preview', async (req: Request, res: Response) => {
  try {
    // TODO: 接入 AI 服务生成预览文案
    const { display_name, language_styles, catchphrases, narrative_viewpoint } = req.body
    const previewText = `这是 ${display_name ?? '未设置称呼'} 的预览文案。` +
      `语言风格: ${(language_styles ?? []).join('、') || '未设置'}。` +
      `叙事视角: ${narrative_viewpoint === 'first' ? '第一人称' : '第三人称'}。` +
      (catchphrases?.length ? `口头禅: ${catchphrases.map((c: { content: string }) => c.content).join('、')}` : '')

    res.json({
      data: {
        preview_text: previewText,
        highlights: [],
      },
    })
  } catch (error) {
    console.error('[POST /persona/preview]', error)
    res.status(500).json({ error: 'Failed to generate preview' })
  }
})

export default router
