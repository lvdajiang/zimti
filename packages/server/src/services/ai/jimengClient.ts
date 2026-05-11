import crypto from 'node:crypto'

// ============================================================
// 即梦 API 认证抽象
// ============================================================

export interface JimengAuthProvider {
  getHeaders(body: string): Record<string, string>
}

export class ArkAuthProvider implements JimengAuthProvider {
  constructor(
    private accessKey: string,
    private secretKey: string,
  ) {}

  getHeaders(body: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(timestamp + '\n' + this.accessKey + '\n' + body)
      .digest('base64')

    return {
      'Content-Type': 'application/json',
      'X-Access-Key': this.accessKey,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    }
  }
}

export class DoubaoAuthProvider implements JimengAuthProvider {
  constructor(private apiKey: string) {}

  getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    }
  }
}

// ============================================================
// 即梦任务类型 → req_key 映射
// ============================================================

export type JimengReqKey =
  | 'seedream_3_0_t2i_250605'
  | 'seedream_4_0_t2i_250514'
  | 'seedream_5_0_t2i_250514'
  | 'seed_edit_3_0_250514'
  | 'high_aes_i2v_25s_250514'
  | 'high_aes_t2v_25s_250514'
  | 'high_aes_i2v_first_last_25s_250514'
  | 'high_aes_i2v_reference_25s_250514'
  | 'seaweed_i2v_25s_250514'
  | 'seaweed_t2v_25s_250514'
  | 'seedance_i2v_25s_250514'
  | 'seedance_t2v_25s_250514'
  | 'omnihuman_1_0_250514'
  | 'omnihuman_1_5_250514'

export interface JimengTaskInput {
  req_key: JimengReqKey
  prompt?: string
  image_url?: string
  first_frame_url?: string
  last_frame_url?: string
  audio_url?: string
  model?: string
  width?: number
  height?: number
  duration?: number
  edit_instruction?: string
  reference_url?: string
}

export interface JimengTaskResult {
  task_id: string
  status: 'pending' | 'running' | 'success' | 'failed'
  progress?: number
  output?: {
    image_urls?: string[]
    video_url?: string
    audio_url?: string
  }
  error?: string
}

// ============================================================
// 即梦客户端
// ============================================================

const DEFAULT_ARK_BASE_URL = 'https://visual.volcengineapi.com'
const DEFAULT_DOUBAO_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

export class JimengClient {
  private authProvider: JimengAuthProvider
  private baseUrl: string

  constructor(authProvider: JimengAuthProvider, baseUrl: string) {
    this.authProvider = authProvider
    this.baseUrl = baseUrl
  }

  static createFromEnv(): JimengClient | null {
    const mode = process.env.JIMENG_AUTH_MODE ?? 'ark'
    const baseUrl = process.env.JIMENG_BASE_URL

    if (mode === 'doubao') {
      const apiKey = process.env.JIMENG_API_KEY
      if (!apiKey) return null
      return new JimengClient(
        new DoubaoAuthProvider(apiKey),
        baseUrl ?? DEFAULT_DOUBAO_BASE_URL,
      )
    }

    const accessKey = process.env.JIMENG_ACCESS_KEY
    const secretKey = process.env.JIMENG_SECRET_KEY
    if (!accessKey || !secretKey) return null
    return new JimengClient(
      new ArkAuthProvider(accessKey, secretKey),
      baseUrl ?? DEFAULT_ARK_BASE_URL,
    )
  }

  async submitTask(input: JimengTaskInput): Promise<string> {
    const body = JSON.stringify(input)
    const headers = this.authProvider.getHeaders(body)

    const res = await fetch(`${this.baseUrl}/api/v1/visual/tasks`, {
      method: 'POST',
      headers,
      body,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Jimeng API error ${res.status}: ${text}`)
    }

    const json = await res.json() as { data?: { task_id: string } }
    const taskId = json.data?.task_id
    if (!taskId) throw new Error('Jimeng API: no task_id in response')
    return taskId
  }

  async pollResult(taskId: string): Promise<JimengTaskResult> {
    const headers = this.authProvider.getHeaders('')

    const res = await fetch(`${this.baseUrl}/api/v1/visual/tasks/${taskId}`, {
      method: 'GET',
      headers,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Jimeng API error ${res.status}: ${text}`)
    }

    const json = await res.json() as {
      data?: {
        task_id: string
        task_status: string
        progress?: number
        output?: {
          image_urls?: string[]
          video_url?: string
          audio_url?: string
        }
        error?: { code: number; message: string }
      }
    }

    const data = json.data
    if (!data) throw new Error('Jimeng API: no data in response')

    return {
      task_id: data.task_id,
      status: mapStatus(data.task_status),
      progress: data.progress,
      output: data.output ? {
        image_urls: data.output.image_urls,
        video_url: data.output.video_url,
        audio_url: data.output.audio_url,
      } : undefined,
      error: data.error?.message,
    }
  }
}

function mapStatus(status: string): JimengTaskResult['status'] {
  switch (status) {
    case 'pending': return 'pending'
    case 'running':
    case 'in_queue':
    case 'processing': return 'running'
    case 'done':
    case 'succeed': return 'success'
    case 'failed': return 'failed'
    default: return 'pending'
  }
}
