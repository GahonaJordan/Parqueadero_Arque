package ec.edu.espe.zonas.servicios.impl;

import ec.edu.espe.zonas.audit.AuditEventPublisher;
import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.TipoEspacio;
import ec.edu.espe.zonas.entidades.TipoZona;
import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.utils.MapperUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServiciosZonaTest {

    @Mock
    private ZonaRepositorio zonaRepositorio;

    @Mock
    private EspacioRepositorio espacioRepositorio;

    @Mock
    private AuditEventPublisher auditEventPublisher;

        private ServiciosZona serviciosZona;

        @BeforeEach
        void setUp() {
                serviciosZona = new ServiciosZona(new MapperUtils(), zonaRepositorio, espacioRepositorio, auditEventPublisher);
        }

    @Test
    void actualizarZonaInactivaMueveEspaciosAMantenimiento() {
        UUID zonaId = UUID.randomUUID();
        Zona zonaExistente = Zona.builder()
                .id(zonaId)
                .nombre("Zona A")
                .codigo("ZONA-VIP-001")
                .descripcion("Zona principal")
                .capacidad(10)
                .tipo(TipoZona.VIP)
                .activo(true)
                .build();

        Espacio espacioUno = Espacio.builder()
                .id(UUID.randomUUID())
                .nombre("ZONA-VIP-001-001")
                .descripcion("Espacio 1")
                .tipo(TipoEspacio.AUTO)
                .activo(true)
                .zona(zonaExistente)
                .estado(EstadoEspacio.DISPONIBLE)
                .build();

        Espacio espacioDos = Espacio.builder()
                .id(UUID.randomUUID())
                .nombre("ZONA-VIP-001-002")
                .descripcion("Espacio 2")
                .tipo(TipoEspacio.MOTO)
                .activo(true)
                .zona(zonaExistente)
                .estado(EstadoEspacio.OCUPADO)
                .build();

        ZonaRequestDto request = ZonaRequestDto.builder()
                .nombre("Zona A actualizada")
                .descripcion("Zona principal actualizada")
                .capacidad(10)
                .tipo("VIP")
                .activo(false)
                .build();

        when(zonaRepositorio.existsById(zonaId)).thenReturn(true);
        when(zonaRepositorio.findById(zonaId)).thenReturn(java.util.Optional.of(zonaExistente));
        when(zonaRepositorio.save(any(Zona.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(espacioRepositorio.findByZonaId(zonaId)).thenReturn(List.of(espacioUno, espacioDos));

        ZonaResponseDto response = serviciosZona.actualizarZona(zonaId, request);

        assertEquals(zonaId, response.getId());
        assertFalse(zonaExistente.isActivo());
        assertEquals(EstadoEspacio.MANTENIMIENTO, espacioUno.getEstado());
        assertEquals(EstadoEspacio.MANTENIMIENTO, espacioDos.getEstado());
        verify(espacioRepositorio).saveAll(any());
    }
}
