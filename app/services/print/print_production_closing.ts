import { escapeHtml, printPage, PW } from '#services/print/print_layout'
import type { ReturnableGood } from '#services/production_service'

function row(good: ReturnableGood): string {
  return `<tr>
    <td style="font-weight:600">${escapeHtml(good.goodName)}</td>
    <td class="pp-mono" style="color:${PW.mid}">${escapeHtml(good.unit)}</td>
    <td class="pp-mono" style="text-align:right">${good.takenQty}</td>
    <td class="pp-mono" style="text-align:right">${good.returnableQty}</td>
    <td><div style="border-bottom:1.4px solid ${PW.ink};height:20px"></div></td>
    <td><div style="border-bottom:1.4px solid ${PW.ink};height:20px"></div></td>
  </tr>`
}

export function buildProductionClosingHtml(eventName: string, goods: ReturnableGood[]): string {
  const body = `
    ${
      goods.length === 0
        ? `<div style="font-size:12.5px;color:${PW.mid}">Aucune production lancée sur cette soirée.</div>`
        : `<table class="pp-table">
      <thead><tr><th>Denrée</th><th>Unité</th><th style="text-align:right">Prélevée</th><th style="text-align:right">Rendable</th><th style="width:150px">Retour en réserve</th><th style="width:130px">Rebut</th></tr></thead>
      <tbody>${goods.map(row).join('')}</tbody>
    </table>`
    }
    <div style="margin-top:26px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
      <div><div style="font-size:11.5px;color:${PW.mid};margin-bottom:26px">Rempli par · signature</div><div style="border-top:1.4px solid ${PW.ink}"></div></div>
      <div><div style="font-size:11.5px;color:${PW.mid};margin-bottom:26px">Vérifié par · signature</div><div style="border-top:1.4px solid ${PW.ink}"></div></div>
    </div>
  `
  return printPage('Feuille de clôture de production', eventName, body)
}
