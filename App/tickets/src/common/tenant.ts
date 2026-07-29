/** Tenants SaaS del parqueadero (slug estable). */
export const TENANTS = ['condado', 'cci', 'espe'] as const;
export type TenantId = string;

/**
 * Exige X-Tenant-Id (o tenantId en body). Sin default.
 * Acepta los tenants conocidos y cualquier slug válido (nuevos tenants vía SUPER_ADMIN).
 * @throws Error si falta o es inválido
 */
export function requireTenantId(value?: string | string[] | null): TenantId {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw new Error(
      'Header X-Tenant-Id es obligatorio. Ejemplo: condado | cci | espe',
    );
  }
  const slug = String(raw).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
    throw new Error(
      `X-Tenant-Id inválido: "${slug}". Use minúsculas, números, guion o guion bajo`,
    );
  }
  return slug;
}

/**
 * OPERADOR (sin SUPER_ADMIN/ADMIN/SERVICE) solo puede usar su tenant asignado.
 * ADMIN está restringido a su tenant asignado para evitar invasión.
 * USUARIO puede operar en cualquier tenant seleccionado en el frontend.
 */
export function assertTenantAccess(
  tenantId: TenantId,
  roles: string[] | undefined | null,
  assignedTenantId?: string | null,
): void {
  if (!roles?.length) return;
  const privileged =
    roles.includes('SUPER_ADMIN') ||
    roles.includes('SERVICE');
  const isOperador = roles.includes('OPERADOR');
  const isAdmin = roles.includes('ADMIN');
  const isUsuario = roles.includes('USUARIO');
  
  // OPERADOR y ADMIN están restringidos a su tenant asignado
  // USUARIO puede operar en cualquier tenant seleccionado
  if ((isOperador || isAdmin) && !privileged) {
    if (!assignedTenantId) {
      throw new Error(
        `El usuario no tiene un tenant asignado. Contacte a un administrador.`,
      );
    }
    if (tenantId !== assignedTenantId) {
      throw new Error(
        `Solo puede acceder al parqueadero "${assignedTenantId}". Acceso denegado a "${tenantId}".`,
      );
    }
  }
}
