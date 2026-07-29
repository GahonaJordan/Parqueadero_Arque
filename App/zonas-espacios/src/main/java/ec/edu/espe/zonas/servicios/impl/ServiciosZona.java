package ec.edu.espe.zonas.servicios.impl;

import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.audit.AuditEvent;
import ec.edu.espe.zonas.audit.AuditEventPublisher;
import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.entidades.TipoZona;
import ec.edu.espe.zonas.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.servicios.interfaz.ServicioZona;
import ec.edu.espe.zonas.tenant.TenantContext;
import ec.edu.espe.zonas.utils.MapperUtils;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ServiciosZona implements ServicioZona{

    private final MapperUtils mapper;
    private final ZonaRepositorio zonaRepositorio;
    private final EspacioRepositorio espacioRepositorio;
    private final AuditEventPublisher auditEventPublisher;

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "zonasByTenant", key = "T(ec.edu.espe.zonas.tenant.TenantContext).current()")
    public List<ZonaResponseDto> listarZonas() {
        String tenantId = TenantContext.current();
        return zonaRepositorio.findByTenantId(tenantId).stream()
                .map(this::toZonaResponseDtoConEspaciosDisponibles)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = {"zonasByTenant", "espacioById"}, allEntries = true)
    public ZonaResponseDto crear(ZonaRequestDto zonaRequestDto) {
        String tenantId = TenantContext.current();
        if (zonaRequestDto.getTenantId() == null || zonaRequestDto.getTenantId().isBlank()) {
            zonaRequestDto.setTenantId(tenantId);
        } else {
            tenantId = zonaRequestDto.getTenantId().trim().toLowerCase();
            zonaRequestDto.setTenantId(tenantId);
        }

        if (zonaRepositorio.existsByTenantIdAndNombre(tenantId, zonaRequestDto.getNombre())) {
            throw new RuntimeException("Ya existe una zona con el nombre: " + zonaRequestDto.getNombre()
                    + " en el parqueadero " + tenantId);
        }

        Zona zona = mapper.toZonaEntity(zonaRequestDto);
        zona.setTenantId(tenantId);
        zona.setActivo(zonaRequestDto.getActivo() == null || zonaRequestDto.getActivo());
        zona.setCodigo(generarCodigoZona(zona.getTipo(), tenantId));

        ZonaResponseDto response = toZonaResponseDtoConEspaciosDisponibles(zonaRepositorio.save(zona));
        emitAuditEvent("CREATE", "ZONA", response.getId().toString(), response);
        return response;
    }

    @Override
    @CacheEvict(cacheNames = {"zonasByTenant", "espacioById", "espaciosByTenant"}, allEntries = true)
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

        if (zonaRequestDto.getActivo() != null) {
            zonaExistente.setActivo(zonaRequestDto.getActivo());
        }

        if (zonaExistente.getCodigo() == null || zonaExistente.getCodigo().isBlank()) {
            zonaExistente.setCodigo(generarCodigoZona(zonaExistente.getTipo(), zonaExistente.getTenantId()));
        }

        Zona zonaGuardada = zonaRepositorio.save(zonaExistente);

        if (!zonaGuardada.isActivo()) {
            actualizarEspaciosDeZonaAMantenimiento(zonaGuardada);
        }

        ZonaResponseDto response = toZonaResponseDtoConEspaciosDisponibles(zonaGuardada);
        emitAuditEvent("UPDATE", "ZONA", response.getId().toString(), response);
        return response;
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = {"zonasByTenant", "espacioById", "espaciosByTenant"}, allEntries = true)
    public void eliminarZona(UUID id) {
        if (id == null) {
            throw new IllegalArgumentException("El id de la zona es obligatorio");
        }

        Zona zona = zonaRepositorio.findById(id)
                .orElseThrow(() -> new RuntimeException("No existe la zona con id: " + id));

        validarEspaciosDisponiblesParaEliminar(zona);

        // Opción segura (no estrictamente necesaria si tienes CascadeType.ALL):
        // zona.getEspacios().clear();

        ZonaResponseDto response = toZonaResponseDtoConEspaciosDisponibles(zona);
        emitAuditEvent("DELETE", "ZONA", response.getId().toString(), response);
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

    private String generarCodigoZona(TipoZona tipoZona, String tenantId) {
        String prefijo = String.format("ZONA-%s-", tipoZona.name().substring(0, 3));
        Pattern patron = Pattern.compile("^" + Pattern.quote(prefijo) + "(\\d{3})$");

        long consecutivo = zonaRepositorio.findByTenantIdAndTipo(tenantId, tipoZona).stream()
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

    private void actualizarEspaciosDeZonaAMantenimiento(Zona zona) {
        List<Espacio> espacios = espacioRepositorio.findByZonaId(zona.getId());
        if (espacios.isEmpty()) {
            return;
        }

        espacios.forEach(espacio -> espacio.setEstado(EstadoEspacio.MANTENIMIENTO));
        espacioRepositorio.saveAll(espacios);
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
