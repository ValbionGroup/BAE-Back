import { escapeHtml, printPage, sectionLabel, PW } from '#services/print/print_layout'
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

export interface BuildRecipeHtmlArgs {
  productName: string
  isVegetarian: boolean
  description: string | null
  recipe: string | null
  lines: IngredientLine[]
  /** Quantité prévue au menu de la soirée passée en `?eventId=` ; sinon la
   *  variante multipliée retombe sur ×50/×100, comme la maquette. */
  plannedQty: number | null
}

export function buildRecipeHtml(args: BuildRecipeHtmlArgs): string {
  const { productName, isVegetarian, description, recipe, lines, plannedQty } = args
  const scales = plannedQty !== null ? [plannedQty] : [50, 100]

  const body = `
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:4px">
      <h2 style="font-size:22px;font-weight:700;margin:0">${escapeHtml(productName)}</h2>
      ${!isVegetarian ? `<span style="font-size:11px;font-weight:700;border:1.4px solid ${PW.ink};padding:3px 8px;margin-top:3px">NON VÉGÉTARIEN</span>` : ''}
    </div>
    ${description ? `<div style="font-size:13px;color:${PW.mid};line-height:1.5;margin-top:4px">${escapeHtml(description)}</div>` : ''}

    ${sectionLabel("Ingrédients dans l'ordre d'assemblage")}
    <ol style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px">
      ${lines.map(ingredientRow).join('')}
    </ol>

    ${
      recipe
        ? `${sectionLabel('Méthode de confection')}
    <div style="font-size:13px;line-height:1.6;white-space:pre-line">${escapeHtml(recipe)}</div>`
        : ''
    }

    <div style="margin-top:20px">
      ${sectionLabel(
        plannedQty !== null
          ? `Quantités pour ${plannedQty} portions`
          : 'Variante multipliée — quantités recalculées'
      )}
      <table class="pp-table"><thead><tr><th>Ingrédient</th><th style="text-align:right">× 1 portion</th>${scales.map((s) => `<th style="text-align:right">× ${s} portions</th>`).join('')}</tr></thead>
      <tbody>${lines
        .map(
          (l) =>
            `<tr><td>${escapeHtml(l.name)}</td><td class="pp-mono" style="text-align:right">${l.quantity} ${escapeHtml(l.unit)}</td>${scales.map((s) => `<td class="pp-mono" style="text-align:right;font-weight:600">${l.quantity * s} ${escapeHtml(l.unit)}</td>`).join('')}</tr>`
        )
        .join('')}</tbody></table>
    </div>
  `
  return printPage('Fiche recette — assemblage', undefined, body)
}
