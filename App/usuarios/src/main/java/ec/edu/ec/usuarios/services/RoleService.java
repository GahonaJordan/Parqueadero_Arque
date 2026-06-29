package ec.edu.ec.usuarios.services;

import ec.edu.ec.usuarios.dto.request.RoleCreateRequest;
import ec.edu.ec.usuarios.dto.response.RoleResponse;

import java.util.List;
import java.util.UUID;

public interface RoleService {
    RoleResponse createRole(RoleCreateRequest roleRequest);
    List<RoleResponse> getAllRoles();
    RoleResponse getRoleById(UUID id);
    RoleResponse updateRole(UUID id, RoleCreateRequest roleRequest);
    void deleteRole(UUID id);
}
