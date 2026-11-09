import type { Customer, GoalProfile, IntegrationsConfig, Plan } from '../core/types'
import type { DataReport } from '../core/data'

export interface Meta {
  customers: Customer[]
  integrations: { label: string; count: number }
  variants: { file: string; config: IntegrationsConfig }[]
  sources: Record<string, string>
  live_draft_enabled: boolean
  goal_profiles: Record<string, GoalProfile>
}

async function call<T>(route: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/${route}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }))
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
  return j as T
}

export const getMeta = () => call<Meta>('meta')
export const getPlan = (b: { customer: Customer; mode: 'saved' | 'live'; overrides: Record<string, unknown> }) => call<Plan>('plan', b)
export const getData = (b: { customer: Customer; uploads?: Record<string, unknown[]>; decisions?: Record<string, 'same' | 'different'>; overrides: Record<string, unknown> }) => call<DataReport>('data', b)
