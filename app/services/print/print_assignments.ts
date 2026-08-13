import { callout, escapeHtml, printPage, sectionLabel, PW } from '#services/print/print_layout'

export interface AssignmentSlot {
  name: string | null
  locked: boolean
}

export interface AssignmentJob {
  jobName: string
  requiredCount: number
  slots: AssignmentSlot[]
}

export interface AssignmentPeriod {
  label: string
  jobs: AssignmentJob[]
}

function jobBlock(job: AssignmentJob): string {
  const filled = job.slots.filter((s) => s.name !== null).length
  const rows = job.slots
    .map(
      (slot) => `<tr>
      <td>${slot.name ? escapeHtml(slot.name) : `<span style="color:${PW.faint}">—</span>`}</td>
      <td>${slot.locked ? 'VERROU.' : ''}</td>
      <td><div style="border-bottom:1.2px solid ${PW.ink};height:18px"></div></td>
    </tr>`
    )
    .join('')

  return `<div style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
      <span style="font-size:13.5px;font-weight:600">${escapeHtml(job.jobName)}</span>
      <span class="pp-mono" style="font-size:11.5px;color:${PW.mid}">${filled}/${job.requiredCount} affectés</span>
    </div>
    <table class="pp-table"><thead><tr><th>Membre</th><th style="width:70px"></th><th style="width:220px">Signature</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`
}

export function buildAssignmentsHtml(eventName: string, periods: AssignmentPeriod[]): string {
  const body = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">
    ${periods
      .map(
        (p) => `<div>
      ${sectionLabel(p.label)}
      ${p.jobs.map(jobBlock).join('')}
    </div>`
      )
      .join('')}
  </div>
  ${callout("Les affectations marquées « VERROU. » ont été posées à la main par le coordo : l'algorithme ne les réécrit pas.")}`
  return printPage("Feuille d'affectation de soirée", eventName, body)
}
