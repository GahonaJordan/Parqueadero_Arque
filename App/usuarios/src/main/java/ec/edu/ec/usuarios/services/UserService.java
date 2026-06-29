package ec.edu.ec.usuarios.services;


import ec.edu.ec.usuarios.dto.request.UserCreateRequest;
import ec.edu.ec.usuarios.dto.request.UserUpdateRequest;
import ec.edu.ec.usuarios.dto.response.UserResponse;

import java.util.List;
import java.util.UUID;

public interface UserService {
    UserResponse createUser(UserCreateRequest userRequest, boolean isAdmin);
    List<UserResponse> getAllUsers();
    UserResponse getUserById(UUID id);
    UserResponse getUserByDni(String dni);
    UserResponse assignRole(UUID userId, UUID roleId);
    UserResponse updateUser(UUID id, UserUpdateRequest request);
    void deleteUser(UUID id);

}
