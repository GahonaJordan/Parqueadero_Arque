package ec.edu.ec.usuarios.services.impl;

import ec.edu.ec.usuarios.dto.request.UserCreateRequest;
import ec.edu.ec.usuarios.dto.request.UserUpdateRequest;
import ec.edu.ec.usuarios.dto.response.UserResponse;
import ec.edu.ec.usuarios.audit.AuditEvent;
import ec.edu.ec.usuarios.audit.AuditEventPublisher;
import ec.edu.ec.usuarios.entity.*;
import ec.edu.ec.usuarios.repository.PersonRepository;
import ec.edu.ec.usuarios.repository.RoleRepository;
import ec.edu.ec.usuarios.repository.TenantRepository;
import ec.edu.ec.usuarios.repository.UserRepository;
import ec.edu.ec.usuarios.repository.UserRoleRepository;
import ec.edu.ec.usuarios.security.SecurityUtils;
import ec.edu.ec.usuarios.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;
import ec.edu.ec.usuarios.dto.response.PersonResponse;
import ec.edu.ec.usuarios.enums.RoleType;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;


import java.time.LocalDateTime;
import java.util.Set;
import java.util.stream.Collectors;


import java.util.List;
import java.util.UUID;
import java.util.Optional;

@Service
@Transactional
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    @Value("${bootstrap.super-admin.username:superadmin}")
    private String superAdminUsername;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private SecurityUtils securityUtils;

    private final AuditEventPublisher auditEventPublisher;


    @Override
    public UserResponse createUser(UserCreateRequest userRequest, boolean isAdmin) {
        if(personRepository.existsByEmail(userRequest.getEmail())){
            throw new IllegalArgumentException("El email ya existe");
        }
        if(personRepository.existsByDni(userRequest.getDni())){
            throw new IllegalArgumentException("El DNI ya existe");
        }
        if (personRepository.existsByPhone(userRequest.getPhone())) {
            throw new IllegalArgumentException("El teléfono ya existe");
        }

        List<UUID> roleIds = resolveRoleIdsForCreation(userRequest.getRoleIds(), isAdmin);

        Person person = Person.builder()
                .dni(userRequest.getDni())
                .firtName(userRequest.getFirstName())
                .middleName(userRequest.getMiddleName())
                .lastName(userRequest.getLastName())
                .email(userRequest.getEmail())
                .phone(userRequest.getPhone())
                .address(userRequest.getAddress())
                .nationality(userRequest.getNationality())
                .build();
        person = personRepository.save(person);

        //capturar el id de la persona
        //generar el username
        String username = ensureUniqueUsername(buildUsername(
            userRequest.getFirstName(),
            userRequest.getMiddleName(),
            userRequest.getLastName()));
        String rawPassword = userRequest.getPassword() != null && !userRequest.getPassword().isBlank()
                ? userRequest.getPassword()
                : userRequest.getDni();
        User user = User.builder()
            .person(person)
            .username(username)
            .passwordHash(passwordEncoder.encode(rawPassword))
            .build();
        user = userRepository.save(user);

        assignRolesToUser(user, roleIds);

        // Si el creador es ADMIN (no SUPER_ADMIN), y al nuevo usuario se le asigna OPERADOR,
        // se le asigna automáticamente el tenant del ADMIN
        if (hasRole(user, RoleType.OPERADOR)) {
            inheritCurrentAdminTenant(user, securityUtils.getCurrentUserId());
        }

        UserResponse response = mapToUserResponse(user);
        emitAuditEvent("CREATE", "USUARIO", response.getId().toString(), response);
        return response;
    }

    private List<UUID> resolveRoleIdsForCreation(List<UUID> requestedRoleIds, boolean isAdmin) {
        if (!isAdmin) {
            if (requestedRoleIds != null && !requestedRoleIds.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Solo un administrador puede asignar roles al crear usuarios");
            }
            Role usuarioRole = roleRepository.findByName(RoleType.USUARIO.name())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                            "Rol USUARIO no configurado en el sistema"));
            return List.of(usuarioRole.getId());
        }
        if (requestedRoleIds == null || requestedRoleIds.isEmpty()) {
            return requestedRoleIds;
        }
        for (UUID roleId : requestedRoleIds) {
            Role role = roleRepository.findById(roleId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado"));
            assertCanAssign(role.getName());
        }
        return requestedRoleIds;
    }

    private void assertCanAssign(String roleName) {
        if (!securityUtils.canAssignRole(roleName)) {
            String hint = securityUtils.isSuperAdmin()
                    ? "rol no permitido"
                    : "ADMIN solo puede asignar OPERADOR; SUPER_ADMIN puede asignar ADMIN o USUARIO";
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No puede asignar el rol " + roleName + ". " + hint);
        }
    }

    private Tenant loadActiveTenant(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant no encontrado"));
        if (!tenant.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El tenant seleccionado está inactivo");
        }
        return tenant;
    }

    private void assertCanUnassign(String roleName) {
        if (!securityUtils.canUnassignRole(roleName)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No puede quitar el rol " + roleName
                            + ". ADMIN solo puede quitar OPERADOR; SUPER_ADMIN puede quitar ADMIN o USUARIO.");
        }
    }

    private void inheritCurrentAdminTenant(User operator, UUID adminUserId) {
        if (adminUserId == null) {
            return;
        }
        User admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ADMIN no encontrado"));
        if (!hasRole(admin, RoleType.ADMIN)) {
            return;
        }
        UUID adminTenantId = admin.getTenant() != null ? admin.getTenant().getId() : null;
        if (adminTenantId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El ADMIN debe tener un tenant asignado antes de gestionar OPERADORES");
        }
        operator.setTenant(loadActiveTenant(adminTenantId));
        operator.setUpdatedAt(LocalDateTime.now());
        userRepository.save(operator);
    }

    private boolean hasRole(User user, RoleType roleType) {
        return user.getUserRoles().stream()
                .filter(UserRole::isActive)
                .anyMatch(userRole -> roleType.name().equals(userRole.getRole().getName()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        //stream
        return userRepository.findAll().stream()
                //.map(User user -> mapToUserResponse(user))
                .map(this::mapToUserResponse)
                .collect(Collectors.toList());

    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUserByDni(String dni) {
        Person person = personRepository.findByDni(dni)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado con DNI: " + dni));
        User user = userRepository.findById(person.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado con DNI: " + dni));
        return mapToUserResponse(user);
    }

    @Override
    public UserResponse getUserById(UUID id) {
        User user = userRepository.findByIdWithRoles(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        return mapToUserResponse(user);
    }

    @Override
    public UserResponse assignRole(UUID userId, UUID roleId, UUID adminUserId) {
        User user = userRepository.findByIdWithRoles(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado"));

        assertCanAssign(role.getName());

        UserRoleId userRoleId = new UserRoleId(userId, roleId);
        if (userRoleRepository.existsById(userRoleId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El usuario ya tiene asignado este rol");
        }

        UserRole userRole = userRoleRepository.save(buildUserRole(user, role));
        user.getUserRoles().add(userRole);

        if (RoleType.OPERADOR.name().equals(role.getName())) {
            inheritCurrentAdminTenant(user, adminUserId);
        }

        UserResponse response = getUserById(userId);
        emitAuditEvent("UPDATE", "USUARIO-ROL", userId.toString(), response);
        return response;
    }

    @Override
    public UserResponse replaceRole(UUID userId, UUID roleId) {
        User user = userRepository.findByIdWithRoles(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (superAdminUsername.equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No se pueden cambiar los roles del superadministrador");
        }

        Role newRole = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado"));
        assertCanAssign(newRole.getName());

        List<UserRole> currentRoles = user.getUserRoles().stream()
                .filter(UserRole::isActive)
                .toList();
        for (UserRole currentRole : currentRoles) {
            if (!currentRole.getRole().getId().equals(roleId)
                    && !securityUtils.canUnassignRole(currentRole.getRole().getName())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No puede reemplazar el rol " + currentRole.getRole().getName());
            }
        }

        List<UserRole> rolesToRemove = currentRoles.stream()
                .filter(currentRole -> !currentRole.getRole().getId().equals(roleId))
                .toList();
        userRoleRepository.deleteAll(rolesToRemove);
        user.getUserRoles().removeAll(rolesToRemove);

        boolean alreadyHasRole = currentRoles.stream()
                .anyMatch(currentRole -> currentRole.getRole().getId().equals(roleId));
        if (!alreadyHasRole) {
            UserRole newUserRole = userRoleRepository.save(buildUserRole(user, newRole));
            user.getUserRoles().add(newUserRole);
        }

        if (RoleType.OPERADOR.name().equals(newRole.getName())) {
            inheritCurrentAdminTenant(user, securityUtils.getCurrentUserId());
        } else if (!RoleType.ADMIN.name().equals(newRole.getName())) {
            user.setTenant(null);
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
        }

        UserResponse response = mapToUserResponse(user);
        emitAuditEvent("UPDATE", "USUARIO-ROL", userId.toString(), response);
        return response;
    }

    @Override
    public UserResponse assignTenant(UUID userId, UUID tenantId) {
        if (!securityUtils.canManageTenant()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No tiene permiso para asignar tenant");
        }

        User user = userRepository.findByIdWithRoles(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (superAdminUsername.equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No se puede asignar tenant al superadministrador");
        }

        Tenant tenant = loadActiveTenant(tenantId);

        // Si es ADMIN (no SUPER_ADMIN), solo puede asignar su propio tenant a un OPERADOR
        if (!hasRole(user, RoleType.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "El tenant solo se puede asignar a un usuario con rol ADMIN");
        }

        user.setTenant(tenant);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        UserResponse response = mapToUserResponse(user);
        emitAuditEvent("UPDATE", "USUARIO-TENANT", userId.toString(), response);
        return response;
    }

    @Override
    public UserResponse unassignTenant(UUID userId) {
        if (!securityUtils.canManageTenant()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No tiene permiso para quitar tenant");
        }

        User user = userRepository.findByIdWithRoles(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (superAdminUsername.equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No se puede quitar tenant al superadministrador");
        }

        // Si es ADMIN (no SUPER_ADMIN), solo puede quitar su propio tenant a un OPERADOR
        if (!hasRole(user, RoleType.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "El tenant solo se puede quitar a un usuario con rol ADMIN");
        }

        user.setTenant(null);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        UserResponse response = mapToUserResponse(user);
        emitAuditEvent("UPDATE", "USUARIO-TENANT", userId.toString(), response);
        return response;
    }

    @Override
    public UserResponse unassignRole(UUID userId, UUID roleId) {
        User user = userRepository.findByIdWithRoles(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (superAdminUsername.equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No se pueden quitar roles del superadministrador");
        }
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado"));

        assertCanUnassign(role.getName());

        UserRole userRole = user.getUserRoles().stream()
                .filter(currentRole -> currentRole.getRole().getId().equals(roleId))
                .findFirst()
                .orElse(null);
        if (userRole == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "El usuario no tiene ese rol");
        }
        userRoleRepository.delete(userRole);
        user.getUserRoles().remove(userRole);

        if (!hasRole(user, RoleType.ADMIN) && !hasRole(user, RoleType.OPERADOR)) {
            user.setTenant(null);
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
        }

        UserResponse response = mapToUserResponse(user);
        emitAuditEvent("DELETE", "USUARIO-ROL", userId.toString(), response);
        return response;
    }

    @Override
    public UserResponse updateUser(UUID id, UserUpdateRequest request) {
        User user = userRepository.findByIdWithRoles(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado con ID: " + id));
        Person person = user.getPerson();

        if (superAdminUsername.equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "El super usuario no puede editado");
        }

        if (request.getEmail() != null && !request.getEmail().equals(person.getEmail())
                && personRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("El email ya existe");
        }

        if (request.getPhone() != null && !request.getPhone().equals(person.getPhone())
                && personRepository.existsByPhone(request.getPhone())) {
            throw new IllegalArgumentException("El teléfono ya existe");
        }

        if (request.getFirstName() != null) {
            person.setFirtName(request.getFirstName());
        }
        if (request.getMiddleName() != null) {
            person.setMiddleName(request.getMiddleName());
        }
        if (request.getLastName() != null) {
            person.setLastName(request.getLastName());
        }
        if (request.getEmail() != null) {
            person.setEmail(request.getEmail());
        }
        if (request.getPhone() != null) {
            person.setPhone(request.getPhone());
        }
        if (request.getAddress() != null) {
            person.setAddress(request.getAddress());
        }
        if (request.getNationality() != null) {
            person.setNationality(request.getNationality());
        }
        if (request.getActive() != null) {
            person.setActive(request.getActive());
            user.setActive(request.getActive());
        }

        person.setUpdatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        personRepository.save(person);
        userRepository.save(user);

        UserResponse response = mapToUserResponse(user);
        emitAuditEvent("UPDATE", "USUARIO", response.getId().toString(), response);
        return response;
    }

    @Override
    public void deleteUser(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado con ID: " + id));
        if (superAdminUsername.equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "El super usuario no puede eliminarse");
        }
        UserResponse response = mapToUserResponse(user);
        emitAuditEvent("DELETE", "USUARIO", response.getId().toString(), response);
        userRoleRepository.deleteAll(user.getUserRoles());
        userRepository.delete(user);
        personRepository.delete(user.getPerson());
    }

    private void assignRolesToUser(User user, List<UUID> roleIds) {
        if (roleIds == null || roleIds.isEmpty()) {
            return;
        }

        List<UUID> distinctRoleIds = roleIds.stream().distinct().toList();
        List<Role> roles = roleRepository.findAllById(distinctRoleIds);

        if (roles.size() != distinctRoleIds.size()) {
            Set<UUID> foundRoleIds = roles.stream().map(Role::getId).collect(Collectors.toSet());
            UUID missingRoleId = distinctRoleIds.stream()
                    .filter(id -> !foundRoleIds.contains(id))
                    .findFirst()
                    .orElse(null);
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado: " + missingRoleId);
        }

        for (Role role : roles) {
            UserRoleId userRoleId = new UserRoleId(user.getId(), role.getId());
            if (userRoleRepository.existsById(userRoleId)) {
                continue;
            }
            UserRole userRole = userRoleRepository.save(buildUserRole(user, role));
            user.getUserRoles().add(userRole);
        }
    }

    private UserRole buildUserRole(User user, Role role) {
        return UserRole.builder()
                .id(new UserRoleId(user.getId(), role.getId()))
                .user(user)
                .role(role)
                .build();
    }

    private UserResponse mapToUserResponse(User user) {
        List<String> roles = user.getUserRoles().stream()
                .filter(UserRole::isActive)
                .map(ur -> ur.getRole().getName())
                .collect(Collectors.toList());
        Person person = user.getPerson();
        PersonResponse personResponse = PersonResponse.builder()
                .id(person.getId())
                .dni(person.getDni())
                .firstName(person.getFirtName())
                .middleName(person.getMiddleName())
                .lastName(person.getLastName())
                .email(person.getEmail())
                .build();
        Tenant tenant = user.getTenant();
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .active(user.isActive())
                .lastLogin(user.getLastLogin())
                .person(personResponse)
                .roles(roles)
                .tenantId(tenant != null ? tenant.getId() : null)
                .tenantSlug(tenant != null ? tenant.getSlug() : null)
                .tenantName(tenant != null ? tenant.getName() : null)
                .build();
    }

    private String buildUsername(String firstName, String middleName, String lastName) {
        String firstInitial = firstName == null || firstName.isBlank() ? "" : firstName.substring(0, 1);
        String middleInitial = middleName == null || middleName.isBlank() ? "" : middleName.substring(0, 1);
        String normalizedLastName = lastName == null ? "" : lastName;

        return (firstInitial + middleInitial + normalizedLastName)
                .toLowerCase()
                .replaceAll("\\s+", "");
    }

    private String ensureUniqueUsername(String baseUsername) {
        String username = baseUsername;
        int suffix = 1;

        while (userRepository.existsByUsername(username)) {
            username = baseUsername + suffix;
            suffix++;
        }

        return username;
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
