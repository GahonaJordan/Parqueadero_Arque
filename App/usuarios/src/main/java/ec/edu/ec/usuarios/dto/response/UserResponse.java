package ec.edu.ec.usuarios.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class UserResponse {
    private UUID id;
    private String username;
    private Boolean active;
    private LocalDateTime lastLogin;
    private PersonResponse person;
    private List<String> roles;
}
