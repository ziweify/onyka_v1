import { Router, type Response, type NextFunction, type Router as RouterType } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'
import {
  attachmentsService,
  AttachmentsServiceError,
} from '../services/attachments.service.js'

const router: RouterType = Router()

const downloadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
})

function handleError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof AttachmentsServiceError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    })
  }
  next(err)
}

router.get('/:attachmentId/download', authenticate, downloadRateLimit, async (req, res, next) => {
  try {
    const { attachmentId } = req.params
    const isAdmin = req.user?.role === 'admin'
    const { buffer, mimeType, originalName } = await attachmentsService.download(
      attachmentId,
      req.userId!,
      isAdmin
    )

    const encodedName = encodeURIComponent(originalName)
    res.set({
      'Content-Type': mimeType,
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, max-age=3600',
    })
    res.send(buffer)
  } catch (err) {
    handleError(err, res, next)
  }
})

router.delete('/:attachmentId', authenticate, async (req, res, next) => {
  try {
    const { attachmentId } = req.params
    const isAdmin = req.user?.role === 'admin'
    await attachmentsService.delete(attachmentId, req.userId!, isAdmin)
    res.status(204).send()
  } catch (err) {
    handleError(err, res, next)
  }
})

export default router
