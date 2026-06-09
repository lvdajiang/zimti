import { Router } from 'express'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'

const router: Router = Router()

// GET /api/v1/users/me — 获取当前用户信息
router.get('/users/me', async (_req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: DEMO_USER_ID },
      include: { personaConfig: true },
    })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar_url: user.avatarUrl,
      persona: user.personaConfig
        ? {
            display_name: user.personaConfig.displayName,
            one_line_positioning: user.personaConfig.oneLinePositioning,
            style_description: user.personaConfig.styleDescription,
          }
        : null,
      created_at: user.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('[GET /users/me]', error)
    res.status(500).json({ error: 'Failed to load user' })
  }
})

export default router
