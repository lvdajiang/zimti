import { bundle } from '@remotion/bundler'
import { renderMedia, getCompositions } from '@remotion/renderer'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'

const REMOTION_ENTRY = join(process.cwd(), '..', 'remotion', 'src', 'index.ts')
const OUTPUT_DIR = join(process.cwd(), 'uploads', 'renders')

interface RenderJob {
  id: string
  videoProductId: string
  status: 'pending' | 'rendering' | 'completed' | 'failed'
  progress: number
  outputPath?: string
  error?: string
  startedAt?: Date
  completedAt?: Date
}

const activeJobs = new Map<string, RenderJob>()

export async function startRender(videoProductId: string): Promise<string> {
  const jobId = crypto.randomUUID()

  const job: RenderJob = {
    id: jobId,
    videoProductId,
    status: 'pending',
    progress: 0,
  }
  activeJobs.set(jobId, job)

  process.nextTick(() => executeRender(job))

  return jobId
}

async function executeRender(job: RenderJob): Promise<void> {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    job.status = 'rendering'
    job.startedAt = new Date()

    const video = await prisma.videoProduct.findFirst({
      where: { id: job.videoProductId },
      include: {
        script: {
          include: {
            storyboardSegments: { orderBy: { segmentIndex: 'asc' } },
          },
        },
        videoMaterials: { include: { material: true } },
      },
    })

    if (!video) throw new Error(`VideoProduct ${job.videoProductId} not found`)

    const segments = (video.script?.storyboardSegments ?? []).map(s => ({
      id: s.id,
      segment_type: s.segmentType as 'oral' | 'visual' | 'transition',
      oral_text: s.oralText ?? undefined,
      visual_description: s.visualDescription,
      duration: Number(s.duration),
      material_ids: s.materialIds,
      oral_audio_url: s.oralAudioUrl ?? undefined,
      transition_type: (s.transitionType as string | undefined) ?? undefined,
    }))

    const materials = video.videoMaterials.map(vm => {
      const meta = vm.material.metadata as Record<string, unknown> | null
      return {
        id: vm.material.id,
        name: vm.material.name,
        type: vm.material.type,
        file_url: vm.material.fileUrl,
        thumbnail_url: vm.material.thumbnailUrl ?? undefined,
        usage_type: vm.usageType,
        width: meta?.width as number | undefined,
        height: meta?.height as number | undefined,
        duration: meta?.duration as number | undefined,
      }
    })

    const renderConfig = video.renderConfig as Record<string, unknown> | null

    const inputProps = {
      segments,
      materials,
      title: video.title,
      platform: video.platform ?? 'main',
      resolution: video.resolution ?? '1080p',
      bgm_url: materials.find(m => m.usage_type === 'bgm')?.file_url,
      subtitle_style: renderConfig?.subtitle_style as Record<string, unknown> | undefined,
    }

    // Bundle Remotion
    job.progress = 10
    const bundleLocation = await bundle({
      entryPoint: REMOTION_ENTRY,
      webpackOverride: (config) => config,
    })

    // 获取 Composition
    job.progress = 20
    const comps = await getCompositions(bundleLocation)
    const composition = comps.find(c => c.id === 'ZimtiVideo')
    if (!composition) throw new Error('ZimtiVideo composition not found')

    // 渲染
    await mkdir(OUTPUT_DIR, { recursive: true })
    const outputPath = join(OUTPUT_DIR, `render_${job.videoProductId}.mp4`)

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      onProgress: ({ progress }) => {
        job.progress = Math.round(20 + progress * 75)
      },
    })

    // 更新数据库
    await prisma.videoProduct.update({
      where: { id: job.videoProductId },
      data: {
        videoUrl: `/uploads/renders/render_${job.videoProductId}.mp4`,
        duration: segments.reduce((sum, s) => sum + s.duration, 0),
        status: 'completed',
      },
    })

    await prisma.renderTask.updateMany({
      where: { videoProductId: job.videoProductId, status: 'rendering' },
      data: { status: 'completed', progress: 100, completedAt: new Date() },
    })

    job.status = 'completed'
    job.progress = 100
    job.outputPath = outputPath
    job.completedAt = new Date()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown render error'
    console.error(`[RenderJob ${job.id}] Failed:`, message)
    job.status = 'failed'
    job.error = message

    await prisma.renderTask.updateMany({
      where: { videoProductId: job.videoProductId, status: 'rendering' },
      data: { status: 'failed', errorMessage: message },
    }).catch(() => {})
  } finally {
    await prisma.$disconnect()
  }
}

export function getJobStatus(jobId: string): RenderJob | undefined {
  return activeJobs.get(jobId)
}

export function cancelJob(jobId: string): boolean {
  const job = activeJobs.get(jobId)
  if (job && (job.status === 'pending' || job.status === 'rendering')) {
    job.status = 'failed'
    job.error = 'Cancelled by user'
    return true
  }
  return false
}
