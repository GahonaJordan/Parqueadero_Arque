package ec.edu.espe.zonas.dto.response;

import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.TipoEspacio;
import ec.edu.espe.zonas.entidades.Zona;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EspacioResponseDto {

    private UUID id;
    private String nombre;//ZON-VIP-01-001
    private String descripcion;
    private TipoEspacio tipo;
    private boolean activo;
    private String nombrezona;
    private UUID idzona;
    private EstadoEspacio estado;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaActualizacion;
}
