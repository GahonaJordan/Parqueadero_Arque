package ec.edu.espe.zonas.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ec.edu.espe.zonas.tenant.TenantContext;
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
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Roles y tenant asignado desde usuarios /api/auth/validate (BD).
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    @Value("${auth.internal-api-key}")
    private String internalApiKey;

    @Value("${auth.usuarios-validate-url:http://localhost:9090/api/auth/validate}")
    private String validateUrl;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // Preferir JWT de usuario sobre clave interna (evita bypass de roles desde el gateway)
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtService.isTokenValid(token)) {
                List<SimpleGrantedAuthority> authorities = resolveAuthFromDb(authHeader, request);
                if (!authorities.isEmpty()) {
                    var auth = new UsernamePasswordAuthenticationToken(
                            jwtService.extractUsername(token), null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    filterChain.doFilter(request, response);
                    return;
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

    private List<SimpleGrantedAuthority> resolveAuthFromDb(String authorizationHeader, HttpServletRequest request) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(validateUrl))
                    .timeout(Duration.ofSeconds(5))
                    .header("Authorization", authorizationHeader)
                    .GET()
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                return List.of();
            }
            JsonNode root = objectMapper.readTree(res.body());
            if (!root.path("valid").asBoolean(false) || !root.has("roles")) {
                return List.of();
            }
            List<SimpleGrantedAuthority> out = new ArrayList<>();
            for (JsonNode role : root.get("roles")) {
                String roleName = role.asText("").trim();
                if (roleName.isEmpty()) {
                    continue;
                }
                // usuarios devuelve ADMIN/SUPER_ADMIN, pero se normaliza también
                // ROLE_ADMIN para evitar crear por error ROLE_ROLE_ADMIN.
                String authority = roleName.startsWith("ROLE_") ? roleName : "ROLE_" + roleName;
                out.add(new SimpleGrantedAuthority(authority));
            }
            if (root.hasNonNull("tenantId")) {
                request.setAttribute(TenantContext.ASSIGNED_TENANT_ATTR, root.get("tenantId").asText());
            }
            return out;
        } catch (Exception ex) {
            return List.of();
        }
    }
}
