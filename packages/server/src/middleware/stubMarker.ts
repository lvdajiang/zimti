import type { Request, Response, NextFunction } from 'express'

declare global {
  namespace Express {
    interface Locals {
      __stub?: string
    }
  }
}

export function markStub(res: Response, description: string): void {
  res.locals.__stub = description
}

export function stubHeaderMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res)
  res.json = (body: unknown) => {
    if (res.locals.__stub) {
      res.setHeader('X-Stub', 'true')
      res.setHeader('X-Stub-Description', encodeURIComponent(res.locals.__stub))
    }
    return originalJson(body)
  }
  next()
}
