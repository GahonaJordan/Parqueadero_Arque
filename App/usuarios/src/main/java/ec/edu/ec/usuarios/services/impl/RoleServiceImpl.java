package ec.edu.ec.usuarios.services.impl;

import ec.edu.ec.usuarios.dto.request.RoleCreateRequest;
import ec.edu.ec.usuarios.dto.response.RoleResponse;
import ec.edu.ec.usuarios.entity.Role;
import ec.edu.ec.usuarios.repository.RoleRepository;
import ec.edu.ec.usuarios.services.RoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        return mapToRoleResponse(role);
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
        return mapToRoleResponse(role);
    }

    @Override
    public void deleteRole(UUID id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Rol no encontrado"));

        if (!role.getUserRoles().isEmpty()) {
            throw new IllegalArgumentException("No se puede eliminar un rol que tiene usuarios asignados");
        }

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
}
