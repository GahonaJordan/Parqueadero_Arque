package ec.edu.ec.usuarios.security;

import ec.edu.ec.usuarios.enums.RoleType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class SecurityUtils {

    public boolean hasRole(String role) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        String authority = "ROLE_" + role;
        Collection<? extends GrantedAuthority> authorities = auth.getAuthorities();
        return authorities.stream().anyMatch(a -> a.getAuthority().equals(authority));
    }

    public boolean isSuperAdmin() {
        return hasRole(RoleType.SUPER_ADMIN.name());
    }

    /** ADMIN o SUPER_ADMIN (privilegios administrativos). */
    public boolean isAdmin() {
        return hasRole(RoleType.ADMIN.name()) || isSuperAdmin();
    }

    public boolean isService() {
        return hasRole("SERVICE");
    }

    public boolean isOperadorOnly() {
        return hasRole(RoleType.OPERADOR.name()) && !isAdmin() && !isService();
    }

    public Set<String> currentRoleNames() {
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

    /**
     * SUPER_ADMIN: cualquier rol.
     * ADMIN: OPERADOR y USUARIO (un operador/admin también puede ser cliente).
     */
    public boolean canAssignRole(String roleName) {
        if (isService() || isSuperAdmin()) {
            return RoleType.ADMIN.name().equals(roleName)
                    || RoleType.USUARIO.name().equals(roleName);
        }
        if (hasRole(RoleType.ADMIN.name())) {
            return RoleType.OPERADOR.name().equals(roleName);
        }
        return false;
    }

    /**
     * SUPER_ADMIN: cualquier rol.
     * ADMIN: OPERADOR y USUARIO.
     */
    public boolean canUnassignRole(String roleName) {
        if (isService() || isSuperAdmin()) {
            return !RoleType.SUPER_ADMIN.name().equals(roleName);
        }
        if (hasRole(RoleType.ADMIN.name())) {
            return RoleType.OPERADOR.name().equals(roleName) || RoleType.USUARIO.name().equals(roleName);
        }
        return false;
    }

    /**
     * SUPER_ADMIN y SERVICE pueden gestionar cualquier tenant.
     * ADMIN puede gestionar tenant (asignar su propio tenant a OPERADOR).
     * La restricción de que ADMIN solo asigne su propio tenant se valida en el servicio.
     */
    public boolean canManageTenant() {
        return isSuperAdmin() || isService();
    }

    public UUID getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthenticatedUser user) {
            return user.userId();
        }
        return null;
    }

    public UUID getCurrentUserTenantId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthenticatedUser user) {
            return user.tenantId();
        }
        return null;
    }
}
