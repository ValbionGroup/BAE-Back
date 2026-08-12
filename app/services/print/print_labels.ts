import { escapeHtml, printPage, PW } from '#services/print/print_layout'

export interface LabelData {
  label: string
  goodName: string
  expirationDate: string | null
  qty: string
}

function labelCell(l: LabelData): string {
  return `<div style="width:234px;height:110px;position:relative;border:1px dashed ${PW.faint};padding:8px 10px;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box">
    <div class="pp-mono" style="font-size:32px;font-weight:700;letter-spacing:0.5px;line-height:1">${escapeHtml(l.label)}</div>
    <div style="font-size:12.5px;font-weight:600;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(l.goodName)}</div>
    <div style="display:flex;justify-content:space-between;font-size:11px">
      <span class="pp-mono">DLC ${l.expirationDate ?? '—'}</span>
      <span class="pp-mono">${escapeHtml(l.qty)}</span>
    </div>
  </div>`
}

export function buildLabelsHtml(labels: LabelData[]): string {
  const body = `<div style="display:grid;grid-template-columns:repeat(3, 234px);grid-auto-rows:110px;gap:14px;justify-content:center;margin-top:20px">
    ${labels.map(labelCell).join('')}
  </div>`
  return printPage('Étiquettes de lot — planche de 12', undefined, body)
}
