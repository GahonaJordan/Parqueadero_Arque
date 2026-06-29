package ec.edu.espe.zonas.dto.request;

import ec.edu.espe.zonas.entidades.EstadoEspacio;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EstadoEspacioRequestDto {

    @NotNull(message = "El estado del espacio es obligatorio")
    private EstadoEspacio estado;
}