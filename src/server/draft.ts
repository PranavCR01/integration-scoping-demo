// The only place the model is called. It receives the code-built skeleton plus small
// evidence packets and returns wording with attached facts. Nothing it returns is shown
// until src/core/verify.ts has checked it.
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import * as z from 'zod/v4'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppConfig, CoverageResult, Customer, Draft, OrderStep } from '../core/types.js'
import { FACT_KINDS } from '../core/types.js'
import { expectedRows, questionSeeds } from '../core/plan.js'
import { toolPacket } from './packets.js'
import { ROOT } from './store.js'

export const MODEL = 'claude-opus-5-5'
export const PROMPT_FILE = 'prompts/draft.v1.md'

const FactSchema = z.object({
  kind: z.enum(FACT_KINDS as [string, ...string[]]),
  value: z.string(),
  method: z.string().nullable(),
  path: z.string().nullable(),
  cite_file: z.string(),
  cite_line: z.number().int().nullable(),
  quote: z.string().nullable(),
})

export const DraftSchema = z.object({
  rows: z.array(
    z.object({
      section: z.enum(['access', 'custom_sheet', 'order', 'data_note', 'question']),
      tool: z.string().nullable(),
      item: z.string(),
      text: z.string(),
      facts: z.array(FactSchema),
    }),
  ),
})

export function buildPrompt(customer: Customer, coverage: CoverageResult[], order: OrderStep[], cfg: AppConfig): string {
  const slots = [
    ...expectedRows(coverage, cfg)
      .filter((r) => !r.confirm)
      .map((r) => ({ section: r.section, tool: r.tool, item: r.item, label: r.label })),
    ...order.map((s) => ({ section: 'order', tool: null, item: String(s.step), tools: s.tools.map((t) => t.tool_key), unlocks: s.unlocks })),
    ...questionSeeds(coverage, cfg).map((q) => ({ section: 'question', tool: null, item: q.key, default_text: q.text })),
  ]
  const packets = coverage.map((c) => toolPacket(c, cfg)).filter(Boolean)
  return [
    `CUSTOMER (fictional): ${customer.name}. Goal: ${customer.goal}`,
    `COVERAGE (decided by code):\n${JSON.stringify(coverage.map((c) => ({ tool: c.tool_key, customer_name: c.input, bucket: c.bucket, why: c.why })), null, 1)}`,
    `SLOTS (write exactly one row for each):\n${JSON.stringify(slots, null, 1)}`,
    `CANONICAL SCHEMA (config/canonical_schema.json):\n${JSON.stringify({ asset: Object.keys(cfg.canonical_schema.asset), finding: Object.keys(cfg.canonical_schema.finding) })}`,
    `SOURCES:\n\n${packets.join('\n\n')}`,
  ].join('\n\n')
}

export async function draftWithModel(customer: Customer, coverage: CoverageResult[], order: OrderStep[], cfg: AppConfig): Promise<{ draft: Draft; model: string; usage: unknown }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
  const client = new Anthropic()
  const system = readFileSync(join(ROOT, PROMPT_FILE), 'utf8')
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system,
    messages: [{ role: 'user', content: buildPrompt(customer, coverage, order, cfg) }],
    output_config: { effort: 'medium', format: betaZodOutputFormat(DraftSchema) },
    // Server-side refusal fallback: if a safety classifier declines (security topics can
    // trigger them), the API retries on a fallback model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  })
  const msg = await stream.finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error('The model declined this request')
  if (msg.stop_reason === 'max_tokens') throw new Error('Draft was cut off (max_tokens)')
  const parsed = (msg as unknown as { parsed_output: z.infer<typeof DraftSchema> | null }).parsed_output
  if (!parsed) throw new Error('Draft did not match the expected format')
  return { draft: parsed as Draft, model: msg.model, usage: msg.usage }
}
