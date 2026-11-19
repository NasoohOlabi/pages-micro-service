import { ZodError } from 'zod'
import { callback, login, logout, origin, renewSession, session } from './auth'
import { sheets } from './sheets'

const files = new Map()
if (await Bun.file('dist/index.html').exists())
  for await (const path of new Bun.Glob('**/*').scan({ cwd: 'dist', onlyFiles: true })) {
    const file = Bun.file('dist/' + path)
    const gzip =
      /\.(js|css|html|svg)$/.test(path) && file.size > 1024 ? Bun.gzipSync(await file.arrayBuffer()) : null
    files.set('/' + path, { file, gzip })
  }

Bun.serve({
  port: Number(process.env.PORT || 3000),
  maxRequestBodySize: 1024 * 1024,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname
    if (path === '/health') return new Response('ok')
    if (!path.startsWith('/api/') && !path.startsWith('/auth/')) {
      const file = files.get(path === '/' ? '/index.html' : path)
      if (!file || !['HEAD', 'GET'].includes(req.method)) return new Response('Not found', { status: 404 })
      const acceptsGzip = /(?:^|,)\s*gzip\s*(?:,|$)/i.test(req.headers.get('accept-encoding') || '')
      const compressed = acceptsGzip && file.gzip
      return new Response(compressed || file.file, {
        headers: {
          'content-type': file.file.type,
          vary: 'Accept-Encoding',
          ...(compressed ? { 'content-encoding': 'gzip' } : {}),
          'cache-control': path.startsWith('/assets/') ? 'public,max-age=31536000,immutable' : 'no-cache',
        },
      })
    }
    let res
    try {
      if (
        req.method === 'POST' &&
        (req.headers.get('origin') !== origin ||
          !req.headers.get('content-type')?.startsWith('application/json'))
      ) {
        throw new Response('Invalid request origin.', { status: 403 })
      }
      if (path === '/auth/login' && req.method === 'GET') res = login(url.searchParams.get('returnTo'))
      else if (path === '/auth/callback' && req.method === 'GET') res = await callback(req, url)
      else {
        const s = session(req)
        if (path === '/api/session' && req.method === 'GET')
          res = Response.json(s ? JSON.parse(s.profile) : null)
        else if (path === '/api/logout' && req.method === 'POST') res = logout(req)
        else if (!s) res = new Response('Sign in required.', { status: 401 })
        else res = Response.json(await sheets(req, path.slice(5), s))
        if (s && res.ok && path !== '/api/logout') renewSession(req, res, s)
      }
    } catch (err) {
      if (err instanceof Response) res = err
      else if (err instanceof ZodError || err instanceof SyntaxError)
        res = new Response('Invalid request.', { status: 400 })
      else res = new Response('Request failed.', { status: 502 })
      if (res.status === 401 && path.startsWith('/api/'))
        res.headers.set('set-cookie', logout(req).headers.get('set-cookie'))
    }
    res.headers.set('cache-control', 'no-store')
    res.headers.set('referrer-policy', 'no-referrer')
    return res
  },
})
