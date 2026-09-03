import vine from '@vinejs/vine'

// Delta, donc `optional()` : un PATCH sans `note` ne doit pas l'effacer.
// `nullable()` en plus — `null` veut dire « vider », `undefined` « ne pas toucher ».
//
// ⚠️ Ni `promotion` ni `school` : ils dérivent des claims `diplome` et `ecole`,
// et le prochain login SSO écraserait toute saisie faite ici. Les accepter
// donnerait au bureau un champ qui se vide tout seul, sans erreur ni trace.
export const updateClientValidator = vine.create({
  note: vine.string().trim().maxLength(2000).nullable().optional(),
})
