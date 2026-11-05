import type { IncomingMessage, ServerResponse } from 'node:http'
import { handle } from '../src/server/http.js'

export const config = { maxDuration: 300 }

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const r = await handle('plan', req.method ?? 'GET', req.body)
  res.statusCode = r.status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(r.body))
}
