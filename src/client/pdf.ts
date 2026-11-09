// Renders the same blocks as the Markdown export into a PDF, in the browser.
import type { Block } from '../core/doc'

type Inline = string | { text: string; bold?: boolean; italics?: boolean; color?: string; background?: string }

// `code` and **bold** spans become styled runs.
function inline(s: string, base: { italics?: boolean } = {}): Inline[] {
  const out: Inline[] = []
  for (const part of s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)) {
    if (!part) continue
    if (part.startsWith('`')) out.push({ text: part.slice(1, -1), color: '#0f172a', background: '#eef2f7', ...base })
    else if (part.startsWith('**')) out.push({ text: part.slice(2, -2), bold: true, ...base })
    else out.push({ text: part, ...base })
  }
  return out
}

// Column widths proportional to typical content length, with a floor so short columns stay readable.
function colWidths(head: string[], rows: string[][]): string[] {
  const len = head.map((h, i) => Math.max(h.length, ...rows.map((r) => Math.min((r[i] ?? '').length, 400))) ** 0.75)
  const total = len.reduce((a, b) => a + b, 0)
  const pct = len.map((l) => Math.max(15, (l / total) * 100))
  const scale = 100 / pct.reduce((a, b) => a + b, 0)
  return pct.map((p) => `${(p * scale).toFixed(1)}%`)
}

export async function downloadPdf(blocks: Block[], filename: string, footerLabel = 'Fictional customer') {
  const pdfMake: any = (await import('pdfmake/build/pdfmake')).default
  const vfs: any = (await import('pdfmake/build/vfs_fonts')).default
  pdfMake.addVirtualFileSystem(vfs)
  const content: any[] = []
  for (const b of blocks) {
    switch (b.t) {
      case 'h1': content.push({ text: b.text, style: 'h1' }); break
      case 'h2': content.push({ text: b.text, style: 'h2' }); break
      case 'h3': content.push({ text: b.text, style: 'h3' }); break
      case 'p': content.push({ text: inline(b.text), margin: [0, 0, 0, 4] }); break
      case 'note': content.push({ text: inline(b.text, { italics: true }), color: '#475569', margin: [0, 2, 0, 6] }); break
      case 'hr': content.push({ canvas: [{ type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 4, 0, 8] }); break
      case 'list': content.push({ [b.ordered ? 'ol' : 'ul']: b.items.map((i) => ({ text: inline(i), margin: [0, 1, 0, 2] })), margin: [0, 0, 0, 6] }); break
      case 'table':
        content.push({
          table: {
            headerRows: 1,
            keepWithHeaderRows: 1,
            dontBreakRows: true,
            widths: colWidths(b.head, b.rows),
            body: [b.head.map((h) => ({ text: h, bold: true, fillColor: '#f1f5f9' })), ...b.rows.map((r) => r.map((c) => ({ text: inline(c) })))],
          },
          layout: { hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0', paddingTop: () => 3, paddingBottom: () => 3 },
          fontSize: 8.5,
          margin: [0, 0, 0, 8],
        })
        break
    }
  }
  pdfMake
    .createPdf({
      content,
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { fontSize: 9.5, lineHeight: 1.2, color: '#1e293b' },
      styles: { h1: { fontSize: 16, bold: true, margin: [0, 0, 0, 8] }, h2: { fontSize: 12, bold: true, margin: [0, 10, 0, 5], color: '#0f766e' }, h3: { fontSize: 10.5, bold: true, margin: [0, 6, 0, 4] } },
      footer: (page: number, count: number) => ({ text: `${footerLabel} · page ${page} of ${count}`, alignment: 'center', fontSize: 7.5, color: '#94a3b8', margin: [0, 10, 0, 0] }),
    })
    .download(filename)
}

export function downloadText(text: string, filename: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
