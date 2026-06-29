package ec.edu.ec.usuarios.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class UserAuthResponse {
    private UUID userId;
    private String username;
    private String passwordHash;
    private boolean active;
    private List<String> roles;
}
