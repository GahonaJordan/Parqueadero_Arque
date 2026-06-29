package ec.edu.ec.usuarios.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RoleCreateRequest {

    @NotBlank(message = "El nombre del rol es requerido")
    @Size(max = 25, message = "El nombre del rol debe tener máximo 25 caracteres")
    private String name;

    @Size(max = 255, message = "La descripción debe tener máximo 255 caracteres")
    private String description;
}
