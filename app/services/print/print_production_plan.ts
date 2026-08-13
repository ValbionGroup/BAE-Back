import { callout, checkbox, escapeHtml, printPage, PW } from '#services/print/print_layout'
import type { GoodNeed } from '#services/production_service'

function goodBlock(line: GoodNeed): string {
  const rows = line.picks
    .map(
      (pick, i) => `<tr>
      <td>${checkbox()}</td>
      <td class="pp-mono" style="font-weight:700;font-size:15px">${escapeHtml(pick.label)}</td>
      <td class="pp-mono">${pick.expirationDate ?? '—'}</td>
      <td class="pp-mono" style="text-align:right;font-weight:700">${pick.takeQty} ${escapeHtml(line.unit)}</td>
      <td style="text-align:right">${i === 0 ? `<span style="font-size:11px;font-weight:700;border:1.4px solid ${PW.ink};padding:2px 7px">PRENDRE EN 1ER</span>` : ''}</td>
    </tr>`
    )
    .join('')

  return `<div style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.5px solid ${PW.ink};padding-bottom:5px;margin-bottom:8px">
      <span style="font-size:15px;font-weight:700">${escapeHtml(line.goodName)}</span>
      <span class="pp-mono" style="font-size:12.5px;color:${PW.mid}">besoin ${line.needQty} ${escapeHtml(line.unit)}</span>
    </div>
    ${
      line.picks.length === 0
        ? `<div style="font-size:12.5px;color:${PW.mid}">Aucun lot utilisable — disponible ${line.availableQty} ${escapeHtml(line.unit)}.</div>`
        : `<table class="pp-table"><thead><tr><th style="width:30px"></th><th>N° de lot</th><th>Date de péremption</th><th style="text-align:right">Quantité à prélever</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    }
  </div>`
}

export function buildProductionPlanHtml(eventName: string, lines: GoodNeed[]): string {
  const body =
    lines.map(goodBlock).join('') +
    callout("Le non-alimentaire (barquettes, couverts) n'est pas prélevé par ce plan.")
  return printPage('Plan de prélèvement FEFO', eventName, body)
}
