package ec.edu.ec.usuarios.controller;

import ec.edu.ec.usuarios.dto.request.RoleCreateRequest;
import ec.edu.ec.usuarios.dto.response.RoleResponse;
import ec.edu.ec.usuarios.services.RoleService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/roles")
public class RoleController {

    @Autowired
    private RoleService roleService;

    @GetMapping
    public ResponseEntity<List<RoleResponse>> getAllRoles() {
        return ResponseEntity.ok(roleService.getAllRoles());
    }

    @PostMapping("/")
    public ResponseEntity<RoleResponse> createRole(@Valid @RequestBody RoleCreateRequest roleRequest) {
        RoleResponse roleResponse = roleService.createRole(roleRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(roleResponse);
    }

    @GetMapping("/{id}")
    public ResponseEntity<RoleResponse> getRoleById(@PathVariable UUID id) {
        return ResponseEntity.ok(roleService.getRoleById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RoleResponse> updateRole(@PathVariable UUID id,
                                                   @Valid @RequestBody RoleCreateRequest roleRequest) {
        return ResponseEntity.ok(roleService.updateRole(id, roleRequest));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRole(@PathVariable UUID id) {
        roleService.deleteRole(id);
        return ResponseEntity.noContent().build();
    }
}