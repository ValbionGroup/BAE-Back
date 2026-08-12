export const PW = {
  ink: '#131315',
  mid: '#4a4a4a',
  faint: '#87877e',
  hair: '#cbcbc3',
  paper: '#fff',
} as const

/**
 * Les documents imprimés lisent des noms saisis en base (soirée, recette,
 * membre) : sans échappement, un `<` ou un `&` dans un de ces noms casserait
 * la mise en page du tableau plutôt que de s'afficher tel quel.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function printCss(): string {
  return `
    body{margin:0;font-family:'Geist',system-ui,sans-serif;color:${PW.ink};background:${PW.paper};font-size:14.5px;line-height:1.4;padding:28px 34px 22px;box-sizing:border-box}
    .pp-mono{font-family:'Geist Mono',ui-monospace,monospace}
    .pp-table{width:100%;border-collapse:collapse}
    .pp-table thead{display:table-header-group}
    .pp-table tr{page-break-inside:avoid}
    .pp-table th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${PW.mid};text-align:left;padding:5px 8px;border-bottom:2px solid ${PW.ink}}
    .pp-table td{padding:8px 8px;border-bottom:1px solid ${PW.hair};font-size:13.5px;vertical-align:middle}
  `
}

export function printHead(doc: string, event?: string): string {
  const generated = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2.5px solid ${PW.ink};padding-bottom:10px;margin-bottom:16px">
      <div>
        <div style="font-size:11.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${PW.mid}">BAE · Bureau des Alternants</div>
        <div style="font-size:21px;font-weight:700;margin-top:4px;letter-spacing:-0.2px">${escapeHtml(doc)}</div>
      </div>
      <div style="text-align:right;font-size:12px">
        ${event ? `<div style="font-weight:600;font-size:13.5px">${escapeHtml(event)}</div>` : ''}
        <div class="pp-mono" style="margin-top:2px;color:${PW.mid}">Généré le ${generated}</div>
      </div>
    </div>
  `
}

export function printFooterTemplate(note: string): string {
  return `<div style="width:100%;font-size:8pt;color:${PW.faint};font-family:'Geist',system-ui,sans-serif;padding:4px 24px 0;display:flex;justify-content:space-between">
    <span>${note}</span>
    <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`
}

export function printPage(doc: string, event: string | undefined, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${printCss()}</style></head><body>${printHead(doc, event)}${bodyHtml}</body></html>`
}
