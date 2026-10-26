import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import staticFiles from '@fastify/static'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  ApiError,
  authenticate,
  discover,
  logout,
  makeTransport,
  records,
  type Adapter,
} from './adapters.ts'
import { registerLab } from './lab.ts'
import { relationships as labRelationships } from '../src/lib/data.ts'
import type { SessionInfo } from '../src/lib/contracts.ts'

const profileSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    host: z.string().max(1000),
    database: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((v) => !/[\u0000-\u001f/\\]/.test(v), 'Invalid database name'),
    protocol: z.enum(['Data API', 'OData']),
    apiVersion: z.enum(['v1', 'v2', 'vLatest']).optional(),
    lab: z.boolean().optional(),
  })
  .strict()
const authSchema = z
  .object({
    mode: z.enum(['password', 'token', 'fmid', 'lab']),
    username: z.string().max(500).optional(),
    password: z.string().max(4000).optional(),
    token: z.string().max(16000).optional(),
  })
  .strict()
const querySchema = z
  .object({
    entity: z.string().min(1).max(500),
    conditions: z
      .array(
        z
          .object({
            id: z.string(),
            field: z.string().min(1).max(500),
            operator: z.enum(['equals', 'contains', 'greater', 'less']),
            value: z.string().max(2000),
          })
          .strict(),
      )
      .max(30),
    match: z.enum(['all', 'any']),
    offset: z.number().int().min(0).max(10_000_000),
    limit: z.number().int().min(1).max(100),
    sort: z
      .object({
        field: z.string().min(1).max(500),
        direction: z.enum(['asc', 'desc']),
      })
      .strict()
      .optional(),
    cursor: z.string().max(100).optional(),
  })
  .strict()
type ActiveSession = {
  adapter: Adapter
  info: SessionInfo
  owner: string
  lastUsed: number
}
export async function buildServer(
  options: { port?: number; serveStatic?: boolean } = {},
) {
  const port = options.port ?? Number(process.env.PORT ?? 4186)
  const app = Fastify({
    logger: false,
    bodyLimit: 128 * 1024,
  })
  await app.register(cookie)
  const clients = new Map<string, number>(),
    sessions = new Map<string, ActiveSession>()
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]),
    origins = new Set([
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
      'http://127.0.0.1:5186',
    ])
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return
    reply
      .header('Cache-Control', 'no-store')
      .header('X-Content-Type-Options', 'nosniff')
    if (
      !allowedHosts.has(req.headers.host ?? '') ||
      (req.headers.origin && !origins.has(req.headers.origin)) ||
      req.headers['sec-fetch-site'] === 'cross-site'
    )
      throw new ApiError(
        403,
        'This local service only accepts requests from the explorer workspace.',
      )
    if (req.url === '/api/bootstrap' && req.method === 'GET') return
    const client = req.cookies.fm_explorer_client,
      csrf = req.headers['x-workspace-token']
    if (
      !client ||
      !clients.has(client) ||
      typeof csrf !== 'string' ||
      csrf.length !== client.length ||
      !timingSafeEqual(Buffer.from(csrf), Buffer.from(client))
    )
      throw new ApiError(
        401,
        'Open or reload the local workspace to establish a session.',
      )
    if (req.method !== 'GET' && !req.headers.origin)
      throw new ApiError(403, 'The workspace origin is required.')
    clients.set(client, Date.now())
  })
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        error: error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')
          .slice(0, 500),
      })
    if (error instanceof ApiError)
      return reply
        .code(error.status)
        .send({ error: error.message, code: error.code })
    if (
      (error instanceof Error && error.message.startsWith('Choose ')) ||
      (error instanceof Error &&
        /^(Enter a valid|Use each|Contains requires|Numeric comparisons|This field type|Boolean values|Use an ISO|Unknown sort)/.test(
          error.message,
        ))
    )
      return reply.code(400).send({ error: error.message })
    // Native errors may contain URLs, tokens, or record values. Never forward or log them.
    reply
      .code(500)
      .send({ error: 'The local service could not complete this request.' })
  })
  app.get('/api/bootstrap', async (req, reply) => {
    let token = req.cookies.fm_explorer_client
    if (!token || !clients.has(token)) {
      token = randomBytes(32).toString('hex')
      if (clients.size > 1000)
        throw new ApiError(
          429,
          'Too many local workspaces. Restart the local service.',
        )
      clients.set(token, Date.now())
    }
    reply.setCookie('fm_explorer_client', token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/api',
    })
    return {
      workspaceToken: token,
      version: '0.3.0',
      storage: 'IndexedDB',
      readOnly: true,
    }
  })
  function owned(id: string, owner: string | undefined) {
    const session = sessions.get(id)
    if (!session || session.owner !== owner)
      throw new ApiError(401, 'This connection is locked. Authenticate again.')
    if (Date.now() - session.lastUsed > 15 * 60_000) {
      sessions.delete(id)
      void logout(session.adapter).catch(() => {})
      throw new ApiError(
        401,
        'The local session expired after 15 minutes of inactivity. Reconnect.',
      )
    }
    session.lastUsed = Date.now()
    return session
  }
  app.post('/api/connect', async (req) => {
    const { profile, auth } = z
      .object({ profile: profileSchema, auth: authSchema })
      .strict()
      .parse(req.body)
    if (
      profile.lab &&
      !(
        ['lab-data', 'lab-odata'].includes(profile.id) &&
        profile.database === 'Northstar_CRM'
      )
    )
      throw new ApiError(400, 'Unknown local practice connection.')
    if (!profile.lab) {
      let url: URL
      try {
        url = new URL(profile.host)
      } catch {
        throw new ApiError(400, 'Enter a valid HTTPS host.')
      }
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      )
        throw new ApiError(
          400,
          'Use an HTTPS host without credentials, query, or API path.',
        )
      if (auth.mode === 'lab')
        throw new ApiError(
          400,
          'Local practice authentication is limited to the bundled lab.',
        )
    }
    if (auth.mode === 'password' && (!auth.username || !auth.password))
      throw new ApiError(400, 'Enter the account name and password.')
    if (
      ['token', 'fmid'].includes(auth.mode) &&
      (!auth.token || /[\r\n]/.test(auth.token))
    )
      throw new ApiError(400, 'Enter a valid token without line breaks.')
    if (sessions.size >= 50)
      throw new ApiError(
        429,
        'Disconnect an existing session before adding another.',
      )
    const started = performance.now()
    const transport = profile.lab
      ? makeTransport('http://127.0.0.1', async (input, init) => {
          const url = new URL(String(input))
          const response = await app.inject({
            method: init?.method as 'GET' | 'POST' | 'DELETE',
            url: url.pathname + url.search,
            headers: init?.headers as Record<string, string>,
            payload: typeof init?.body === 'string' ? init.body : undefined,
          })
          return new Response(response.body, {
            status: response.statusCode,
            headers: {
              'content-type': String(
                response.headers['content-type'] ?? 'application/json',
              ),
            },
          })
        })
      : makeTransport(profile.host)
    const adapter = await authenticate(profile, auth, transport)
    try {
      await discover(adapter)
    } catch (error) {
      await logout(adapter).catch(() => {})
      throw error
    }
    if (profile.lab && profile.protocol === 'Data API')
      adapter.snapshot!.relationships = labRelationships.map((r) => ({
        ...r,
        evidence:
          'Declared local lab fixture; not inferred from Data API metadata.',
      }))
    const now = new Date().toISOString(),
      info: SessionInfo = {
        id: randomUUID(),
        profileId: profile.id,
        connectedAt: now,
        checkedAt: now,
        latencyMs: Math.round(performance.now() - started),
        auth:
          auth.mode === 'lab'
            ? 'Local lab session'
            : auth.mode === 'password'
              ? 'Account session'
              : auth.mode === 'fmid'
                ? 'FMID token'
                : 'Existing session token',
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        source: profile.lab ? 'Local practice server' : profile.host,
      }
    sessions.set(info.id, {
      adapter,
      info,
      owner: req.cookies.fm_explorer_client!,
      lastUsed: Date.now(),
    })
    return { session: info, snapshot: adapter.snapshot }
  })
  app.get('/api/sessions', async (req) => ({
    sessions: [...sessions.values()]
      .filter((s) => s.owner === req.cookies.fm_explorer_client)
      .map((s) => s.info),
  }))
  app.post<{ Params: { id: string } }>(
    '/api/sessions/:id/refresh',
    async (req) => {
      const s = owned(req.params.id, req.cookies.fm_explorer_client)
      const start = performance.now()
      const snapshot = await discover(s.adapter)
      if (s.adapter.profile.lab && s.adapter.profile.protocol === 'Data API')
        snapshot.relationships = labRelationships.map((r) => ({
          ...r,
          evidence: 'Declared local lab fixture.',
        }))
      s.info.checkedAt = new Date().toISOString()
      s.info.latencyMs = Math.round(performance.now() - start)
      return { session: s.info, snapshot }
    },
  )
  app.post<{ Params: { id: string } }>(
    '/api/sessions/:id/records',
    async (req) => {
      const s = owned(req.params.id, req.cookies.fm_explorer_client)
      return records(s.adapter, querySchema.parse(req.body))
    },
  )
  app.delete<{ Params: { id: string } }>('/api/sessions/:id', async (req) => {
    const s = owned(req.params.id, req.cookies.fm_explorer_client)
    sessions.delete(req.params.id)
    try {
      await logout(s.adapter)
      return { disconnected: true, remoteSessionClosed: s.adapter.ownsToken }
    } catch {
      return {
        disconnected: true,
        warning:
          'Local authorization cleared; remote logout could not be confirmed.',
      }
    }
  })
  const sweep = setInterval(() => {
    for (const [id, s] of sessions)
      if (Date.now() - s.lastUsed > 15 * 60_000) {
        sessions.delete(id)
        void logout(s.adapter).catch(() => {})
      }
    for (const [id, last] of clients)
      if (Date.now() - last > 24 * 60 * 60_000) clients.delete(id)
  }, 60_000)
  sweep.unref()
  app.addHook('onClose', async () => {
    clearInterval(sweep)
    await Promise.allSettled(
      [...sessions.values()].map((s) => logout(s.adapter)),
    )
    sessions.clear()
    clients.clear()
  })
  await registerLab(app)
  if (options.serveStatic !== false) {
    await app.register(staticFiles, {
      root: fileURLToPath(new URL('../dist', import.meta.url)),
      wildcard: false,
    })
    app.setNotFoundHandler((req, reply) => {
      if (
        req.method !== 'GET' ||
        req.url.startsWith('/api/') ||
        req.url.startsWith('/fmi/')
      )
        return reply.code(404).send({ error: 'Unknown operation.' })
      return reply.sendFile('index.html')
    })
  }
  return app
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = await buildServer()
  await app.listen({
    host: '127.0.0.1',
    port: Number(process.env.PORT ?? 4186),
  })
  process.stdout.write(
    `FM API Explorer: http://127.0.0.1:${process.env.PORT ?? 4186}/ (read-only, local service)\n`,
  )
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      void app.close().then(() => process.exit(0))
    })
}
