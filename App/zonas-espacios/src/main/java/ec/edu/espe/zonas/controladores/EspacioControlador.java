package ec.edu.espe.zonas.controladores;

import ec.edu.espe.zonas.dto.request.EspacioRequestDto;
import ec.edu.espe.zonas.dto.request.EstadoEspacioRequestDto;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.servicios.interfaz.EspacioServicio;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/espacios")
@RequiredArgsConstructor
public class EspacioControlador {

    private final EspacioServicio espacioServicio;

    @GetMapping
    public ResponseEntity<List<EspacioResponseDto>> listarEspacios() {
        return ResponseEntity.ok(espacioServicio.obtenerEspacio());
    }

    @GetMapping("/{id}")
    public ResponseEntity<EspacioResponseDto> obtenerEspacio(@PathVariable UUID id) {
        return ResponseEntity.ok(espacioServicio.obtenerEspacio(id));
    }

    @PostMapping
    public ResponseEntity<EspacioResponseDto> crearEspacio(@Valid @RequestBody EspacioRequestDto dto) {
        return new ResponseEntity<>(espacioServicio.crearEspacio(dto), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<EspacioResponseDto> actualizarEspacio(@PathVariable UUID id,
                                                               @Valid @RequestBody EspacioRequestDto dto) {
        return ResponseEntity.ok(espacioServicio.actualizarEspacio(id, dto));
    }

    @PutMapping("/{id}/estado")
    public ResponseEntity<EspacioResponseDto> actualizarEstado(@PathVariable UUID id,
                                                               @Valid @RequestBody EstadoEspacioRequestDto dto) {
        return ResponseEntity.ok(espacioServicio.actualizarEstadoEspacio(id, dto.getEstado()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarEspacio(@PathVariable String id) {
        espacioServicio.eliminarEspacio(id);
        return ResponseEntity.noContent().build();
    }
}
