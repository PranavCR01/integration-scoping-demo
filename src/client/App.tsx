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
import { OwnersView, SummaryCard } from './components/Summary'
import { buildActions, buildSummary, customerDataAsks } from '../core/summary'
import { Drawer } from './components/Drawer'
import type { CiteTarget } from './components/ui'
import { CustomerBar, Header, Intake, Landing, Modal } from './components/Shell'

type Tab = 'plan' | 'owners' | 'data' | 'verification' | 'handoff'

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [editing, setEditing] = useState(false)
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
  const [evidence, setEvidence] = useState(false)
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
      const [p, d] = await Promise.all([
        getPlan({ customer, mode, overrides: ov }),
        prev ? Promise.resolve(null) : getData({ customer, decisions: {}, uploads: {}, overrides: ov }).catch(() => null),
      ])
      if (!prev) {
        setData(d)
        setDecisions({})
        setUploads({})
      }
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
  const blocks = plan ? planBlocks(plan, labels, plan.document.oob_access_note, plan.document.footer, plan.document.title_prefix, plan.document.status, data) : []
  const handoff = plan ? handoffBlocks(plan, data, labels) : []
  const summary = plan ? buildSummary(plan, data) : null
  const actions = plan ? buildActions(plan, data) : []
  const excerptFor = (c: CiteTarget) => plan?.excerpts[`${c.file}#L${c.line}`] ?? data?.excerpts?.[`${c.file}#L${c.line}`]

  if (!meta || !customer) {
    return <div className="p-10 text-sm text-slate-500">{error ? `Error: ${error}` : 'Loading…'}</div>
  }

  const pickCustomer = (id: string) => {
    const c = meta.customers.find((x) => x.id === id)
    if (c) {
      setCustomer(c)
      setPlan(null)
      setData(null)
    }
  }
  const intakeProps = {
    customer,
    customers: meta.customers,
    onChange: setCustomer,
    onPick: pickCustomer,
    busy: busy === 'plan',
    liveEnabled: meta.live_draft_enabled,
    mode,
    onMode: setMode,
    goalProfiles: meta.goal_profiles,
  }
  const exportsList = [
    { label: 'Customer plan (PDF)', sub: 'Clean document for the customer to review', onClick: () => downloadPdf(blocks, `${exportName}-scoping-plan.pdf`) },
    { label: 'Customer plan (Markdown)', sub: 'Same content, editable', onClick: () => downloadText(toMarkdown(blocks), `${exportName}-scoping-plan.md`) },
    { label: 'Internal handoff (PDF)', sub: 'Open items, held-back drafts, data readiness', onClick: () => downloadPdf(handoff, `${exportName}-internal-handoff.pdf`, 'Internal handoff · not for the customer · fictional customer') },
    { label: 'Internal handoff (Markdown)', sub: 'Same content, editable', onClick: () => downloadText(toMarkdown(handoff), `${exportName}-internal-handoff.md`) },
  ]

  return (
    <div className="min-h-screen">
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && loadConfigFile(e.target.files[0])} />
      <Header
        configLabel={integrations?.label ?? meta.integrations.label}
        configCount={integrations?.config.integrations.length ?? meta.integrations.count}
        swapped={!!integrations}
        canSimulate={!!meta.variants[0]}
        onLoadFile={() => fileRef.current?.click()}
        onSimulate={() => swapIntegrations({ label: meta.variants[0].config.label, config: meta.variants[0].config, source: meta.variants[0].file })}
        onReset={() => swapIntegrations(null)}
      />

      {!plan ? (
        <>
          {error && <div className="mx-auto mt-6 max-w-4xl rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>}
          <Landing {...intakeProps} onBuild={() => runPlan(overrides, null)} cta="Build scoping plan" />
        </>
      ) : (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6">
        <CustomerBar customer={plan.customer} onEdit={() => setEditing(true)} exports={exportsList} />
        <main className="min-w-0">
          {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>}
          {Object.keys(changed).length > 0 && (
            <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
              Integrations list swapped, no code change. {Object.entries(changed).map(([t, was]) => `${t}: ${was} → ${BUCKET_LABEL[plan!.coverage.find((c) => c.input === t)!.bucket]}`).join('; ')}.
            </div>
          )}
          {(
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <nav className="flex gap-1 overflow-x-auto rounded-lg bg-slate-200/60 p-1 text-sm">
                  {(
                    [
                      ['plan', 'Plan'],
                      ['owners', `Who owes what (${actions.length})`],
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
                {tab === 'plan' && (
                  <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
                    <span>Show evidence</span>
                    <button
                      role="switch"
                      aria-checked={evidence}
                      onClick={() => setEvidence(!evidence)}
                      className={`relative h-5 w-9 rounded-full transition ${evidence ? 'bg-teal-700' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${evidence ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </label>
                )}
              </div>
              {tab === 'plan' && (
                <div className="space-y-4">
                  {summary && <SummaryCard plan={plan} summary={summary} onOwners={() => setTab('owners')} />}
                  <PlanView plan={plan} labels={labels} onCite={setCite} changed={changed} evidence={evidence} dataAsks={plan ? customerDataAsks(plan, data) : []} />
                </div>
              )}
              {tab === 'owners' && <OwnersView actions={actions} customerName={plan.customer.name} dataRun={!!data} later={plan.coverage.filter((c) => plan.scope?.later.includes(c.tool_key)).map((c) => c.input)} />}
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
      )}
      {editing && (
        <Modal onClose={() => setEditing(false)}>
          <Intake
            {...intakeProps}
            cta="Rebuild plan"
            eyebrow="Edit customer"
            onBuild={async () => {
              await runPlan(overrides, null)
              setEditing(false)
            }}
          />
        </Modal>
      )}
      {cite && <Drawer cite={cite} excerpt={excerptFor(cite)} label={labels[cite.file] ?? cite.file} onClose={() => setCite(null)} />}
    </div>
  )
}
