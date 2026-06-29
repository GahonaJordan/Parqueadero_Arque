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

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/zonas/**")
                            .hasAnyRole("ADMIN", "OPERADOR", "USUARIO", "SERVICE")
                        .requestMatchers(HttpMethod.POST, "/api/zonas/**")
                            .hasAnyRole("ADMIN", "SERVICE")
                        .requestMatchers(HttpMethod.PUT, "/api/zonas/**")
                            .hasAnyRole("ADMIN", "SERVICE")
                        .requestMatchers(HttpMethod.DELETE, "/api/zonas/**")
                            .hasAnyRole("ADMIN", "SERVICE")
                        .requestMatchers(HttpMethod.GET, "/api/espacios/**")
                            .hasAnyRole("ADMIN", "OPERADOR", "USUARIO", "SERVICE")
                        .requestMatchers(HttpMethod.POST, "/api/espacios/**")
                            .hasAnyRole("ADMIN", "OPERADOR", "SERVICE")
                        .requestMatchers(HttpMethod.PUT, "/api/espacios/**")
                            .hasAnyRole("ADMIN", "OPERADOR", "SERVICE")
                        .requestMatchers(HttpMethod.DELETE, "/api/espacios/**")
                            .hasAnyRole("ADMIN", "SERVICE")
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
