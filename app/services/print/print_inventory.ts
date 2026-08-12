import { escapeHtml, printPage, PW } from '#services/print/print_layout'
import type { InventoryRow } from '#services/stock_service'

function statusOf(
  batch: InventoryRow['batches'][number],
  now: Date
): { label: string; bold: boolean } {
  if (batch.remainingQty <= 0) return { label: '—', bold: false }
  const expired = batch.expirationDate ? batch.expirationDate.toJSDate() < now : false
  if (expired) return { label: 'PÉRIMÉ', bold: true }
  const soon = batch.expirationDate
    ? batch.expirationDate.toJSDate() < new Date(now.getTime() + 7 * 86_400_000)
    : false
  return { label: soon ? 'PROCHE PÉREMPTION' : 'OK', bold: false }
}

export function buildInventoryHtml(rows: InventoryRow[]): string {
  const now = new Date()
  const totalBatches = rows.reduce((sum, r) => sum + r.batches.length, 0)

  const body = `
    <div style="display:flex;gap:22px;margin-bottom:12px;font-size:12.5px">
      <span><b class="pp-mono">${rows.length}</b> produits</span>
      <span><b class="pp-mono">${totalBatches}</b> lots</span>
    </div>
    <table class="pp-table">
      <thead><tr><th>Catégorie</th><th>Produit</th><th>N° de lot</th><th style="text-align:right">Qté restante</th><th>DLC</th><th>Statut</th></tr></thead>
      <tbody>
        ${rows
          .map((row) =>
            row.batches
              .map((batch, i) => {
                const status = statusOf(batch, now)
                return `<tr>
              <td style="color:${PW.mid}">${i === 0 ? escapeHtml(row.categoryName) : ''}</td>
              <td style="font-weight:${i === 0 ? 600 : 400}">${i === 0 ? escapeHtml(row.goodName) : ''}</td>
              <td class="pp-mono" style="font-weight:700">${escapeHtml(batch.label)}</td>
              <td class="pp-mono" style="text-align:right">${batch.remainingQty} ${escapeHtml(row.unit)}</td>
              <td class="pp-mono">${batch.expirationDate ? batch.expirationDate.toFormat('dd/MM/yyyy') : '—'}</td>
              <td style="font-weight:${status.bold ? 700 : 500}">${status.label}</td>
            </tr>`
              })
              .join('')
          )
          .join('')}
      </tbody>
    </table>
  `
  return printPage('Inventaire de stock par lots', undefined, body)
}
