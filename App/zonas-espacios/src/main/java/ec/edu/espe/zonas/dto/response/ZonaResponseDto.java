package ec.edu.espe.zonas.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.TipoZona;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ZonaResponseDto {

    private UUID id;
    private String nombre;
    private String codigo;//ZONA-VIP-01,
    private String descripcion;
    private int capacidad;
    private TipoZona tipo;
    private boolean activo;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaActualizacion;
    private int espaciosDisponibles;
}
