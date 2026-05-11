import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID } from '../../constants.js'
import { personaPreview } from '../../services/ai/generators/copyGenerate.js'
import { personaUpload } from '../../middleware/upload.js'
import { rename } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

const router: Router = Router()

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

// POST /api/v1/persona/samples — 上传样稿文件
router.post('/persona/samples', personaUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传文件' })
      return
    }

    const type = req.body.type ?? 'text'
    const ext = req.file.originalname.split('.').pop() ?? 'bin'
    const filename = `sample_${Date.now()}.${ext}`
    const destPath = join(process.cwd(), 'uploads', 'persona_samples', filename)

    await rename(req.file.path, destPath)
    const urlPath = `/uploads/persona_samples/${filename}`

    const sampleFile = {
      id: Date.now(),
      file_name: req.file.originalname,
      file_url: urlPath,
      type,
      size: req.file.size,
      uploaded_at: new Date().toISOString(),
    }

    await ensureDemoUser()
    let config = await prisma.personaConfig.findUnique({ where: { userId: DEMO_USER_ID } })
    if (!config) {
      config = await prisma.personaConfig.create({ data: { userId: DEMO_USER_ID } })
    }

    if (type === 'audio') {
      const audios = Array.isArray(config.sampleAudios) ? [...config.sampleAudios] : []
      audios.push(sampleFile)
      await prisma.personaConfig.update({ where: { id: config.id }, data: { sampleAudios: audios } })
    } else {
      const texts = Array.isArray(config.sampleTexts) ? [...config.sampleTexts] : []
      texts.push(sampleFile)
      await prisma.personaConfig.update({ where: { id: config.id }, data: { sampleTexts: texts } })
    }

    res.json({
      data: {
        id: sampleFile.id,
        url: urlPath,
        filename: req.file.originalname,
        size: req.file.size,
        type,
      },
    })
  } catch (error) {
    console.error('[POST /persona/samples]', error)
    res.status(500).json({ error: 'Failed to upload sample file' })
  }
})

// DELETE /api/v1/persona/samples/:id — 删除样稿文件
router.delete('/persona/samples/:id', async (req: Request, res: Response) => {
  try {
    const sampleId = parseInt(String(req.params.id), 10)
    if (isNaN(sampleId)) {
      res.status(400).json({ error: 'Invalid sample ID' })
      return
    }

    const config = await prisma.personaConfig.findUnique({ where: { userId: DEMO_USER_ID } })
    if (!config) {
      res.status(404).json({ error: 'Persona config not found' })
      return
    }

    let deleted = false
    const allTexts = Array.isArray(config.sampleTexts) ? [...config.sampleTexts] : []
    const textIdx = allTexts.findIndex((s: any) => s.id === sampleId)
    if (textIdx >= 0) {
      const fileUrl = (allTexts[textIdx] as Record<string, unknown>).file_url as string
      const filePath = join(process.cwd(), fileUrl)
      if (existsSync(filePath)) {
        const { unlink } = await import('node:fs/promises')
        await unlink(filePath).catch(() => {})
      }
      allTexts.splice(textIdx, 1)
      await prisma.personaConfig.update({ where: { id: config.id }, data: { sampleTexts: allTexts } })
      deleted = true
    }

    if (!deleted) {
      const allAudios = Array.isArray(config.sampleAudios) ? [...config.sampleAudios] : []
      const audioIdx = allAudios.findIndex((s: any) => s.id === sampleId)
      if (audioIdx >= 0) {
        const fileUrl = (allAudios[audioIdx] as Record<string, unknown>).file_url as string
        const filePath = join(process.cwd(), fileUrl)
        if (existsSync(filePath)) {
          const { unlink } = await import('node:fs/promises')
          await unlink(filePath).catch(() => {})
        }
        allAudios.splice(audioIdx, 1)
        await prisma.personaConfig.update({ where: { id: config.id }, data: { sampleAudios: allAudios } })
        deleted = true
      }
    }

    if (!deleted) {
      res.status(404).json({ error: 'Sample not found' })
      return
    }

    res.json({ success: true })
  } catch (error) {
    console.error('[DELETE /persona/samples/:id]', error)
    res.status(500).json({ error: 'Failed to delete sample file' })
  }
})

// POST /api/v1/persona/preview — AI 生成预览文案
router.post('/persona/preview', async (req: Request, res: Response) => {
  try {
    const { display_name, language_styles, catchphrases, narrative_viewpoint } = req.body
    const result = await personaPreview({ display_name, language_styles, catchphrases, narrative_viewpoint })
    res.json({ data: result })
  } catch (error) {
    console.error('[POST /persona/preview]', error)
    res.status(500).json({ error: 'Failed to generate preview' })
  }
})

export default router
