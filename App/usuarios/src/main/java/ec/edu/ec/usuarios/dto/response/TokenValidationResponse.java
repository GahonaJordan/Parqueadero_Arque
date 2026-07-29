package ec.edu.ec.usuarios.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class TokenValidationResponse {
    private boolean valid;
    private String username;
    private List<String> roles;
    /** Slug del tenant asignado al usuario (null si no aplica). */
    private String tenantId;
    private String dni;
}