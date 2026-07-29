package ec.edu.espe.zonas.tenant;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Parqueadero SaaS desde header X-Tenant-Id (obligatorio).
 * OPERADOR solo puede operar en su tenant asignado (atributo de request).
 */
public final class TenantContext {

    public static final String HEADER = "X-Tenant-Id";
    public static final String ASSIGNED_TENANT_ATTR = "assignedTenantId";

    private TenantContext() {}

    /** @throws ResponseStatusException 400/403 si falta, es inválido o el rol no puede acceder */
    public static String current() {
        ServletRequestAttributes attrs =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Header X-Tenant-Id es obligatorio");
        }
        String raw = attrs.getRequest().getHeader(HEADER);
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Header X-Tenant-Id es obligatorio. Ejemplo: condado | cci | espe");
        }
        String slug = raw.trim().toLowerCase(Locale.ROOT);
        if (!slug.matches("^[a-z0-9][a-z0-9_-]*$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "X-Tenant-Id inválido: \"" + slug + "\"");
        }
        enforceOperadorTenant(slug, attrs);
        return slug;
    }

    private static void enforceOperadorTenant(String slug, ServletRequestAttributes attrs) {
        Set<String> roles = currentRoles();
        if (roles.isEmpty()) {
            return;
        }
        boolean privileged = roles.contains("SUPER_ADMIN")
                || roles.contains("ADMIN")
                || roles.contains("SERVICE");
        boolean operador = roles.contains("OPERADOR");
        if (operador && !privileged) {
            Object assigned = attrs.getAttribute(ASSIGNED_TENANT_ATTR, RequestAttributes.SCOPE_REQUEST);
            String assignedTenant = assigned != null ? assigned.toString() : null;
            if (assignedTenant == null || assignedTenant.isBlank()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "El operador no tiene un tenant asignado. Contacte a un administrador.");
            }
            if (!assignedTenant.equals(slug)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "El operador solo puede acceder al parqueadero \"" + assignedTenant + "\"");
            }
        }
    }

    private static Set<String> currentRoles() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return Set.of();
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring("ROLE_".length()))
                .collect(Collectors.toSet());
    }
}
