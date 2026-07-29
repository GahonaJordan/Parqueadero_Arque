package ec.edu.ec.usuarios.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class LoginResponse {
    private String accessToken;
    private String tokenType;
    private long expiresIn;
    private UUID userId;
    private String username;
    private boolean active;
    private List<String> roles;
    private PersonResponse person;
    /** Slug del tenant asignado (solo aplica a OPERADOR; null en otros casos). */
    private String tenantId;
}
