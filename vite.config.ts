import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Serves /api/* locally with the same handler the Vercel functions use.
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/(\w+)/)
        if (!m) return next()
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const raw = Buffer.concat(chunks).toString('utf8')
        const { handle } = await server.ssrLoadModule('/src/server/http.ts')
        const r = await handle(m[1], req.method ?? 'GET', raw ? JSON.parse(raw) : undefined)
        res.statusCode = r.status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(r.body))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApi()],
  build: { chunkSizeWarningLimit: 3000 },
})
