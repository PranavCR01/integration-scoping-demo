import { useState } from 'react'
import Papa from 'papaparse'
import type { DataReport } from '../../core/data'
import { CiteChip, Pill, Section, Stat, shortLabel, type CiteTarget } from './ui'

interface Props {
  data: DataReport | null
  loading: boolean
  labels: Record<string, string>
  onRun: () => void
  onCite: (c: CiteTarget) => void
  decisions: Record<string, 'same' | 'different'>
  onDecide: (pair: string, d: 'same' | 'different' | null) => void
  uploads: Record<string, unknown[]>
  onUpload: (source: string, rows: unknown[] | null) => void
}

const SRC_NAME: Record<string, string> = { tenable_assets: 'Tenable', tenable_vulns: 'Tenable vulns', crowdstrike_hosts: 'CrowdStrike', okta_devices: 'Okta' }
const srcName = (s: string) => SRC_NAME[s] ?? s

export function DataView({ data, loading, labels, onRun, onCite, decisions, onDecide, uploads, onUpload }: Props) {
  const [showAll, setShowAll] = useState(false)
  const [uploadSource, setUploadSource] = useState('crowdstrike_hosts')
  const [uploadError, setUploadError] = useState<string | null>(null)

  const readFile = async (f: File) => {
    setUploadError(null)
    const text = await f.text()
    try {
      if (f.name.endsWith('.csv')) {
        const r = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true })
        if (r.errors.length) throw new Error(r.errors[0].message)
        onUpload(uploadSource, r.data)
      } else {
        const j = JSON.parse(text)
        if (!Array.isArray(j)) throw new Error('Expected a JSON array of records')
        onUpload(uploadSource, j)
      }
    } catch (e) {
      setUploadError((e as Error).message)
    }
  }

  if (!data) {
    return (
      <Section title="Data readiness">
        <p className="text-sm text-slate-600">
          Runs the planned data checks on sample exports: maps each tool's records into one common format, finds the same machine across tools, and flags stale assets, coverage gaps, orphan findings and count mismatches. Weak matches go to a person, never merged silently.
        </p>
        <button onClick={onRun} disabled={loading} className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
          {loading ? 'Running…' : 'Run data checks on sample exports'}
        </button>
      </Section>
    )
  }

  const blocking = data.checks.filter((c) => c.level === 'block')
  const merged = data.assets.filter((a) => showAll || a.sources.length > 1 || a.same_tool_duplicates.length)
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : 'n/a')

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${data.ready ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`text-base font-semibold ${data.ready ? 'text-emerald-900' : 'text-rose-900'}`}>
            {data.ready ? 'Ready to feed a risk number' : `Not ready to feed a risk number: ${blocking.length} blocking item${blocking.length === 1 ? '' : 's'}`}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.synthetic && <Pill tone="amber">Synthetic sample exports (fictional)</Pill>}
            {Object.keys(uploads).length > 0 && <Pill tone="teal">Uploaded: {Object.keys(uploads).map(srcName).join(', ')}</Pill>}
            <Pill>As of {data.as_of.slice(0, 10)}</Pill>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {data.checks.map((c) => (
            <li key={c.check} className="flex gap-2">
              <span className={`mt-0.5 inline-block w-20 shrink-0 rounded px-1.5 text-center text-[11px] font-semibold uppercase ${c.level === 'block' ? 'bg-rose-600 text-white' : c.level === 'warn' ? 'bg-amber-200 text-amber-900' : 'bg-emerald-600 text-white'}`}>
                {c.level === 'block' ? 'Blocking' : c.level === 'warn' ? 'Warning' : 'OK'}
              </span>
              <span className="text-slate-800">
                {c.text}. <span className="text-slate-600">{c.detail}.</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Asset records" value={data.totals.asset_records} />
        <Stat label="Real assets after merge" value={data.totals.merged_assets} />
        <Stat label="Merged across tools" value={data.totals.cross_tool_merges} />
        <Stat label="Need a person" value={data.totals.review} tone={data.totals.review ? 'amber' : 'emerald'} />
        <Stat label="Stale" value={data.totals.stale} tone={data.totals.stale ? 'amber' : undefined} />
        <Stat label="With endpoint agent" value={pct(data.coverage.with_edr, data.coverage.population)} />
        <Stat label="Orphan findings" value={data.totals.orphans} tone={data.totals.orphans ? 'rose' : undefined} />
      </div>

      <Section title="Possible duplicates that need a person" aside={<span className="text-xs text-slate-500">Weak evidence never merges on its own</span>}>
        {data.review.length === 0 ? (
          <p className="text-sm text-emerald-800">Nothing waiting. {data.decisions_applied ? `${data.decisions_applied} decision(s) applied.` : ''}</p>
        ) : (
          <div className="space-y-2">
            {data.review.map((r) => {
              const key = r.pair.join('|')
              return (
                <div key={key} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-semibold text-slate-900">{r.a.label}</span>
                      <span className="mx-2 text-slate-400">and</span>
                      <span className="font-semibold text-slate-900">{r.b.label}</span>
                    </div>
                    <Pill tone="amber">confidence {r.confidence.toFixed(2)}</Pill>
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    {r.label}: <code>{r.shared}</code>. {r.why}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => onDecide(key, 'same')} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50">
                      Same machine: merge
                    </button>
                    <button onClick={() => onDecide(key, 'different')} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50">
                      Different machines
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {Object.keys(decisions).length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            Decisions recorded: {Object.entries(decisions).map(([k, d]) => `${k.split('|').map((x) => x.split(':')[1]).join(' + ')} = ${d}`).join('; ')}
            <button onClick={() => Object.keys(decisions).forEach((k) => onDecide(k, null))} className="underline">
              clear
            </button>
          </div>
        )}
      </Section>

      <Section
        title="Merged assets"
        aside={
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show single-tool assets too
          </label>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Asset</th>
                <th className="py-2 pr-3 font-medium">Seen by</th>
                <th className="py-2 pr-3 font-medium">Why merged</th>
                <th className="py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {merged.map((a) => (
                <tr key={a.asset_id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-slate-900">{a.names.join(' / ') || a.asset_id}</div>
                    <div className="text-xs text-slate-500">{a.asset_id} · {a.findings} finding{a.findings === 1 ? '' : 's'}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {a.sources.map((s) => (
                        <Pill key={s}>{srcName(s)}</Pill>
                      ))}
                      {a.same_tool_duplicates.map((s) => (
                        <Pill key={`d-${s}`} tone="amber">
                          2 records in {srcName(s)}
                        </Pill>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-slate-700">
                    {a.reasons.length === 0 ? <span className="text-slate-400">Single record</span> : a.reasons.map((r, i) => (
                      <div key={i}>
                        {r.label}: <code>{r.shared}</code>
                      </div>
                    ))}
                  </td>
                  <td className="py-2 tabular-nums text-slate-700">{a.reasons.length ? a.confidence.toFixed(2) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Coverage gaps">
          <div className="text-sm text-slate-700">
            <div className="font-medium text-slate-900">No endpoint agent ({data.coverage.no_edr.length} of {data.coverage.population} active assets)</div>
            <div className="mt-1 flex flex-wrap gap-1">{data.coverage.no_edr.map((a) => <Pill key={a.asset_id}>{a.hostname}</Pill>)}</div>
            <div className="mt-3 font-medium text-slate-900">Not scanned in the last {data.settings.scan_recent_days} days ({data.coverage.not_scanned.length})</div>
            <div className="mt-1 flex flex-wrap gap-1">{data.coverage.not_scanned.map((a) => <Pill key={a.asset_id}>{a.hostname}</Pill>)}</div>
            {data.coverage.identity_only.length > 0 && (
              <>
                <div className="mt-3 font-medium text-slate-900">Seen only by the identity tool (not counted until agreed in scope)</div>
                <div className="mt-1 flex flex-wrap gap-1">{data.coverage.identity_only.map((a) => <Pill key={a.asset_id}>{a.label}</Pill>)}</div>
              </>
            )}
          </div>
        </Section>
        <Section title="Stale assets and orphan findings">
          <div className="text-sm text-slate-700">
            <div className="font-medium text-slate-900">Not seen in over {data.settings.stale_after_days} days</div>
            <ul className="mt-1 space-y-0.5">
              {data.stale.map((s) => (
                <li key={s.asset_id}>
                  {s.hostname} <span className="text-slate-500">({s.days} days, {s.sources.map(srcName).join(', ')})</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 font-medium text-slate-900">Findings pointing to unknown assets</div>
            <ul className="mt-1 space-y-0.5">
              {data.orphans.map((o) => (
                <li key={o.finding_id}>
                  <code>{o.finding_id}</code> points to <code>{o.asset_ref}</code>
                </li>
              ))}
              {data.orphans.length === 0 && <li className="text-slate-500">None</li>}
            </ul>
          </div>
        </Section>
      </div>

      <Section title="Counts against each tool's console">
        <table className="w-full text-sm">
          <tbody>
            {data.sources.map((s) => (
              <tr key={s.key} className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-900">{s.label}</td>
                <td className="py-1.5 pr-3 tabular-nums">{s.records} in export</td>
                <td className="py-1.5 pr-3 tabular-nums">{s.console === null ? 'console count not provided' : `${s.console} in console`}</td>
                <td className="py-1.5">{s.mismatch ? <Pill tone="rose">Mismatch</Pill> : s.console === null ? <Pill>Ask customer</Pill> : <Pill tone="emerald">Match</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Field mapping into our common format" aside={<span className="text-xs text-slate-500">config/source_mappings.json</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Their field</th>
                <th className="py-2 pr-3 font-medium">Our field</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.mapping.map((m) => (
                <tr key={`${m.source}.${m.from}`} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-600">{srcName(m.source)}</td>
                  <td className="py-1.5 pr-3">
                    <code>{m.from}</code>
                  </td>
                  <td className="py-1.5 pr-3">
                    <code>{m.canonical}</code>
                  </td>
                  <td className="py-1.5">
                    {m.status === 'verified' && m.citation ? (
                      <CiteChip c={{ ...m.citation, kind: 'field', value: m.from }} label={shortLabel(m.citation.file, labels)} onOpen={onCite} />
                    ) : m.status === 'placeholder' ? (
                      <span className="text-xs text-amber-800">Confirm: placeholder, not in attached docs</span>
                    ) : (
                      <span className="text-xs text-rose-700">Failed: {m.detail}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Try your own export">
        <p className="text-sm text-slate-600">Replace one source with a CSV or JSON export. Columns are read with the same mapping config.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={uploadSource} onChange={(e) => setUploadSource(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
            {data.sources.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <input type="file" accept=".csv,.json" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} className="text-sm" />
          {Object.keys(uploads).length > 0 && (
            <button onClick={() => Object.keys(uploads).forEach((k) => onUpload(k, null))} className="text-sm text-teal-800 underline">
              Back to sample exports
            </button>
          )}
        </div>
        {uploadError && <p className="mt-2 text-sm text-rose-700">{uploadError}</p>}
      </Section>
    </div>
  )
}
