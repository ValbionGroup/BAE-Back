import { escapeHtml, printPage, PW } from '#services/print/print_layout'
import type { ShoppingList, ShoppingListLine } from '#services/shopping_list_service'

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

function lineRow(line: ShoppingListLine): string {
  return `<tr>
    <td>${escapeHtml(line.name)}</td>
    <td class="pp-mono" style="color:${PW.mid}">${line.unit ? escapeHtml(line.unit) : '—'}</td>
    <td class="pp-mono" style="text-align:right">${line.needQty}</td>
    <td class="pp-mono" style="text-align:right;color:${PW.mid}">${line.stockQty}</td>
    <td class="pp-mono" style="text-align:right;font-weight:700">${line.missingQty}</td>
    <td class="pp-mono" style="text-align:right">${line.bestPrice === null ? '—' : eur(line.bestPrice)}</td>
  </tr>`
}

export function buildShoppingListHtml(list: ShoppingList): string {
  const body = `
    <div style="font-size:12px;color:${PW.mid};margin-bottom:12px">${list.lineCount} ligne${list.lineCount > 1 ? 's' : ''} à acheter</div>
    <table class="pp-table">
      <thead><tr><th>Produit</th><th>Unité</th><th style="text-align:right">Besoin</th><th style="text-align:right">Stock</th><th style="text-align:right">À acheter</th><th style="text-align:right">Meilleur prix</th></tr></thead>
      <tbody>${list.lines.map(lineRow).join('')}</tbody>
    </table>
    <div style="margin-top:20px;padding-top:14px;border-top:2.5px solid ${PW.ink};display:flex;justify-content:space-between">
      <div>
        <div style="font-size:12px;color:${PW.mid}">Total optimum multi-enseigne</div>
        <div class="pp-mono" style="font-size:22px;font-weight:700">${eur(list.optimumTotal)}</div>
      </div>
      ${
        list.savings !== null
          ? `<div style="text-align:right">
        <div style="font-size:12px;color:${PW.mid}">Économie vs. une seule enseigne à couverture complète</div>
        <div class="pp-mono" style="font-size:22px;font-weight:700">−${eur(list.savings)}</div>
      </div>`
          : ''
      }
    </div>
  `
  return printPage('Fiche logistique — liste de courses', list.eventName, body)
}
