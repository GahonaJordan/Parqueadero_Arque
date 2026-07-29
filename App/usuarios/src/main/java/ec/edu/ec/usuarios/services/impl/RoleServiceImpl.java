package ec.edu.ec.usuarios.services.impl;

import ec.edu.ec.usuarios.dto.request.RoleCreateRequest;
import ec.edu.ec.usuarios.dto.response.RoleResponse;
import ec.edu.ec.usuarios.audit.AuditEvent;
import ec.edu.ec.usuarios.audit.AuditEventPublisher;
import ec.edu.ec.usuarios.entity.Role;
import ec.edu.ec.usuarios.repository.RoleRepository;
import ec.edu.ec.usuarios.services.RoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Optional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class RoleServiceImpl implements RoleService {

    @Autowired
    private RoleRepository roleRepository;

    private final AuditEventPublisher auditEventPublisher;

    @Override
    public RoleResponse createRole(RoleCreateRequest roleRequest) {
        if (roleRepository.existsByName(roleRequest.getName())) {
            throw new IllegalArgumentException("El rol con el nombre '" + roleRequest.getName() + "' ya existe");
        }

        Role role = Role.builder()
                .name(roleRequest.getName())
                .description(safeOptionalValue(roleRequest.getDescription()))
                .build();

        role = roleRepository.save(role);
        RoleResponse response = mapToRoleResponse(role);
        emitAuditEvent("CREATE", "ROL", response.getId().toString(), response);
        return response;
    }

    @Override
    public List<RoleResponse> getAllRoles() {
        return roleRepository.findAll().stream()
                .map(this::mapToRoleResponse)
                .toList();
    }

    @Override
    public RoleResponse getRoleById(UUID id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Rol no encontrado"));
        return mapToRoleResponse(role);
    }

    @Override
    public RoleResponse updateRole(UUID id, RoleCreateRequest roleRequest) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Rol no encontrado"));

        if (!role.getName().equals(roleRequest.getName()) && roleRepository.existsByName(roleRequest.getName())) {
            throw new IllegalArgumentException("El rol con el nombre '" + roleRequest.getName() + "' ya existe");
        }

        role.setName(roleRequest.getName());
        role.setDescription(safeOptionalValue(roleRequest.getDescription()));
        role.setUpdatedAt(LocalDateTime.now());

        role = roleRepository.save(role);
        RoleResponse response = mapToRoleResponse(role);
        emitAuditEvent("UPDATE", "ROL", response.getId().toString(), response);
        return response;
    }

    @Override
    public void deleteRole(UUID id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Rol no encontrado"));

        if (!role.getUserRoles().isEmpty()) {
            throw new IllegalArgumentException("No se puede eliminar un rol que tiene usuarios asignados");
        }

        RoleResponse response = mapToRoleResponse(role);
        emitAuditEvent("DELETE", "ROL", response.getId().toString(), response);
        roleRepository.deleteById(id);
    }

    private RoleResponse mapToRoleResponse(Role role) {
        return RoleResponse.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .active(role.isActive())
                .createdAt(role.getCreatedAt())
                .updatedAt(role.getUpdatedAt())
                .build();
    }

    private String safeOptionalValue(String value) {
        return value == null ? "" : value;
    }

    private void emitAuditEvent(String accion, String entidad, String entidadId, Object datos) {
        AuditContext auditContext = buildAuditContext();
        auditEventPublisher.publish(new AuditEvent(
                "ms-usuarios",
                accion,
                entidad,
                entidadId,
                datos,
                auditContext.usuario(),
                auditContext.ip(),
                auditContext.mac()
        ));
    }

    private AuditContext buildAuditContext() {
        HttpServletRequest request = currentRequest();
        String usuario = Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .map(Authentication::getName)
                .filter(name -> !name.isBlank())
                .orElse("anonymous");
        String ip = resolveClientIp(request);
        String mac = resolveClientMac(request);
        return new AuditContext(usuario, ip, mac);
    }

    private HttpServletRequest currentRequest() {
        var attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletRequestAttributes) {
            return servletRequestAttributes.getRequest();
        }
        return null;
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }

        String forwardedFor = request.getHeader("x-forwarded-for");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        String remoteAddress = request.getRemoteAddr();
        return remoteAddress != null && !remoteAddress.isBlank() ? remoteAddress : "127.0.0.1";
    }

    private String resolveClientMac(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }

        String mac = request.getHeader("x-client-mac");
        return mac != null && !mac.isBlank() ? mac : "unknown";
    }

    private record AuditContext(String usuario, String ip, String mac) {}
}
