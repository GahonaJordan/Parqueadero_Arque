package ec.edu.ec.usuarios.controller;

import ec.edu.ec.usuarios.dto.request.LoginRequest;
import ec.edu.ec.usuarios.dto.response.LoginResponse;
import ec.edu.ec.usuarios.dto.response.UserAuthResponse;
import ec.edu.ec.usuarios.services.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/validate")
    public ResponseEntity<UserAuthResponse> validate(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.validateCredentials(request));
    }
}
