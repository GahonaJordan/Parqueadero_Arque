package ec.edu.ec.usuarios.services.impl;

import ec.edu.ec.usuarios.dto.request.UserCreateRequest;
import ec.edu.ec.usuarios.dto.request.UserUpdateRequest;
import ec.edu.ec.usuarios.dto.response.UserResponse;
import ec.edu.ec.usuarios.entity.*;
import ec.edu.ec.usuarios.repository.PersonRepository;
import ec.edu.ec.usuarios.repository.RoleRepository;
import ec.edu.ec.usuarios.repository.UserRepository;
import ec.edu.ec.usuarios.repository.UserRoleRepository;
import ec.edu.ec.usuarios.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ec.edu.ec.usuarios.dto.response.PersonResponse;
import ec.edu.ec.usuarios.enums.RoleType;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;


import java.time.LocalDateTime;
import java.util.Set;
import java.util.stream.Collectors;


import java.util.List;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;


    @Override
    public UserResponse createUser(UserCreateRequest userRequest, boolean isAdmin) {
        if(personRepository.existsByEmail(userRequest.getEmail())){
            throw new IllegalArgumentException("El email ya existe");
        }
        if(personRepository.existsByDni(userRequest.getDni())){
            throw new IllegalArgumentException("El DNI ya existe");
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

        return mapToUserResponse(user);
    }

    private List<UUID> resolveRoleIdsForCreation(List<UUID> requestedRoleIds, boolean isAdmin) {
        if (isAdmin) {
            return requestedRoleIds;
        }
        if (requestedRoleIds != null && !requestedRoleIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Solo un administrador puede asignar roles al crear usuarios");
        }
        Role usuarioRole = roleRepository.findByName(RoleType.USUARIO.name())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Rol USUARIO no configurado en el sistema"));
        return List.of(usuarioRole.getId());
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
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        return mapToUserResponse(user);
    }

    @Override
    public UserResponse assignRole(UUID userId, UUID roleId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado"));

        UserRoleId userRoleId = new UserRoleId(userId, roleId);
        if (userRoleRepository.existsById(userRoleId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El usuario ya tiene asignado este rol");
        }

        UserRole userRole = buildUserRole(user, role);
        userRoleRepository.save(userRole);

        return getUserById(userId);
    }

    @Override
    public UserResponse updateUser(UUID id, UserUpdateRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado con ID: " + id));
        Person person = user.getPerson();

        if (request.getEmail() != null && !request.getEmail().equals(person.getEmail())
                && personRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("El email ya existe");
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

        return mapToUserResponse(user);
    }

    @Override
    public void deleteUser(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado con ID: " + id));
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
            UserRole userRole = buildUserRole(user, role);
            userRoleRepository.save(userRole);
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
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .active(user.isActive())
                .lastLogin(user.getLastLogin())
                .person(personResponse)
                .roles(roles)
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
}
