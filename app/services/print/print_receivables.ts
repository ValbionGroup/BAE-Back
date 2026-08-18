import { callout, escapeHtml, printPage, sectionLabel, PW } from '#services/print/print_layout'
import type { ReceivableCategory, ReceivableStatement } from '#services/receivable_service'

const eur = (cents: number): string => `${(cents / 100).toFixed(2).replace('.', ',')} €`

function categoryTable(category: ReceivableCategory): string {
  const rows = category.lines
    .map(
      (line) => `<tr>
    <td style="font-weight:600">${escapeHtml(line.productName)}</td>
    <td class="pp-mono" style="text-align:right">${line.quantity}</td>
    <td class="pp-mono" style="text-align:right;color:${PW.mid}">${eur(line.listPriceCents)}</td>
    <td class="pp-mono" style="text-align:right;color:${PW.mid}">${eur(line.paidPriceCents)}</td>
    <td class="pp-mono" style="text-align:right;font-weight:600">${eur(line.dueCents)}</td>
  </tr>`
    )
    .join('')

  return `${sectionLabel(escapeHtml(category.label))}
  <table class="pp-table">
    <thead><tr>
      <th>Article</th>
      <th style="text-align:right;width:70px">Qté</th>
      <th style="text-align:right;width:110px">Prix public</th>
      <th style="text-align:right;width:110px">Prix payé</th>
      <th style="text-align:right;width:110px">Dû</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin:8px 0 22px;text-align:right;font-size:12.5px">
    Sous-total <span class="pp-mono" style="font-weight:600">${eur(category.dueCents)}</span>
  </div>`
}

export function buildReceivablesHtml(statement: ReceivableStatement): string {
  const payer = statement.payerName
    ? `<span style="font-weight:600">${escapeHtml(statement.payerName)}</span>`
    : `<span style="font-weight:600;color:${PW.ink}">payeur non renseigné</span>`

  const body = `
    <div style="font-size:12.5px;color:${PW.mid};margin-bottom:20px">Remboursé par : ${payer}</div>
    ${
      statement.categories.length === 0
        ? `<div style="font-size:12.5px;color:${PW.mid}">Aucune commande prise en charge sur cette soirée.</div>`
        : statement.categories.map(categoryTable).join('')
    }
    <div style="margin-top:14px;border-top:1.4px solid ${PW.ink};padding-top:10px;text-align:right;font-size:14px">
      Total dû <span class="pp-mono" style="font-weight:600">${eur(statement.dueCents)}</span>
    </div>
    ${callout("Ce document n'est pas une facture : il justifie le montant demandé, la pièce comptable est émise par la trésorerie.")}
  `

  return printPage('Justificatif de prise en charge', statement.eventName, body)
}
