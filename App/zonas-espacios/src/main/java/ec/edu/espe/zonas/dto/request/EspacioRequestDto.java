package ec.edu.espe.zonas.dto.request;

import ec.edu.espe.zonas.entidades.TipoEspacio;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EspacioRequestDto {

    private String descripcion;

    @NotNull(message = "El tipo del espacio es obligatorio")
    private TipoEspacio tipo;

    @NotNull(message = "El ID de la zona no puede ser nulo")
    private UUID idzona;
}
