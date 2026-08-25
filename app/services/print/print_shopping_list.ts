import {
  checkbox,
  callout,
  escapeHtml,
  printPage,
  sectionLabel,
  PW,
} from '#services/print/print_layout'
import type { ShoppingList, ShoppingListLine } from '#services/shopping_list_service'

// Reçoit des **centimes** : toute la liste de courses est en centimes entiers.
const eur = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`

interface RetailerColumn {
  id: number
  name: string
}

/**
 * One column per retailer actually pricing at least one "good" line — mirrors
 * the front's `buildRetailerColumns`. Furniture carries no supplier relation
 * (`shopping_list_service.ts`), so it never contributes a column: the mockup's
 * per-store furniture prices were invented, real `furnitures` rows only have
 * one flat price (`bestPrice`), reflected in `nonAlimTable` below instead of a
 * per-retailer grid.
 */
function retailerColumns(lines: ShoppingListLine[]): RetailerColumn[] {
  const coverage = new Map<number, { name: string; coverage: number }>()
  for (const line of lines) {
    if (line.kind !== 'good') continue
    for (const supplier of line.suppliers) {
      const entry = coverage.get(supplier.id)
      if (entry) entry.coverage += 1
      else coverage.set(supplier.id, { name: supplier.name, coverage: 1 })
    }
  }
  return [...coverage.entries()]
    .map(([id, { name, coverage: c }]) => ({ id, name, coverage: c }))
    .sort((a, b) => b.coverage - a.coverage || a.name.localeCompare(b.name, 'fr'))
    .map(({ id, name }) => ({ id, name }))
}

function goodsTable(lines: ShoppingListLine[], columns: RetailerColumn[]): string {
  const rows = lines
    .map((line) => {
      const byId = new Map(line.suppliers.map((s) => [s.id, s.price]))
      const cells = columns
        .map((col) => {
          const price = byId.get(col.id)
          return `<td class="pp-mono" style="text-align:right;color:${price === undefined ? PW.faint : PW.ink}">${price === undefined ? '—' : eur(price)}</td>`
        })
        .join('')
      return `<tr>
        <td>${checkbox()}</td>
        <td>${escapeHtml(line.name)}</td>
        <td class="pp-mono" style="color:${PW.mid}">${line.unit ? escapeHtml(line.unit) : '—'}</td>
        <td class="pp-mono" style="text-align:right">${line.needQty}</td>
        <td class="pp-mono" style="text-align:right;color:${PW.mid}">${line.stockQty}</td>
        <td class="pp-mono" style="text-align:right;font-weight:700">${line.missingQty}</td>
        ${cells}
      </tr>`
    })
    .join('')

  return `<table class="pp-table">
    <thead><tr>
      <th style="width:30px"></th>
      <th>Produit</th><th>Unité</th>
      <th style="text-align:right">Besoin</th><th style="text-align:right">Stock</th><th style="text-align:right">À acheter</th>
      ${columns.map((c) => `<th style="text-align:right">${escapeHtml(c.name)}</th>`).join('')}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function nonAlimTable(lines: ShoppingListLine[]): string {
  const rows = lines
    .map(
      (line) => `<tr>
        <td>${checkbox()}</td>
        <td>${escapeHtml(line.name)}</td>
        <td class="pp-mono" style="text-align:right">${line.needQty}</td>
        <td class="pp-mono" style="text-align:right;color:${PW.mid}">${line.stockQty}</td>
        <td class="pp-mono" style="text-align:right;font-weight:700">${line.missingQty}</td>
        <td class="pp-mono" style="text-align:right">${line.bestPrice === null ? '—' : eur(line.bestPrice)}</td>
      </tr>`
    )
    .join('')

  return `<table class="pp-table">
    <thead><tr><th style="width:30px"></th><th>Produit</th><th style="text-align:right">Besoin</th><th style="text-align:right">Stock</th><th style="text-align:right">À acheter</th><th style="text-align:right">Prix unitaire</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

export function buildShoppingListHtml(list: ShoppingList): string {
  const goodLines = list.lines.filter((l) => l.kind === 'good')
  const furnitureLines = list.lines.filter((l) => l.kind === 'furniture')
  const columns = retailerColumns(list.lines)

  const synthesisCards = list.supplierTotals
    .map((total) => {
      const referenced = goodLines.filter((l) => l.suppliers.some((s) => s.id === total.id)).length
      return `<div style="border:1.4px solid ${PW.ink};padding:10px">
      <div style="font-size:13px;font-weight:700">${escapeHtml(total.name)}</div>
      <div class="pp-mono" style="font-size:19px;font-weight:700;margin-top:4px">${eur(total.total)}</div>
      <div style="font-size:11px;color:${PW.mid};margin-top:4px">${referenced}/${goodLines.length} lignes référencées${!total.fullCoverage ? ' · couverture partielle' : ''}</div>
      <div style="font-size:11px;font-weight:700;margin-top:4px">${total.fullCoverage ? 'COUVERTURE COMPLÈTE' : 'COUVERTURE PARTIELLE'}</div>
    </div>`
    })
    .join('')

  const body = `
    ${sectionLabel('Denrées')}
    ${goodLines.length > 0 ? goodsTable(goodLines, columns) : `<div style="font-size:12.5px;color:${PW.mid}">Aucune denrée à acheter.</div>`}
    ${sectionLabel('Non-alimentaire')}
    ${furnitureLines.length > 0 ? nonAlimTable(furnitureLines) : `<div style="font-size:12.5px;color:${PW.mid}">Aucun non-alimentaire à acheter.</div>`}

    <div style="margin-top:20px">
      ${sectionLabel('Synthèse')}
      <div style="display:grid;grid-template-columns:repeat(${Math.max(list.supplierTotals.length, 1)},1fr);gap:10px">
        ${synthesisCards}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:14px;padding-top:12px;border-top:2.5px solid ${PW.ink}">
        <div>
          <div style="font-size:12px;color:${PW.mid}">Total optimum multi-enseigne</div>
          <div class="pp-mono" style="font-size:24px;font-weight:700">${eur(list.optimumTotal)}</div>
        </div>
        ${
          list.savings !== null
            ? `<div style="text-align:right">
          <div style="font-size:12px;color:${PW.mid}">Économie vs. une seule enseigne à couverture complète</div>
          <div class="pp-mono" style="font-size:24px;font-weight:700">−${eur(list.savings)}</div>
        </div>`
            : ''
        }
      </div>
      ${callout(
        "Une enseigne à couverture partielle affiche un total plus bas parce qu'elle référence moins de lignes — pas parce qu'elle est moins chère. Comparez d'abord le nombre de lignes référencées."
      )}
    </div>
  `
  return printPage('Fiche logistique — liste de courses', list.eventName, body)
}
