package ec.edu.espe.zonas.dto.request;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ZonaRequestDto {

    @NotNull(message = "El nombre de la zona es obligatorio")
    @NotBlank(message = "El nombre de la zona no puede estar vacío")
    @Size(max = 25, message = "El nombre de la zona no puede exceder los 25 caracteres")
    private String nombre;

    private String descripcion;

    @Digits(integer = 3, fraction = 0, message = "La capacidad debe ser un número entero")
    @Positive(message = "La capacidad debe ser un número positivo")
    @Max(value = 200, message = "La capacidad no puede exceder los 200")
    private Integer capacidad;

    @NotNull(message = "El tipo de zona es obligatorio")
    @NotBlank(message = "El tipo de zona no puede estar vacío")
    private String tipo;
}
