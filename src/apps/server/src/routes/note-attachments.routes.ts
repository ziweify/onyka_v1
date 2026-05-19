import { Router, type Request, type Response, type NextFunction, type Router as RouterType } from 'express'
import express from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'
import {
  attachmentsService,
  AttachmentsServiceError,
} from '../services/attachments.service.js'

const router: RouterType = Router({ mergeParams: true })

function noteIdParam(req: Request): string {
  return String((req.params as { noteId: string }).noteId)
}

router.use(authenticate)

const chunkRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  keyGenerator: (req) => (req as Request).userId || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
})

const createSessionSchema = z.object({
  originalName: z.string().min(1).max(500),
  mimeType: z.string().max(200).default('application/octet-stream'),
  totalSize: z.number().int().nonnegative(),
  fingerprint: z.string().min(16).max(128),
})

const resumeQuerySchema = z.object({
  fingerprint: z.string().min(16).max(128),
  originalName: z.string().min(1).max(500),
  totalSize: z.coerce.number().int().nonnegative(),
})

function handleError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof AttachmentsServiceError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    })
  }
  next(err)
}

router.get('/', async (req, res, next) => {
  try {
    const noteId = noteIdParam(req)
    const attachments = await attachmentsService.listForNote(noteId, req.userId!)
    res.json({ attachments })
  } catch (err) {
    handleError(err, res, next)
  }
})

router.get('/sessions/resume', async (req, res, next) => {
  try {
    const noteId = noteIdParam(req)
    const q = resumeQuerySchema.parse(req.query)
    const session = await attachmentsService.getSessionForResume(
      noteId,
      req.userId!,
      q.fingerprint,
      q.originalName,
      q.totalSize
    )
    res.json({ session })
  } catch (err) {
    handleError(err, res, next)
  }
})

router.post('/sessions', async (req, res, next) => {
  try {
    const noteId = noteIdParam(req)
    const body = createSessionSchema.parse(req.body)
    const result = await attachmentsService.createSession(noteId, req.userId!, body)
    res.status(201).json(result)
  } catch (err) {
    handleError(err, res, next)
  }
})

router.patch(
  '/sessions/:sessionId/chunk',
  chunkRateLimit,
  express.raw({ type: 'application/octet-stream', limit: '512mb' }),
  async (req, res, next) => {
    try {
      const sessionId = req.params.sessionId as string
      const fingerprint = req.headers['x-upload-fingerprint'] as string
      const range = req.headers['content-range'] as string

      if (!fingerprint) {
        return res.status(400).json({
          error: { code: 'INVALID_INPUT', message: 'X-Upload-Fingerprint header required' },
        })
      }

      const rangeMatch = /^bytes=(\d+)-(\d+)\/(\d+)$/.exec(range || '')
      if (!rangeMatch) {
        return res.status(400).json({
          error: { code: 'INVALID_RANGE', message: 'Content-Range header required (bytes=start-end/total)' },
        })
      }

      const start = parseInt(rangeMatch[1], 10)
      const end = parseInt(rangeMatch[2], 10)
      const total = parseInt(rangeMatch[3], 10)

      if (end < start || !req.body || !Buffer.isBuffer(req.body)) {
        return res.status(400).json({
          error: { code: 'INVALID_RANGE', message: 'Invalid chunk body' },
        })
      }

      const expectedLen = end - start + 1
      if (req.body.length !== expectedLen) {
        return res.status(400).json({
          error: { code: 'INVALID_RANGE', message: 'Chunk size does not match Content-Range' },
        })
      }

      const result = await attachmentsService.appendChunk(
        sessionId,
        req.userId!,
        fingerprint,
        start,
        req.body
      )

      if (result.complete && result.receivedBytes === total) {
        const attachment = await attachmentsService.completeSession(
          sessionId,
          req.userId!,
          fingerprint
        )
        return res.json({ receivedBytes: result.receivedBytes, complete: true, attachment })
      }

      res.json({ receivedBytes: result.receivedBytes, complete: result.complete })
    } catch (err) {
      handleError(err, res, next)
    }
  }
)

router.post('/sessions/:sessionId/complete', async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId as string
    const { fingerprint } = z.object({ fingerprint: z.string().min(16) }).parse(req.body)
    const attachment = await attachmentsService.completeSession(
      sessionId,
      req.userId!,
      fingerprint
    )
    res.json({ attachment })
  } catch (err) {
    handleError(err, res, next)
  }
})

router.delete('/sessions/:sessionId', async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId as string
    await attachmentsService.abortSession(sessionId, req.userId!)
    res.status(204).send()
  } catch (err) {
    handleError(err, res, next)
  }
})

export default router
