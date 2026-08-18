import vine from '@vinejs/vine'

// Delta, donc `optional()` partout : un PATCH ne portant que `phone` ne doit pas
// effacer la note. `nullable()` en plus sur les champs effaçables — `null`
// veut dire « vider », `undefined` « ne pas toucher ».
//
// ⚠️ Ni `promotion` ni `school` : ils dérivent des claims `diplome` et `ecole`,
// et le prochain login SSO écraserait toute saisie faite ici. Les accepter
// donnerait au bureau un champ qui se vide tout seul, sans erreur ni trace.
export const updateClientValidator = vine.create({
  phone: vine.string().trim().maxLength(32).nullable().optional(),
  note: vine.string().trim().maxLength(2000).nullable().optional(),
})
