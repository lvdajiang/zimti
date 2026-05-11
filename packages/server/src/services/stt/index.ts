import { writeFile, unlink, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export async function extractTranscript(input: {
  video_url: string
  video_id: number
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('语音转文字服务未配置。请设置 OPENAI_API_KEY 以使用 Whisper API。')
  }

  if (!input.video_url) {
    throw new Error('视频 URL 为空，无法提取文案')
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'zimti-stt-'))
  const filePath = join(tempDir, `video_${input.video_id}.mp4`)

  try {
    // 下载视频文件
    const resp = await fetch(input.video_url)
    if (!resp.ok) throw new Error(`下载视频失败: ${resp.status} ${resp.statusText}`)

    const buffer = Buffer.from(await resp.arrayBuffer())
    await writeFile(filePath, buffer)

    // 调用 Whisper API
    const formData = new FormData()
    formData.append('file', new Blob([buffer], { type: 'video/mp4' }), `video_${input.video_id}.mp4`)
    formData.append('model', 'whisper-1')
    formData.append('language', 'zh')

    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!whisperResp.ok) {
      const errorText = await whisperResp.text()
      throw new Error(`Whisper API 调用失败: ${whisperResp.status} ${errorText}`)
    }

    const result = (await whisperResp.json()) as { text: string }
    return result.text.trim()
  } finally {
    await unlink(filePath).catch(() => {})
  }
}
