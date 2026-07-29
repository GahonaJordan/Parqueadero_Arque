package ec.edu.ec.usuarios.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TenantRequest {

    @NotBlank(message = "El slug del tenant es requerido")
    @Size(max = 50, message = "El slug debe tener máximo 50 caracteres")
    @Pattern(regexp = "^[a-z0-9][a-z0-9_-]*$", message = "Slug inválido: use minúsculas, números, guion o guion bajo")
    private String slug;

    @NotBlank(message = "El nombre del tenant es requerido")
    @Size(max = 100, message = "El nombre debe tener máximo 100 caracteres")
    private String name;

    @Size(max = 500, message = "La descripción debe tener máximo 500 caracteres")
    private String description;

    private Boolean active;
}
