package ec.edu.espe.zonas.servicios.impl;

import ec.edu.espe.zonas.dto.request.EspacioRequestDto;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.servicios.interfaz.EspacioServicio;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ServiciosEspacio implements EspacioServicio {

    private final EspacioRepositorio espacioRepositorio;
    private final ZonaRepositorio zonaRepositorio;

    @Override
    @Transactional(readOnly = true)
    public List<EspacioResponseDto> obtenerEspacio() {
        return espacioRepositorio.findAll().stream()
                .map(this::toEspacioResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public EspacioResponseDto crearEspacio(EspacioRequestDto espacioRequestDto) {
        Zona zona = obtenerZonaPorId(espacioRequestDto.getIdzona());
        validarCapacidadZona(zona);

        Espacio espacio = Espacio.builder()
                .descripcion(espacioRequestDto.getDescripcion())
                .tipo(espacioRequestDto.getTipo())
                .zona(zona)
                .estado(EstadoEspacio.DISPONIBLE)
                .activo(true)
                .nombre(generarNombreEspacio(zona))
                .build();

        return toEspacioResponseDto(espacioRepositorio.save(espacio));
    }

    @Override
    @Transactional
    public EspacioResponseDto actualizarEspacio(UUID idEspacio, EspacioRequestDto esapcioRequestDto) {
        if (idEspacio == null) {
            throw new IllegalArgumentException("El id del espacio es obligatorio");
        }

        if (esapcioRequestDto == null) {
            throw new IllegalArgumentException("Los datos del espacio son obligatorios");
        }

        Espacio espacio = espacioRepositorio.findById(idEspacio)
                .orElseThrow(() -> new RuntimeException("No existe el espacio con id: " + idEspacio));

        Zona zonaAnterior = espacio.getZona();
        Zona zonaNueva = obtenerZonaPorId(esapcioRequestDto.getIdzona());

        if (!zonaAnterior.getId().equals(zonaNueva.getId())) {
            validarCapacidadZona(zonaNueva);
            espacio.setZona(zonaNueva);
            espacio.setNombre(generarNombreEspacio(zonaNueva));
        }

        espacio.setDescripcion(esapcioRequestDto.getDescripcion());
        espacio.setTipo(esapcioRequestDto.getTipo());

        return toEspacioResponseDto(espacioRepositorio.save(espacio));
    }

    @Override
    @Transactional
    public EspacioResponseDto actualizarEstadoEspacio(UUID idEspacio, EstadoEspacio nuevoEstado) {
        if (idEspacio == null) {
            throw new IllegalArgumentException("El id del espacio es obligatorio");
        }

        if (nuevoEstado == null) {
            throw new IllegalArgumentException("El nuevo estado es obligatorio");
        }

        Espacio espacio = espacioRepositorio.findById(idEspacio)
                .orElseThrow(() -> new RuntimeException("No existe el espacio con id: " + idEspacio));

        validarTransicionEstadoEspacio(espacio.getEstado(), nuevoEstado);

        espacio.setEstado(nuevoEstado);
        return toEspacioResponseDto(espacioRepositorio.save(espacio));
    }

    @Override
    public void eliminarEspacio(String id) {
        espacioRepositorio.deleteById(UUID.fromString(id));
    }

    @Override
    public EspacioResponseDto obtenerEspacio(UUID id) {
        return espacioRepositorio.findById(id)
                .map(this::toEspacioResponseDto)
                .orElseThrow(() -> new RuntimeException("No existe el espacio con id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<EspacioResponseDto> espaciosPorEstado(String estado) {
        EstadoEspacio estadoEspacio = EstadoEspacio.valueOf(estado.trim().toUpperCase());
        return espacioRepositorio.findByEstado(estadoEspacio).stream()
                .map(this::toEspacioResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<EspacioResponseDto> obtenerEspaciosPorZonaEstado(UUID idZona, String estado) {
        EstadoEspacio estadoEspacio = EstadoEspacio.valueOf(estado.trim().toUpperCase());
        return espacioRepositorio.findByZonaIdAndEstado(idZona, estadoEspacio).stream()
                .map(this::toEspacioResponseDto)
                .collect(Collectors.toList());
    }

    private Zona obtenerZonaPorId(UUID idZona) {
        if (idZona == null) {
            throw new IllegalArgumentException("El id de la zona es obligatorio");
        }

        return zonaRepositorio.findById(idZona)
                .orElseThrow(() -> new RuntimeException("No existe la zona con id: " + idZona));
    }

    private String generarNombreEspacio(Zona zona) {
        long consecutivo = espacioRepositorio.countByZonaId(zona.getId()) + 1;
        return String.format("%s-%03d", zona.getCodigo(), consecutivo);
    }

    private void validarCapacidadZona(Zona zona) {
        long espaciosRegistrados = espacioRepositorio.countByZonaId(zona.getId());
        if (espaciosRegistrados >= zona.getCapacidad()) {
            throw new RuntimeException("La zona " + zona.getNombre() + " ya alcanzó su capacidad máxima de " + zona.getCapacidad() + " espacios");
        }
    }

    private void validarTransicionEstadoEspacio(EstadoEspacio estadoActual, EstadoEspacio nuevoEstado) {
        if (estadoActual == nuevoEstado) {
            return;
        }

        boolean transicionValida = switch (estadoActual) {
            case OCUPADO -> nuevoEstado == EstadoEspacio.DISPONIBLE;
            case DISPONIBLE -> nuevoEstado == EstadoEspacio.OCUPADO || nuevoEstado == EstadoEspacio.RESERVADO;
            case RESERVADO -> nuevoEstado == EstadoEspacio.DISPONIBLE || nuevoEstado == EstadoEspacio.OCUPADO;
        };

        if (!transicionValida) {
            throw new RuntimeException("No se puede cambiar el estado de " + estadoActual + " a " + nuevoEstado);
        }
    }

    private EspacioResponseDto toEspacioResponseDto(Espacio espacio) {
        if (espacio == null) {
            return null;
        }

        return EspacioResponseDto.builder()
                .id(espacio.getId())
                .nombre(espacio.getNombre())
                .descripcion(espacio.getDescripcion())
                .tipo(espacio.getTipo())
                .activo(espacio.isActivo())
                .nombrezona(espacio.getZona() != null ? espacio.getZona().getNombre() : null)
                .idzona(espacio.getZona() != null ? espacio.getZona().getId() : null)
                .estado(espacio.getEstado())
                .fechaCreacion(espacio.getFechaCreacion())
                .fechaActualizacion(espacio.getFechaActualizacion())
                .build();
    }
}
