import { useEffect, useMemo, useRef, useState } from 'react'
import type { Customer, IntegrationsConfig, Plan } from '../core/types'
import { BUCKET_LABEL } from '../core/types'
import type { DataReport } from '../core/data'
import { handoffBlocks, planBlocks, toMarkdown } from '../core/doc'
import { getData, getMeta, getPlan, type Meta } from './api'
import { downloadPdf, downloadText } from './pdf'
import { PlanView } from './components/PlanView'
import { DataView } from './components/DataView'
import { DocPreview, VerificationView } from './components/Views'
import { Drawer } from './components/Drawer'
import { Pill, type CiteTarget } from './components/ui'

type Tab = 'plan' | 'data' | 'verification' | 'handoff'

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [newTool, setNewTool] = useState('')
  const [integrations, setIntegrations] = useState<{ label: string; config: IntegrationsConfig; source: string } | null>(null)
  const [mode, setMode] = useState<'saved' | 'live'>('saved')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [changed, setChanged] = useState<Record<string, string>>({})
  const [data, setData] = useState<DataReport | null>(null)
  const [decisions, setDecisions] = useState<Record<string, 'same' | 'different'>>({})
  const [uploads, setUploads] = useState<Record<string, unknown[]>>({})
  const [busy, setBusy] = useState<'plan' | 'data' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('plan')
  const [cite, setCite] = useState<CiteTarget | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getMeta()
      .then((m) => {
        setMeta(m)
        setCustomer(m.customers[0] ?? null)
      })
      .catch((e) => setError(e.message))
  }, [])

  const overrides = useMemo(() => (integrations ? { integrations: integrations.config } : {}), [integrations])

  const runPlan = async (ov = overrides, prev: Plan | null = null) => {
    if (!customer) return
    setBusy('plan')
    setError(null)
    try {
      const p = await getPlan({ customer, mode, overrides: ov })
      const diff: Record<string, string> = {}
      if (prev) for (const c of p.coverage) {
        const before = prev.coverage.find((x) => x.input === c.input)
        if (before && before.bucket !== c.bucket) diff[c.input] = BUCKET_LABEL[before.bucket]
      }
      setChanged(diff)
      setPlan(p)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const runData = async (dec = decisions, up = uploads) => {
    if (!customer) return
    setBusy('data')
    setError(null)
    try {
      setData(await getData({ customer, decisions: dec, uploads: up, overrides }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const swapIntegrations = (next: typeof integrations) => {
    setIntegrations(next)
    if (plan) runPlan(next ? { integrations: next.config } : {}, plan)
  }

  const loadConfigFile = async (f: File) => {
    try {
      const j = JSON.parse(await f.text()) as IntegrationsConfig
      if (!Array.isArray(j.integrations)) throw new Error('This file needs an "integrations" array, same shape as config/integrations.json')
      swapIntegrations({ label: j.label ?? f.name, config: { ...j, label: j.label ?? `Uploaded: ${f.name}` }, source: f.name })
    } catch (e) {
      setError(`Could not load ${f.name}: ${(e as Error).message}`)
    }
  }

  const labels = meta?.sources ?? {}
  const exportName = customer ? customer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'plan'
  const blocks = plan ? planBlocks(plan, labels, plan.document.oob_access_note, plan.document.footer, plan.document.title_prefix, plan.document.status) : []
  const handoff = plan ? handoffBlocks(plan, data, labels) : []
  const excerptFor = (c: CiteTarget) => plan?.excerpts[`${c.file}#L${c.line}`] ?? data?.excerpts?.[`${c.file}#L${c.line}`]

  if (!meta || !customer) {
    return <div className="p-10 text-sm text-slate-500">{error ? `Error: ${error}` : 'Loading…'}</div>
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14M12 5v14" /></svg>
            </div>
            <div>
              <div className="font-semibold text-slate-900">Integration Scoping</div>
              <div className="text-xs text-slate-500">Day-one scoping for a new customer, checked against vendor docs</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Integrations list in use</div>
              <div className={`max-w-xs truncate text-sm font-medium ${integrations ? 'text-teal-800' : 'text-slate-800'}`} title={integrations?.label ?? meta.integrations.label}>
                {integrations?.label ?? meta.integrations.label} ({integrations?.config.integrations.length ?? meta.integrations.count})
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && loadConfigFile(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
              Load config file
            </button>
            {meta.variants[0] && !integrations && (
              <button
                onClick={() => swapIntegrations({ label: meta.variants[0].config.label, config: meta.variants[0].config, source: meta.variants[0].file })}
                className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-900 hover:bg-teal-100"
                title={meta.variants[0].file}
              >
                Use simulated internal list
              </button>
            )}
            {integrations && (
              <button onClick={() => swapIntegrations(null)} className="rounded-lg px-2 py-1.5 text-sm text-slate-600 underline">
                Reset to public list
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Customer</div>
              <Pill tone="amber">Fictional customer</Pill>
            </div>
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={customer.id}
              onChange={(e) => {
                const c = meta.customers.find((x) => x.id === e.target.value)
                if (c) {
                  setCustomer(c)
                  setPlan(null)
                  setData(null)
                }
              }}
            >
              {meta.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-xs font-medium text-slate-500">Goal</label>
            <textarea value={customer.goal} onChange={(e) => setCustomer({ ...customer, goal: e.target.value })} rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <div className="mt-3 text-xs font-medium text-slate-500">Tools they run</div>
            <ul className="mt-1 space-y-1">
              {customer.tools.map((t) => (
                <li key={t} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-sm">
                  <span>{t}</span>
                  <button onClick={() => setCustomer({ ...customer, tools: customer.tools.filter((x) => x !== t) })} className="text-slate-400 hover:text-rose-600" aria-label={`Remove ${t}`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                const t = newTool.trim()
                if (t && !customer.tools.includes(t)) setCustomer({ ...customer, tools: [...customer.tools, t] })
                setNewTool('')
              }}
            >
              <input value={newTool} onChange={(e) => setNewTool(e.target.value)} placeholder="Add a tool" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm" />
              <button className="rounded-md border border-slate-300 px-2 text-sm">Add</button>
            </form>
            <div className="mt-4 space-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === 'saved'} onChange={() => setMode('saved')} /> Saved model draft
              </label>
              <label className={`flex items-center gap-2 ${meta.live_draft_enabled ? '' : 'text-slate-400'}`} title={meta.live_draft_enabled ? '' : 'Turned off on this deployment'}>
                <input type="radio" disabled={!meta.live_draft_enabled} checked={mode === 'live'} onChange={() => setMode('live')} /> Draft live with Claude (about 2 min)
              </label>
            </div>
            <button onClick={() => runPlan(overrides, null)} disabled={busy !== null} className="mt-4 w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
              {busy === 'plan' ? (mode === 'live' ? 'Drafting and verifying…' : 'Building plan…') : 'Build scoping plan'}
            </button>
          </div>

          {plan && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Export</div>
              <div className="mt-2 grid gap-1.5">
                <button onClick={() => downloadPdf(blocks, `${exportName}-scoping-plan.pdf`)} className="rounded-md border border-slate-300 px-3 py-1.5 text-left text-sm hover:bg-slate-50">
                  Customer plan (PDF)
                </button>
                <button onClick={() => downloadText(toMarkdown(blocks), `${exportName}-scoping-plan.md`)} className="rounded-md border border-slate-300 px-3 py-1.5 text-left text-sm hover:bg-slate-50">
                  Customer plan (Markdown)
                </button>
                <button onClick={() => downloadText(toMarkdown(handoff), `${exportName}-internal-handoff.md`)} className="rounded-md border border-slate-300 px-3 py-1.5 text-left text-sm hover:bg-slate-50">
                  Internal handoff (Markdown)
                </button>
              </div>
              {!data && <p className="mt-2 text-xs text-slate-500">Run the data checks to include data readiness in the handoff.</p>}
            </div>
          )}
        </aside>

        <main className="min-w-0">
          {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>}
          {Object.keys(changed).length > 0 && (
            <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
              Integrations list swapped, no code change. {Object.entries(changed).map(([t, was]) => `${t}: ${was} → ${BUCKET_LABEL[plan!.coverage.find((c) => c.input === t)!.bucket]}`).join('; ')}.
            </div>
          )}
          {!plan ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="text-base font-semibold text-slate-900">{customer.name}</div>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                Build a one-page scoping plan: what connects first, what access is needed and from whom, what we check before trusting the data, and what we still need to ask.
              </p>
              <button onClick={() => runPlan(overrides, null)} disabled={busy !== null} className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                {busy === 'plan' ? 'Building plan…' : 'Build scoping plan'}
              </button>
            </div>
          ) : (
            <>
              <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-slate-200/60 p-1 text-sm">
                {(
                  [
                    ['plan', 'Scoping plan'],
                    ['data', 'Data readiness'],
                    ['verification', `Verification (${plan.verification.facts_verified}/${plan.verification.facts_total})`],
                    ['handoff', 'Internal handoff'],
                  ] as [Tab, string][]
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => {
                      setTab(k)
                      if (k === 'data' && !data) runData()
                    }}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {l}
                  </button>
                ))}
              </nav>
              {tab === 'plan' && <PlanView plan={plan} labels={labels} onCite={setCite} changed={changed} />}
              {tab === 'data' && (
                <DataView
                  data={data}
                  loading={busy === 'data'}
                  labels={labels}
                  onRun={() => runData()}
                  onCite={setCite}
                  decisions={decisions}
                  onDecide={(pair, d) => {
                    const next = { ...decisions }
                    if (d) next[pair] = d
                    else delete next[pair]
                    setDecisions(next)
                    runData(next, uploads)
                  }}
                  uploads={uploads}
                  onUpload={(src, rows) => {
                    const next = { ...uploads }
                    if (rows) next[src] = rows
                    else delete next[src]
                    setUploads(next)
                    setDecisions({})
                    runData({}, next)
                  }}
                />
              )}
              {tab === 'verification' && <VerificationView plan={plan} labels={labels} onCite={setCite} />}
              {tab === 'handoff' && <DocPreview blocks={handoff} />}
            </>
          )}
        </main>
      </div>
      {cite && <Drawer cite={cite} excerpt={excerptFor(cite)} label={labels[cite.file] ?? cite.file} onClose={() => setCite(null)} />}
    </div>
  )
}
