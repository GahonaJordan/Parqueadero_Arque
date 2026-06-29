package ec.edu.espe.zonas.servicios.impl;

import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.entidades.TipoZona;
import ec.edu.espe.zonas.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.servicios.interfaz.ServicioZona;
import ec.edu.espe.zonas.utils.MapperUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ServiciosZona implements ServicioZona{

    private final MapperUtils mapper;
    private final ZonaRepositorio zonaRepositorio;

    @Override
    @Transactional(readOnly = true)
    public List<ZonaResponseDto> listarZonas() {
        return zonaRepositorio.findAll().stream()
                .map(this::toZonaResponseDtoConEspaciosDisponibles)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ZonaResponseDto crear(ZonaRequestDto zonaRequestDto) {
        if(zonaRepositorio.existsByNombre(zonaRequestDto.getNombre())){
            throw new RuntimeException("Ya existe una zona con el nombre: " + zonaRequestDto.getNombre());
        }

        Zona zona = mapper.toZonaEntity(zonaRequestDto);
        zona.setCodigo(generarCodigoZona(zona.getTipo()));

        return toZonaResponseDtoConEspaciosDisponibles(zonaRepositorio.save(zona));
    }

    @Override
    public ZonaResponseDto actualizarZona(UUID idZona, ZonaRequestDto zonaRequestDto) {

        if(!zonaRepositorio.existsById(idZona)){
            throw new RuntimeException("No existe la zona con id: " + idZona);
        }

        if(zonaRequestDto == null) return null;

        Zona zonaExistente = zonaRepositorio.findById(idZona)
                .orElseThrow(() -> new RuntimeException("No existe la zona con id: " + idZona));

        Zona datosActualizados = mapper.toZonaEntity(zonaRequestDto);
        zonaExistente.setNombre(datosActualizados.getNombre());
        zonaExistente.setDescripcion(datosActualizados.getDescripcion());
        zonaExistente.setCapacidad(datosActualizados.getCapacidad());
        zonaExistente.setTipo(datosActualizados.getTipo());

        if (zonaExistente.getCodigo() == null || zonaExistente.getCodigo().isBlank()) {
            zonaExistente.setCodigo(generarCodigoZona(zonaExistente.getTipo()));
        }

        return toZonaResponseDtoConEspaciosDisponibles(zonaRepositorio.save(zonaExistente));
    }

    @Override
    @Transactional
    public void eliminarZona(UUID id) {
        if (id == null) {
            throw new IllegalArgumentException("El id de la zona es obligatorio");
        }

        Zona zona = zonaRepositorio.findById(id)
                .orElseThrow(() -> new RuntimeException("No existe la zona con id: " + id));

        validarEspaciosDisponiblesParaEliminar(zona);

        // Opción segura (no estrictamente necesaria si tienes CascadeType.ALL):
        // zona.getEspacios().clear();

        zonaRepositorio.delete(zona);
    }

    private ZonaResponseDto toZonaResponseDtoConEspaciosDisponibles(Zona zona) {
        ZonaResponseDto dto = mapper.toZonaResponseDto(zona);
        dto.setEspaciosDisponibles(contarEspaciosDisponibles(zona));
        return dto;
    }

    private int contarEspaciosDisponibles(Zona zona) {
        if (zona == null || zona.getEspacios() == null) {
            return 0;
        }

        return (int) zona.getEspacios().stream()
                .filter(espacio -> espacio.getEstado() == EstadoEspacio.DISPONIBLE)
                .count();
    }

    private String generarCodigoZona(TipoZona tipoZona) {
        String prefijo = String.format("ZONA-%s-", tipoZona.name().substring(0, 3));
        Pattern patron = Pattern.compile("^" + Pattern.quote(prefijo) + "(\\d{3})$");

        long consecutivo = zonaRepositorio.findByTipo(tipoZona).stream()
                .map(Zona::getCodigo)
                .filter(codigo -> codigo != null && codigo.startsWith(prefijo))
            .map(patron::matcher)
            .filter(Matcher::matches)
            .mapToInt(matcher -> Integer.parseInt(matcher.group(1)))
                .max()
                .orElse(0) + 1;

        return String.format("%s%03d", prefijo, consecutivo);
    }

    private void validarEspaciosDisponiblesParaEliminar(Zona zona) {
        boolean tieneEspaciosNoDisponibles = zona.getEspacios() != null && zona.getEspacios().stream()
                .anyMatch(espacio -> espacio.getEstado() != EstadoEspacio.DISPONIBLE);

        if (tieneEspaciosNoDisponibles) {
            throw new RuntimeException("No se puede eliminar la zona porque tiene espacios ocupados o no disponibles");
        }
    }

}
