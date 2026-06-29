package ec.edu.espe.zonas.controladores;

import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.servicios.interfaz.ServicioZona;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/zonas")
@RequiredArgsConstructor
public class ZonaControlador {

    private final ServicioZona servicioZona;

    @GetMapping
    public ResponseEntity<List<ZonaResponseDto>> listarZonas(){
        return ResponseEntity.ok(servicioZona.listarZonas());
    }

    @PostMapping
    public ResponseEntity<ZonaResponseDto> crearZona(@Valid @RequestBody ZonaRequestDto dto){
        return new ResponseEntity<>(servicioZona.crear(dto), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ZonaResponseDto> actualizarZona(@PathVariable UUID id, @Valid @RequestBody ZonaRequestDto dto){
        return ResponseEntity.ok(servicioZona.actualizarZona(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarZona(@PathVariable UUID id){
        servicioZona.eliminarZona(id);
        return ResponseEntity.noContent().build();
    }
}
