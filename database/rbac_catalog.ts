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

// Base copied into every role: a member holds a single role and nothing is
// inherited. `member:read` and `menu:read` are here because the home page of any
// ordinary member calls them — the guard is still useful, but it exists to make
// access explicit and revocable, not to restrict.
const BASE: readonly PermissionName[] = [
  'presence:read',
  'presence:write',
  'member:read',
  'menu:read',
]

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
  ROLES.map((role): [RoleName, PermissionName[]] => [
    role,
    [...new Set([...BASE, ...SPECIFIC[role]])],
  ])
) as Record<RoleName, PermissionName[]>
