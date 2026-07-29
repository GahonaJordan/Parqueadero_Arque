package ec.edu.ec.usuarios.controller;

import ec.edu.ec.usuarios.dto.request.ForgotPasswordRequest;
import ec.edu.ec.usuarios.dto.request.LoginRequest;
import ec.edu.ec.usuarios.dto.request.ResetPasswordRequest;
import ec.edu.ec.usuarios.dto.response.LoginResponse;
import ec.edu.ec.usuarios.dto.response.MessageResponse;
import ec.edu.ec.usuarios.dto.response.PasswordResetTokenResponse;
import ec.edu.ec.usuarios.dto.response.TokenValidationResponse;
import ec.edu.ec.usuarios.dto.response.UserAuthResponse;
import ec.edu.ec.usuarios.services.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
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

    @GetMapping("/validate")
    public ResponseEntity<TokenValidationResponse> validate(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.ok(authService.validateToken(extractToken(authorization)));
    }

    @PostMapping("/validate")
    public ResponseEntity<UserAuthResponse> validate(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.validateCredentials(request));
    }

    /** Paso 1: verifica username + email + dni y emite token (público, cualquier rol). */
    @PostMapping("/forgot-password")
    public ResponseEntity<PasswordResetTokenResponse> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request));
    }

    /** Paso 2: cambia la contraseña con el token. */
    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }

    private String extractToken(String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        return null;
    }
}
