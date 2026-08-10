/**
 * Source unique des rôles, des permissions et de leur association.
 *
 * Les trois seeders RBAC lisent ici plutôt que de porter chacun leur liste :
 * un rôle ou une permission mal orthographié échoue alors au typecheck, là où
 * des listes indépendantes divergent en silence et n'accordent plus rien.
 */

export const PERMISSIONS = [
  'presence:write',
  'presence:read',
  'stock:read',
  'stock:update',
  'stock:create',
  'stock:delete',
  'product:read',
  'product:update',
  'product:create',
  'product:delete',
  'supplier:read',
  'supplier:update',
  'supplier:create',
  'supplier:delete',
  'restock:read',
  'restock:update',
  'restock:create',
  'restock:delete',
  'log:read',
  'event:matching',
  'event:settle',
  'assignment:write',
  'member:read',
  'member:write',
  'role:read',
  'role:write',
  'voucher:read',
  'voucher:write',
  'menu:read',
  'menu:write',
] as const

export type PermissionName = (typeof PERMISSIONS)[number]

export const ROLES = [
  'President',
  'Administrateur',
  'Tresorier',
  'Coordinateur',
  'Secretaire',
  'Pole Log',
  'Pole BBQ',
  'Membre',
] as const

export type RoleName = (typeof ROLES)[number]

/**
 * Socle commun. Un membre ne porte qu'un rôle et rien n'est hérité : la base
 * doit donc être recopiée dans chaque entrée, sinon une permission commune
 * ajoutée ici n'atteindrait aucun rôle.
 *
 * `member:read` y figure parce que `GET /v1/members` n'est pas une route
 * d'administration : `CoordinationService.loadAll()` et `MemberAssignmentsStore`
 * l'appellent, donc la restreindre coupe l'accueil de tout membre ordinaire.
 *
 * `menu:read` y figure pour la même raison : le membre qui vient cuisiner doit
 * voir le menu du soir (exigence « page d'accueil », P3 du cahier des charges).
 * La garde reste utile — elle rend l'accès explicite et révocable — mais elle
 * n'est pas là pour restreindre.
 */
const BASE: readonly PermissionName[] = [
  'presence:read',
  'presence:write',
  'member:read',
  'menu:read',
]

/** Permissions propres à chaque rôle, hors socle. */
const SPECIFIC: Record<RoleName, readonly PermissionName[]> = {
  'President': PERMISSIONS,
  'Administrateur': PERMISSIONS,
  'Tresorier': [
    'supplier:read',
    'supplier:update',
    'supplier:create',
    'supplier:delete',
    'restock:read',
    'restock:update',
    'product:read',
    'stock:read',
    'log:read',
    'voucher:read',
    'voucher:write',
  ],
  'Coordinateur': [
    'event:matching',
    'event:settle',
    'assignment:write',
    'stock:read',
    'menu:write',
  ],
  'Secretaire': ['log:read', 'role:read'],
  'Pole Log': [
    'stock:read',
    'stock:update',
    'stock:create',
    'stock:delete',
    'product:read',
    'product:update',
    'product:create',
    'product:delete',
    'restock:read',
    'restock:update',
    'restock:create',
    'restock:delete',
    'supplier:read',
    'voucher:read',
    'voucher:write',
    'menu:write',
  ],
  'Pole BBQ': ['stock:read', 'stock:update', 'product:read', 'restock:read', 'restock:create'],
  'Membre': [],
}

export const ROLE_PERMISSIONS = Object.fromEntries(
  // L'annotation de retour est nécessaire : sans elle le littéral est inféré comme
  // un tableau et non comme un tuple, que `Object.fromEntries` refuse.
  ROLES.map((role): [RoleName, PermissionName[]] => [
    role,
    [...new Set([...BASE, ...SPECIFIC[role]])],
  ])
) as Record<RoleName, PermissionName[]>
