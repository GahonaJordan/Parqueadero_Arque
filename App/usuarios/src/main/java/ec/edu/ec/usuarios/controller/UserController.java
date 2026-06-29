package ec.edu.ec.usuarios.controller;

import ec.edu.ec.usuarios.dto.request.UserCreateRequest;
import ec.edu.ec.usuarios.dto.request.UserUpdateRequest;
import ec.edu.ec.usuarios.dto.response.UserResponse;
import ec.edu.ec.usuarios.security.SecurityUtils;
import ec.edu.ec.usuarios.services.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private SecurityUtils securityUtils;

    @GetMapping
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/personas/{dni}")
    public ResponseEntity<UserResponse> getUserByDni(@PathVariable("dni") String dni) {
        return ResponseEntity.ok(userService.getUserByDni(dni));
    }

    @PostMapping("/")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserCreateRequest userRequest) {
        if (securityUtils.hasRole("OPERADOR") && !securityUtils.isAdmin() && !securityUtils.isService()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Los operadores no pueden crear usuarios");
        }
        UserResponse userResponse = userService.createUser(userRequest, securityUtils.isAdmin());
        return ResponseEntity.status(HttpStatus.CREATED).body(userResponse);
    }

    @PutMapping("/{userId}")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable UUID userId,
            @Valid @RequestBody UserUpdateRequest request) {
        if (securityUtils.hasRole("USUARIO") && !securityUtils.isAdmin() && !securityUtils.isService()) {
            UUID currentUserId = securityUtils.getCurrentUserId();
            if (currentUserId == null || !currentUserId.equals(userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Solo puede actualizar su propia información personal");
            }
            if (request.getActive() != null) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No tiene permiso para cambiar el estado de la cuenta");
            }
        }
        return ResponseEntity.ok(userService.updateUser(userId, request));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID userId) {
        userService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{userId}/roles/{roleId}")
    public ResponseEntity<UserResponse> assignRoleToUser(@PathVariable UUID userId, @PathVariable UUID roleId) {
        UserResponse userResponse = userService.assignRole(userId, roleId);
        return ResponseEntity.ok(userResponse);
    }
}
