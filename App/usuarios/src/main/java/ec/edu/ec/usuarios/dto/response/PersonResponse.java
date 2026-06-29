package ec.edu.ec.usuarios.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class PersonResponse {
    private UUID id;
    private String dni;
    private String firstName;
    private String middleName;
    private String lastName;
    private String email;

}
