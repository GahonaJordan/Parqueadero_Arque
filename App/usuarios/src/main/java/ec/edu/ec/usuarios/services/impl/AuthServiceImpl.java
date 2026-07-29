package ec.edu.ec.usuarios.services.impl;

import ec.edu.ec.usuarios.dto.request.ForgotPasswordRequest;
import ec.edu.ec.usuarios.dto.request.LoginRequest;
import ec.edu.ec.usuarios.dto.request.ResetPasswordRequest;
import ec.edu.ec.usuarios.dto.response.LoginResponse;
import ec.edu.ec.usuarios.dto.response.MessageResponse;
import ec.edu.ec.usuarios.dto.response.PasswordResetTokenResponse;
import ec.edu.ec.usuarios.dto.response.PersonResponse;
import ec.edu.ec.usuarios.dto.response.TokenValidationResponse;
import ec.edu.ec.usuarios.dto.response.UserAuthResponse;
import ec.edu.ec.usuarios.entity.Person;
import ec.edu.ec.usuarios.entity.User;
import ec.edu.ec.usuarios.entity.UserRole;
import ec.edu.ec.usuarios.security.JwtService;
import ec.edu.ec.usuarios.repository.UserRepository;
import ec.edu.ec.usuarios.services.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthServiceImpl implements AuthService {

    private static final long RESET_TOKEN_TTL_SECONDS = 900; // 15 min

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    /** token -> userId + expiry (sin SMTP en demo) */
    private final Map<String, ResetTokenEntry> resetTokens = new ConcurrentHashMap<>();

    private record ResetTokenEntry(UUID userId, Instant expiresAt) {}

    @Override
    public LoginResponse login(LoginRequest request) {
        User user = authenticate(request);
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);
        User withRoles = userRepository.findByIdWithRoles(user.getId()).orElse(user);
        return buildLoginResponse(withRoles);
    }

    @Override
    @Transactional(readOnly = true)
    public UserAuthResponse validateCredentials(LoginRequest request) {
        User user = authenticate(request);
        User withRoles = userRepository.findByIdWithRoles(user.getId()).orElse(user);
        return buildUserAuthResponse(withRoles);
    }

    @Override
    @Transactional(readOnly = true)
    public TokenValidationResponse validateToken(String token) {
        if (token == null || !jwtService.isTokenValid(token)) {
            return TokenValidationResponse.builder().valid(false).build();
        }

        UUID userId;
        try {
            userId = jwtService.extractUserId(token);
        } catch (Exception ex) {
            return TokenValidationResponse.builder().valid(false).build();
        }

        User user = userRepository.findByIdWithRoles(userId).orElse(null);
        if (user == null || !user.isActive()) {
            return TokenValidationResponse.builder().valid(false).build();
        }

        return TokenValidationResponse.builder()
                .valid(true)
                .username(user.getUsername())
                .roles(extractRoles(user))
                .tenantId(extractTenantSlug(user))
                .dni(user.getPerson() != null ? user.getPerson().getDni() : null)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public PasswordResetTokenResponse forgotPassword(ForgotPasswordRequest request) {
        purgeExpiredTokens();

        User user = userRepository.findByUsernameWithRoles(request.getUsername().trim())
                .or(() -> userRepository.findByUsername(request.getUsername().trim()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Datos de recuperación no válidos"));

        Person person = user.getPerson();
        if (person == null
                || !request.getEmail().trim().equalsIgnoreCase(person.getEmail())
                || !request.getDni().trim().equals(person.getDni())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Datos de recuperación no válidos");
        }

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usuario inactivo");
        }

        String token = UUID.randomUUID().toString();
        resetTokens.put(token, new ResetTokenEntry(
                user.getId(),
                Instant.now().plusSeconds(RESET_TOKEN_TTL_SECONDS)));

        return PasswordResetTokenResponse.builder()
                .message("Identidad verificada. Usa el token para restablecer la contraseña.")
                .resetToken(token)
                .expiresInSeconds(RESET_TOKEN_TTL_SECONDS)
                .build();
    }

    @Override
    public MessageResponse resetPassword(ResetPasswordRequest request) {
        purgeExpiredTokens();

        ResetTokenEntry entry = resetTokens.remove(request.getResetToken().trim());
        if (entry == null || entry.expiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Token de recuperación inválido o expirado");
        }

        User user = userRepository.findById(entry.userId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Usuario no encontrado"));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        return MessageResponse.builder()
                .message("Contraseña actualizada. Ya puedes iniciar sesión.")
                .build();
    }

    private void purgeExpiredTokens() {
        Instant now = Instant.now();
        resetTokens.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(now));
    }

    private User authenticate(LoginRequest request) {
        User user = userRepository.findByUsernameWithRoles(request.getUsername())
                .or(() -> userRepository.findByUsername(request.getUsername()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Credenciales inválidas"));

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario inactivo");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
        }

        return user;
    }

    private LoginResponse buildLoginResponse(User user) {
        Person person = user.getPerson();
        PersonResponse personResponse = PersonResponse.builder()
                .id(person.getId())
                .dni(person.getDni())
                .firstName(person.getFirtName())
                .middleName(person.getMiddleName())
                .lastName(person.getLastName())
                .email(person.getEmail())
                .build();

        List<String> roles = extractRoles(user);
        String tenantSlug = extractTenantSlug(user);
        return LoginResponse.builder()
                .accessToken(jwtService.generateToken(
                        user.getId(),
                        user.getUsername(),
                        roles,
                        tenantSlug,
                        person != null ? person.getDni() : null))
                .tokenType("Bearer")
                .expiresIn(jwtService.getExpirationMs() / 1000)
                .userId(user.getId())
                .username(user.getUsername())
                .active(user.isActive())
                .roles(roles)
                .person(personResponse)
                .tenantId(tenantSlug)
                .build();
    }

    private UserAuthResponse buildUserAuthResponse(User user) {
        return UserAuthResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .passwordHash(user.getPasswordHash())
                .active(user.isActive())
                .roles(extractRoles(user))
                .build();
    }

    private List<String> extractRoles(User user) {
        return user.getUserRoles().stream()
                .filter(UserRole::isActive)
                .map(ur -> ur.getRole().getName())
                .collect(Collectors.toList());
    }

    private String extractTenantSlug(User user) {
        return user.getTenant() != null ? user.getTenant().getSlug() : null;
    }
}
