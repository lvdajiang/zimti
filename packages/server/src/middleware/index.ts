import type { Request, Response, NextFunction } from 'express'

export function errorHandler(err: Error, _req: Request, res: Response, next: NextFunction): void {
  console.error(`[Error] ${err.message}`, err.stack)
  res.status(500).json({ error: 'Internal Server Error' })
  next()
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not Found' })
}
