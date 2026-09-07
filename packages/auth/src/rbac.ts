type Role = 'CUSTOMER' | 'ADMIN';

/**
 * Permission definitions for RBAC.
 */
const PERMISSIONS: Record<string, Role[]> = {
  // Product management
  'product:create': ['ADMIN'],
  'product:update': ['ADMIN'],
  'product:delete': ['ADMIN'],
  'product:read':   ['CUSTOMER', 'ADMIN'],

  // Inventory management
  'inventory:update': ['ADMIN'],
  'inventory:read':   ['CUSTOMER', 'ADMIN'],

  // Checkout
  'checkout:reserve': ['CUSTOMER', 'ADMIN'],
  'checkout:pay':     ['CUSTOMER', 'ADMIN'],

  // Orders
  'order:read:own':   ['CUSTOMER', 'ADMIN'],
  'order:read:all':   ['ADMIN'],
  'order:update':     ['ADMIN'],

  // Admin dashboard
  'admin:dashboard':  ['ADMIN'],
  'admin:users':      ['ADMIN'],
  'admin:analytics':  ['ADMIN'],

  // Audit
  'audit:read':       ['ADMIN'],
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: Role, permission: string): boolean {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    return false;
  }
  return allowedRoles.includes(role);
}

/**
 * Check if a role is an admin.
 */
export function isAdmin(role: Role): boolean {
  return role === 'ADMIN';
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: Role): string[] {
  return Object.entries(PERMISSIONS)
    .filter(([, roles]) => roles.includes(role))
    .map(([permission]) => permission);
}

export { Role, PERMISSIONS };
