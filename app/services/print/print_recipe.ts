import { escapeHtml, printPage, PW } from '#services/print/print_layout'
import type { IngredientLine } from '#controllers/products_controller'

function ingredientRow(line: IngredientLine, index: number): string {
  return `<li style="display:flex;gap:12px;align-items:flex-start">
    <span class="pp-mono" style="width:26px;height:26px;border:2px solid ${PW.ink};border-radius:13px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex:0 0 auto">${index + 1}</span>
    <div style="flex:1">
      <div style="display:flex;gap:10px;align-items:baseline">
        <span style="font-size:14.5px;font-weight:600">${escapeHtml(line.name)}</span>
        <span class="pp-mono" style="font-size:13px;color:${PW.mid}">${line.quantity} ${escapeHtml(line.unit)}</span>
      </div>
      ${line.instruction ? `<div style="font-size:13px;color:${PW.mid};margin-top:2px">${escapeHtml(line.instruction)}</div>` : ''}
    </div>
  </li>`
}

export function buildRecipeHtml(
  recipeName: string,
  isVegetarian: boolean,
  lines: IngredientLine[],
  plannedQty: number | null
): string {
  const body = `
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:4px">
      <h2 style="font-size:22px;font-weight:700;margin:0">${escapeHtml(recipeName)}</h2>
      ${!isVegetarian ? `<span style="font-size:11px;font-weight:700;border:1.4px solid ${PW.ink};padding:3px 8px;margin-top:3px">NON VÉGÉTARIEN</span>` : ''}
    </div>
    <div style="font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-bottom:1.5px solid ${PW.ink};padding-bottom:5px;margin:16px 0 8px">Ingrédients dans l'ordre d'assemblage</div>
    <ol style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px">
      ${lines.map(ingredientRow).join('')}
    </ol>
    ${
      plannedQty !== null
        ? `<div style="margin-top:20px">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-bottom:1.5px solid ${PW.ink};padding-bottom:5px;margin-bottom:8px">Quantités pour ${plannedQty} portions</div>
      <table class="pp-table"><thead><tr><th>Ingrédient</th><th style="text-align:right">× 1 portion</th><th style="text-align:right">× ${plannedQty} portions</th></tr></thead>
      <tbody>${lines.map((l) => `<tr><td>${escapeHtml(l.name)}</td><td class="pp-mono" style="text-align:right">${l.quantity} ${escapeHtml(l.unit)}</td><td class="pp-mono" style="text-align:right;font-weight:600">${l.quantity * plannedQty} ${escapeHtml(l.unit)}</td></tr>`).join('')}</tbody></table>
    </div>`
        : ''
    }
  `
  return printPage('Fiche recette — assemblage', undefined, body)
}
