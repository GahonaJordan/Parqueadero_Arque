package ec.edu.espe.zonas.servicios.interfaz;

import ec.edu.espe.zonas.dto.request.EspacioRequestDto;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;

import java.util.List;
import java.util.UUID;

public interface EspacioServicio {

    List<EspacioResponseDto> obtenerEspacio();

    EspacioResponseDto crearEspacio(EspacioRequestDto espacioRequestDto);

    EspacioResponseDto actualizarEspacio(UUID idEspacio, EspacioRequestDto esapcioRequestDto);

    EspacioResponseDto actualizarEstadoEspacio(UUID idEspacio, EstadoEspacio nuevoEstado);

    void eliminarEspacio(String id);

    EspacioResponseDto obtenerEspacio(UUID id);

    List<EspacioResponseDto> espaciosPorEstado(String estado);

    List<EspacioResponseDto> obtenerEspaciosPorZonaEstado(UUID idZona, String estado);
}
