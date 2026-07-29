package ec.edu.ec.usuarios.config;

import ec.edu.ec.usuarios.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    private static final String[] ADMIN_ROLES = {"SUPER_ADMIN", "ADMIN", "SERVICE"};
    private static final String[] STAFF_ROLES = {"SUPER_ADMIN", "ADMIN", "OPERADOR", "SERVICE"};
    private static final String[] ALL_USER_ROLES = {"SUPER_ADMIN", "ADMIN", "OPERADOR", "USUARIO", "SERVICE"};

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/validate").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/validate").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/forgot-password").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/reset-password").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/users").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users/personas/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/users/*/roles/**")
                            .hasAnyRole(ADMIN_ROLES)
                        .requestMatchers(HttpMethod.PUT, "/api/users/*/role/*")
                            .hasAnyRole(ADMIN_ROLES)
                        .requestMatchers(HttpMethod.DELETE, "/api/users/*/roles/**")
                            .hasAnyRole(ADMIN_ROLES)
                        .requestMatchers(HttpMethod.PUT, "/api/users/*/tenant/**")
                            .hasAnyRole("SUPER_ADMIN", "SERVICE")
                        .requestMatchers(HttpMethod.DELETE, "/api/users/*/tenant")
                            .hasAnyRole("SUPER_ADMIN", "SERVICE")
                        .requestMatchers(HttpMethod.GET, "/api/users/personas/**")
                            .hasAnyRole(ALL_USER_ROLES)
                        .requestMatchers(HttpMethod.GET, "/api/users")
                            .hasAnyRole(STAFF_ROLES)
                        .requestMatchers(HttpMethod.PUT, "/api/users/**")
                            .hasAnyRole(ALL_USER_ROLES)
                        .requestMatchers(HttpMethod.DELETE, "/api/users/**")
                            .hasAnyRole(ADMIN_ROLES)
                        .requestMatchers("/api/roles/**").hasAnyRole(ADMIN_ROLES)
                        .requestMatchers(HttpMethod.GET, "/api/tenants/**").hasAnyRole(ADMIN_ROLES)
                        .requestMatchers(HttpMethod.POST, "/api/tenants/**").hasRole("SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/tenants/**").hasRole("SUPER_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/tenants/**").hasRole("SUPER_ADMIN")
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
