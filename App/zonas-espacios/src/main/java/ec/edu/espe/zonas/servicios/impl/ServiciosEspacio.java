package ec.edu.espe.zonas.servicios.impl;

import ec.edu.espe.zonas.dto.request.EspacioRequestDto;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.audit.AuditEvent;
import ec.edu.espe.zonas.audit.AuditEventPublisher;
import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.servicios.interfaz.EspacioServicio;
import ec.edu.espe.zonas.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ServiciosEspacio implements EspacioServicio {

    private final EspacioRepositorio espacioRepositorio;
    private final ZonaRepositorio zonaRepositorio;
    private final AuditEventPublisher auditEventPublisher;

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "espaciosByTenant", key = "T(ec.edu.espe.zonas.tenant.TenantContext).current()")
    public List<EspacioResponseDto> obtenerEspacio() {
        String tenantId = TenantContext.current();
        return espacioRepositorio.findAll().stream()
                .filter(e -> e.getZona() != null && tenantId.equals(e.getZona().getTenantId()))
                .map(this::toEspacioResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = {"espaciosByTenant", "espacioById", "zonasByTenant"}, allEntries = true)
    public EspacioResponseDto crearEspacio(EspacioRequestDto espacioRequestDto) {
        Zona zona = obtenerZonaPorId(espacioRequestDto.getIdzona());
        String tenantId = TenantContext.current();
        if (zona.getTenantId() != null && !tenantId.equals(zona.getTenantId())) {
            throw new RuntimeException("La zona no pertenece al parqueadero " + tenantId);
        }
        validarCapacidadZona(zona);

        Espacio espacio = Espacio.builder()
                .descripcion(espacioRequestDto.getDescripcion())
                .tipo(espacioRequestDto.getTipo())
                .zona(zona)
                .estado(EstadoEspacio.DISPONIBLE)
                .activo(true)
                .nombre(generarNombreEspacio(zona))
                .build();

        EspacioResponseDto response = toEspacioResponseDto(espacioRepositorio.save(espacio));
        emitAuditEvent("CREATE", "ESPACIO", response.getId().toString(), response);
        return response;
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = {"espaciosByTenant", "espacioById", "zonasByTenant"}, allEntries = true)
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

        EspacioResponseDto response = toEspacioResponseDto(espacioRepositorio.save(espacio));
        emitAuditEvent("UPDATE", "ESPACIO", response.getId().toString(), response);
        return response;
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = {"espaciosByTenant", "espacioById", "zonasByTenant"}, allEntries = true)
    public EspacioResponseDto actualizarEstadoEspacio(UUID idEspacio, EstadoEspacio nuevoEstado) {
        if (idEspacio == null) {
            throw new IllegalArgumentException("El id del espacio es obligatorio");
        }

        if (nuevoEstado == null) {
            throw new IllegalArgumentException("El nuevo estado es obligatorio");
        }

        // Validar que solo SUPER_ADMIN y ADMIN puedan poner en MANTENIMIENTO
        if (EstadoEspacio.MANTENIMIENTO.equals(nuevoEstado)) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getAuthorities() != null) {
                boolean hasRequiredRole = auth.getAuthorities().stream()
                        // hasRole("ADMIN") se representa internamente como ROLE_ADMIN.
                        .anyMatch(authority -> authority.getAuthority().equals("ROLE_SUPER_ADMIN")
                                || authority.getAuthority().equals("ROLE_ADMIN"));
                if (!hasRequiredRole) {
                    throw new RuntimeException("Solo SUPER_ADMIN y ADMIN pueden poner espacios en MANTENIMIENTO");
                }
            } else {
                throw new RuntimeException("Solo SUPER_ADMIN y ADMIN pueden poner espacios en MANTENIMIENTO");
            }
        }

        Espacio espacio = espacioRepositorio.findById(idEspacio)
                .orElseThrow(() -> new RuntimeException("No existe el espacio con id: " + idEspacio));

        validarTransicionEstadoEspacio(espacio.getEstado(), nuevoEstado);

        espacio.setEstado(nuevoEstado);
        EspacioResponseDto response = toEspacioResponseDto(espacioRepositorio.save(espacio));
        emitAuditEvent("UPDATE", "ESPACIO", response.getId().toString(), response);
        return response;
    }

    @Override
    @CacheEvict(cacheNames = {"espaciosByTenant", "espacioById", "zonasByTenant"}, allEntries = true)
    public void eliminarEspacio(String id) {
        UUID espacioId = UUID.fromString(id);
        Espacio espacio = espacioRepositorio.findById(espacioId)
            .orElseThrow(() -> new RuntimeException("No existe el espacio con id: " + id));
        EspacioResponseDto response = toEspacioResponseDto(espacio);
        emitAuditEvent("DELETE", "ESPACIO", response.getId().toString(), response);
        espacioRepositorio.deleteById(espacioId);
    }

    @Override
    @Cacheable(cacheNames = "espacioById", key = "#id")
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
            case DISPONIBLE -> nuevoEstado == EstadoEspacio.OCUPADO
                    || nuevoEstado == EstadoEspacio.RESERVADO
                    || nuevoEstado == EstadoEspacio.MANTENIMIENTO;
            case RESERVADO -> nuevoEstado == EstadoEspacio.DISPONIBLE || nuevoEstado == EstadoEspacio.OCUPADO;
            case MANTENIMIENTO -> nuevoEstado == EstadoEspacio.DISPONIBLE;
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
                .tenantId(espacio.getZona() != null ? espacio.getZona().getTenantId() : null)
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

    private void emitAuditEvent(String accion, String entidad, String entidadId, Object datos) {
        AuditContext auditContext = buildAuditContext();
        auditEventPublisher.publish(new AuditEvent(
                "ms-zonasespacios",
                accion,
                entidad,
                entidadId,
                datos,
                auditContext.usuario(),
                auditContext.ip(),
                auditContext.mac()
        ));
    }

    private AuditContext buildAuditContext() {
        HttpServletRequest request = currentRequest();
        String usuario = Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .map(Authentication::getName)
                .filter(name -> !name.isBlank())
                .orElse("anonymous");
        String ip = resolveClientIp(request);
        String mac = resolveClientMac(request);
        return new AuditContext(usuario, ip, mac);
    }

    private HttpServletRequest currentRequest() {
        var attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletRequestAttributes) {
            return servletRequestAttributes.getRequest();
        }
        return null;
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }

        String forwardedFor = request.getHeader("x-forwarded-for");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        String remoteAddress = request.getRemoteAddr();
        return remoteAddress != null && !remoteAddress.isBlank() ? remoteAddress : "127.0.0.1";
    }

    private String resolveClientMac(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }

        String mac = request.getHeader("x-client-mac");
        return mac != null && !mac.isBlank() ? mac : "unknown";
    }

    private record AuditContext(String usuario, String ip, String mac) {}
}
