import multer from 'multer'
import { join } from 'node:path'

export function createMulter(dest: string, opts?: { limits?: { fileSize?: number } }) {
  const fullPath = join(process.cwd(), dest)
  return multer({
    dest: fullPath,
    limits: opts?.limits ?? { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'text/plain', 'text/csv', 'application/json',
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a',
        'image/jpeg', 'image/png', 'image/webp',
        'video/mp4', 'video/webm',
      ]
      if (allowed.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error(`不支持的文件类型: ${file.mimetype}`))
      }
    },
  })
}

export const personaUpload = createMulter('uploads/persona_samples')
export const generalUpload = createMulter('uploads', { limits: { fileSize: 50 * 1024 * 1024 } })
