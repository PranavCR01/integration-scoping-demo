// One request handler for every API route. Used by the Vercel functions in /api and by the
// local dev server (vite.config.ts), so both behave the same.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Customer, IntegrationsConfig } from '../core/types.js'
import { buildPlan } from './plan.js'
import { runData } from './data.js'
import { loadCustomer, readJson, ROOT, type ConfigOverrides } from './store.js'

export interface Reply {
  status: number
  body: unknown
}

const bad = (msg: string): Reply => ({ status: 400, body: { error: msg } })

function customerFrom(body: any): Customer {
  if (body?.customer && typeof body.customer === 'object') {
    const c = body.customer
    const base = c.id ? safeLoad(c.id) : null
    return {
      id: String(c.id ?? 'custom').replace(/[^a-z0-9_-]/gi, '') || 'custom',
      name: String(c.name ?? 'Unnamed customer').slice(0, 120),
      fictional: true, // the UI only supports fictional customers; it is labelled as such everywhere
      goal: String(c.goal ?? '').slice(0, 300),
      tools: Array.isArray(c.tools) ? c.tools.map((t: unknown) => String(t).slice(0, 80)).filter(Boolean).slice(0, 30) : [],
      data_dir: base?.data_dir,
    }
  }
  return loadCustomer(String(body?.customer_id ?? 'halden'))
}

function safeLoad(id: string): Customer | null {
  try {
    return loadCustomer(id)
  } catch {
    return null
  }
}

function checkOverrides(o: any): string | null {
  if (!o) return null
  if (typeof o !== 'object') return 'overrides must be an object'
  if (o.integrations) {
    const i = o.integrations as IntegrationsConfig
    if (!Array.isArray(i.integrations) || !i.integrations.every((c) => c && typeof c.name === 'string')) {
      return 'An integrations config needs an "integrations" array of objects with a "name" (same shape as config/integrations.json)'
    }
    if (!i.label) i.label = 'Uploaded integrations list'
  }
  return null
}

export async function handle(route: string, method: string, body: any): Promise<Reply> {
  try {
    if (route === 'meta') {
      const customers = readdirSync(join(ROOT, 'config/customers'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => readJson<Customer>(`config/customers/${f}`))
      const integrations = readJson<IntegrationsConfig>('config/integrations.json')
      const variants = readdirSync(join(ROOT, 'config/variants'))
        .filter((f) => f.startsWith('integrations.') && f.endsWith('.json'))
        .map((f) => ({ file: `config/variants/${f}`, config: readJson<IntegrationsConfig>(`config/variants/${f}`) }))
      return {
        status: 200,
        body: {
          customers,
          integrations: { label: integrations.label, count: integrations.integrations.length },
          variants,
          sources: readJson<{ files: Record<string, string> }>('config/sources.json').files,
          goal_profiles: readJson<{ goal_profiles: Record<string, unknown> }>('config/connection_order.json').goal_profiles,
          live_draft_enabled: process.env.ALLOW_LIVE_DRAFT === '1' && !!process.env.ANTHROPIC_API_KEY,
        },
      }
    }
    if (method !== 'POST') return { status: 405, body: { error: 'POST only' } }
    const err = checkOverrides(body?.overrides)
    if (err) return bad(err)
    const overrides = (body?.overrides ?? {}) as ConfigOverrides
    if (route === 'plan') {
      const customer = customerFrom(body)
      if (!customer.tools.length) return bad('Add at least one tool')
      const wantLive = body?.mode === 'live'
      if (wantLive && process.env.ALLOW_LIVE_DRAFT !== '1') return bad('Live drafting is turned off on this deployment (set ALLOW_LIVE_DRAFT=1). The saved draft is used instead.')
      return { status: 200, body: await buildPlan({ customer, overrides, mode: wantLive ? 'live' : 'saved' }) }
    }
    if (route === 'data') {
      const customer = customerFrom(body)
      const uploads = body?.uploads && typeof body.uploads === 'object' ? body.uploads : undefined
      return { status: 200, body: runData({ customer, uploads, decisions: body?.decisions, overrides }) }
    }
    return { status: 404, body: { error: `Unknown route ${route}` } }
  } catch (e) {
    return { status: 500, body: { error: (e as Error).message } }
  }
}
