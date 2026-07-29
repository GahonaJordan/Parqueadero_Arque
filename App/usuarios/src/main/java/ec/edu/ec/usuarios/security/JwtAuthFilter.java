package ec.edu.ec.usuarios.security;

import ec.edu.ec.usuarios.entity.User;
import ec.edu.ec.usuarios.entity.UserRole;
import ec.edu.ec.usuarios.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Autenticación JWT.
 * Los roles de autorización se toman SIEMPRE de la base de datos (no del claim del token),
 * para impedir escalada de privilegios alterando el JWT.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Value("${auth.internal-api-key}")
    private String internalApiKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtService.isTokenValid(token)) {
                try {
                    UUID userId = jwtService.extractUserId(token);
                    String username = jwtService.extractUsername(token);

                    User user = userRepository.findByIdWithRoles(userId).orElse(null);
                    if (user != null && user.isActive()) {
                        List<SimpleGrantedAuthority> authorities = user.getUserRoles().stream()
                                .filter(UserRole::isActive)
                                .map(ur -> new SimpleGrantedAuthority("ROLE_" + ur.getRole().getName()))
                                .collect(Collectors.toList());

                        var auth = new UsernamePasswordAuthenticationToken(
                                new AuthenticatedUser(userId, username, user.getTenant() != null ? user.getTenant().getId() : null),
                                null,
                                authorities);
                        SecurityContextHolder.getContext().setAuthentication(auth);
                        filterChain.doFilter(request, response);
                        return;
                    }
                } catch (Exception ignored) {
                    // Token malformado: sin autenticación
                }
            }
        }

        String internalKey = request.getHeader("X-Internal-Key");
        if (internalKey != null && internalKey.equals(internalApiKey)) {
            var auth = new UsernamePasswordAuthenticationToken("internal-service", null,
                    List.of(new SimpleGrantedAuthority("ROLE_SERVICE")));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        filterChain.doFilter(request, response);
    }
}
