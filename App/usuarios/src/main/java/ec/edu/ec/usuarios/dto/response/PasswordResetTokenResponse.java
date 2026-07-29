package ec.edu.ec.usuarios.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PasswordResetTokenResponse {
    private String message;
    /** Token de un solo uso (demo sin SMTP). En producción se enviaría por correo. */
    private String resetToken;
    private long expiresInSeconds;
}
