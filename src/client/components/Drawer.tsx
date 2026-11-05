import type { Excerpt } from '../../core/types'
import type { CiteTarget } from './ui'

export function Drawer({ cite, excerpt, label, onClose }: { cite: CiteTarget; excerpt: Excerpt | undefined; label: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-teal-700">Source, checked by code</div>
            <div className="mt-0.5 font-semibold text-slate-900">{label}</div>
            <div className="font-mono text-xs text-slate-500">
              {cite.file} · line {cite.line}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          {cite.value && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
              Verified {cite.kind}: <code>{cite.value}</code>
              {cite.corrected_from ? <div className="mt-1 text-xs text-emerald-800">The draft cited line {cite.corrected_from}; code found it at line {cite.line}.</div> : null}
            </div>
          )}
          {excerpt ? (
            <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-0 text-[12px] leading-5 text-slate-200">
              {excerpt.lines.map((l, i) => {
                const n = excerpt.start + i
                const hit = n === excerpt.highlight
                return (
                  <div key={n} className={hit ? 'bg-teal-500/25' : ''}>
                    <span className={`inline-block w-16 select-none pr-3 text-right ${hit ? 'text-teal-300' : 'text-slate-500'}`}>{n}</span>
                    <span className="whitespace-pre">{l}</span>
                  </div>
                )
              })}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">No excerpt available for this line.</p>
          )}
        </div>
      </aside>
    </div>
  )
}
