import { Router } from 'express'
import users from './modules/users.js'
import notifications from './modules/notifications.js'
import dashboard from './modules/dashboard.js'
import tasks from './modules/tasks.js'
import benchmarkAccounts from './modules/benchmarkAccounts.js'
import collectTasks from './modules/collectTasks.js'
import viralVideos from './modules/viralVideos.js'
import hotspots from './modules/hotspots.js'
import keywordMonitors from './modules/keywordMonitors.js'
import topicProposals from './modules/topicProposals.js'
import persona from './modules/persona.js'
import scripts from './modules/scripts.js'
import materials from './modules/materials.js'
import videoProducts from './modules/videoProducts.js'
import publishRecords from './modules/publishRecords.js'
import contentAssets from './modules/contentAssets.js'
import experienceLogs from './modules/experienceLogs.js'
import reports from './modules/reports.js'

export const router = Router()

router.use(users)
router.use(notifications)
router.use(dashboard)
router.use(tasks)
router.use(benchmarkAccounts)
router.use(collectTasks)
router.use(viralVideos)
router.use(hotspots)
router.use(keywordMonitors)
router.use(topicProposals)
router.use(persona)
router.use(scripts)
router.use(materials)
router.use(videoProducts)
router.use(publishRecords)
router.use(contentAssets)
router.use(experienceLogs)
router.use(reports)
