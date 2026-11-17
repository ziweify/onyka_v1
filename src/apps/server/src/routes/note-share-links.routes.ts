import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'
import {
  noteShareLinkService,
  NoteShareLinkServiceError,
} from '../services/note-share-link.service.js'
import { commentsService } from '../services/comments.service.js'
import { attachmentsService } from '../services/attachments.service.js'

const managedRouter: RouterType = Router()
managedRouter.use(authenticate)

const createSchema = z.object({
  password: z.string().min(4).max(128).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  maxViews: z.number().int().min(1).max(1_000_000).nullable().optional(),
  label: z.string().max(120).nullable().optional(),
  allowGuestComments: z.boolean().optional(),
})

const updateSchema = z.object({
  password: z.string().min(4).max(128).nullable().optional(),
  clearPassword: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
  maxViews: z.number().int().min(1).max(1_000_000).nullable().optional(),
  label: z.string().max(120).nullable().optional(),
  allowGuestComments: z.boolean().optional(),
  status: z.enum(['active', 'revoked']).optional(),
})

managedRouter.get('/', async (req, res, next) => {
  try {
    const links = await noteShareLinkService.listMine(req.userId!)
    res.json({ links })
  } catch (error) {
    next(error)
  }
})

managedRouter.get('/note/:noteId', async (req, res, next) => {
  try {
    const links = await noteShareLinkService.listForNote(req.params.noteId, req.userId!)
    res.json({ links })
  } catch (error) {
    next(error)
  }
})

managedRouter.post('/note/:noteId', async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body)
    const link = await noteShareLinkService.create(req.params.noteId, req.userId!, input)
    res.status(201).json({ link })
  } catch (error) {
    next(error)
  }
})

managedRouter.patch('/:id', async (req, res, next) => {
  try {
    const input = updateSchema.parse(req.body)
    const link = await noteShareLinkService.update(req.params.id, req.userId!, input)
    res.json({ link })
  } catch (error) {
    next(error)
  }
})

managedRouter.delete('/:id', async (req, res, next) => {
  try {
    await noteShareLinkService.revoke(req.params.id, req.userId!)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

const publicRouter: RouterType = Router()

const openRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' } },
})

publicRouter.get('/:token', async (req, res, next) => {
  try {
    const meta = await noteShareLinkService.getPublicMeta(req.params.token)
    res.json({ meta })
  } catch (error) {
    next(error)
  }
})

publicRouter.post('/:token/open', openRateLimit, async (req, res, next) => {
  try {
    const body = z
      .object({ password: z.string().max(128).optional() })
      .parse(req.body ?? {})
    const result = await noteShareLinkService.openPublic(req.params.token, body.password)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

const guestCommentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many comments, please try again later' } },
})

const guestCommentSchema = z.object({
  accessToken: z.string().min(10),
  content: z.string().min(1).max(2000),
  parentId: z.string().optional(),
  guestName: z.string().max(40).optional(),
})

publicRouter.get('/:token/comments', async (req, res, next) => {
  try {
    const accessToken =
      (typeof req.query.accessToken === 'string' && req.query.accessToken) ||
      (typeof req.headers['x-share-access'] === 'string' && req.headers['x-share-access']) ||
      ''
    if (!accessToken) {
      throw new NoteShareLinkServiceError('Share access required', 'SHARE_ACCESS_DENIED', 401)
    }
    const link = await noteShareLinkService.requireOpenLink(req.params.token, accessToken)
    if (!link.allowGuestComments) {
      throw new NoteShareLinkServiceError('Guest comments are disabled', 'COMMENTS_DISABLED', 403)
    }
    const comments = await commentsService.listForPublicShare(link.noteId)
    res.json({ comments })
  } catch (error) {
    next(error)
  }
})

publicRouter.post('/:token/comments', guestCommentRateLimit, async (req, res, next) => {
  try {
    const body = guestCommentSchema.parse(req.body ?? {})
    const link = await noteShareLinkService.requireOpenLink(req.params.token, body.accessToken)
    if (!link.allowGuestComments) {
      throw new NoteShareLinkServiceError('Guest comments are disabled', 'COMMENTS_DISABLED', 403)
    }
    const comment = await commentsService.createGuestComment(
      link.noteId,
      link.id,
      body.content,
      body.guestName,
      body.parentId
    )
    res.status(201).json({ comment })
  } catch (error) {
    next(error)
  }
})

const attachmentDownloadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many downloads, please try again later' } },
})

/** Guest download for web-snapshot / note attachments referenced by an opened share link. */
publicRouter.get(
  '/:token/attachments/:attachmentId',
  attachmentDownloadRateLimit,
  async (req, res, next) => {
    try {
      const accessToken =
        (typeof req.query.accessToken === 'string' && req.query.accessToken) ||
        (typeof req.headers['x-share-access'] === 'string' && req.headers['x-share-access']) ||
        ''
      if (!accessToken) {
        throw new NoteShareLinkServiceError('Share access required', 'SHARE_ACCESS_DENIED', 401)
      }
      const link = await noteShareLinkService.requireOpenLink(req.params.token, accessToken)
      const { buffer, mimeType, originalName } = await attachmentsService.downloadForSharedNote(
        req.params.attachmentId,
        link.noteId
      )
      const encodedName = encodeURIComponent(originalName)
      res.set({
        'Content-Type': mimeType,
        'Content-Length': String(buffer.length),
        'Content-Disposition': `inline; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, max-age=300',
      })
      res.send(buffer)
    } catch (error) {
      next(error)
    }
  }
)

export function registerNoteShareLinkErrorHandler(
  err: Error,
  _req: unknown,
  res: { status: (n: number) => { json: (b: unknown) => void } },
  next: (e?: Error) => void
): void {
  if (err instanceof NoteShareLinkServiceError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    })
    return
  }
  next(err)
}

export { managedRouter as noteShareLinksRouter, publicRouter as publicShareLinksRouter }
