package ec.edu.espe.zonas.utils;

import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.entidades.TipoZona;
import ec.edu.espe.zonas.entidades.Zona;
import org.springframework.stereotype.Component;

@Component
public class MapperUtils {

    public ZonaResponseDto toZonaResponseDto(Zona objZona){

        if(objZona == null) return null;

        return ZonaResponseDto.builder()
                .id(objZona.getId())
                .nombre(objZona.getNombre())
                .codigo(objZona.getCodigo())
                .descripcion(objZona.getDescripcion())
                .capacidad(objZona.getCapacidad())
                .tipo(objZona.getTipo())
                .activo(objZona.isActivo())
                .fechaCreacion(objZona.getFechaCreacion())
                .fechaActualizacion(objZona.getFechaActualizacion())
                .build();

    }

    public Zona toZonaEntity(ZonaRequestDto dto){
        if(dto == null) return null;

        return Zona.builder()
                .nombre(dto.getNombre())
                .descripcion(dto.getDescripcion())
                .capacidad(dto.getCapacidad())
                .tipo(TipoZona.valueOf(dto.getTipo().trim().toUpperCase()))
                .build();
    }
}
