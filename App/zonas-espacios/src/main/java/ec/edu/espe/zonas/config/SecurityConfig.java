package ec.edu.espe.zonas.config;

import ec.edu.espe.zonas.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    private static final String[] READ_ROLES = {"SUPER_ADMIN", "ADMIN", "OPERADOR", "USUARIO", "SERVICE"};
    private static final String[] ADMIN_ROLES = {"SUPER_ADMIN", "ADMIN", "SERVICE"};
    private static final String[] STAFF_ROLES = {"SUPER_ADMIN", "ADMIN", "OPERADOR", "SERVICE"};

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // CORS solo en API Gateway (Kong) — evita Access-Control duplicados
        http
                .cors(cors -> cors.disable())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**")
                            .permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/zonas/**")
                            .hasAnyRole(READ_ROLES)
                        .requestMatchers(HttpMethod.POST, "/api/zonas/**")
                            .hasAnyRole(ADMIN_ROLES)
                        .requestMatchers(HttpMethod.PUT, "/api/zonas/**")
                            .hasAnyRole(ADMIN_ROLES)
                        .requestMatchers(HttpMethod.DELETE, "/api/zonas/**")
                            .hasAnyRole(ADMIN_ROLES)
                        .requestMatchers(HttpMethod.GET, "/api/espacios/**")
                            .hasAnyRole(READ_ROLES)
                        // Esta regla debe ir antes del PUT genérico. Cambiar el estado a
                        // MANTENIMIENTO es una acción administrativa, no de OPERADOR.
                        .requestMatchers(HttpMethod.PUT, "/api/espacios/*/estado")
                            .hasAnyRole(ADMIN_ROLES)
                        .requestMatchers(HttpMethod.POST, "/api/espacios/**")
                            .hasAnyRole(ADMIN_ROLES)
                        .requestMatchers(HttpMethod.PUT, "/api/espacios/**")
                            .hasAnyRole(ADMIN_ROLES)
                        .requestMatchers(HttpMethod.DELETE, "/api/espacios/**")
                            .hasAnyRole(ADMIN_ROLES)
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
