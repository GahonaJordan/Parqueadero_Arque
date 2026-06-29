package ec.edu.espe.zonas.servicios.interfaz;

import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;

import java.util.List;
import java.util.UUID;

public interface ServicioZona {

    List<ZonaResponseDto> listarZonas();

    ZonaResponseDto crear(ZonaRequestDto zonaRequestDto);

    ZonaResponseDto actualizarZona(UUID idZona, ZonaRequestDto zonaRequestDto);

    void eliminarZona(UUID id);


}
