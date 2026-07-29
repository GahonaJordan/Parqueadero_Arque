package ec.edu.espe.zonas.entidades;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
        name = "zonas",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_zona_tenant_nombre", columnNames = {"tenant_id", "nombre"}),
                @UniqueConstraint(name = "uk_zona_tenant_codigo", columnNames = {"tenant_id", "codigo"})
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Zona {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Parqueadero SaaS: condado | cci | espe (obligatorio vía X-Tenant-Id) */
    @Column(name = "tenant_id", nullable = false, length = 32)
    private String tenantId;

    @Column(nullable = false, length = 25)
    private String nombre;

    @Column(nullable = false, length = 25)
    private String codigo;//ZONA-VIP-01,

    @Column(nullable = false)
    private String descripcion;
    @Column(nullable = false)
    private int capacidad;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoZona tipo;

    @Column
    private boolean activo;

    @OneToMany(mappedBy = "zona",
            cascade = CascadeType.ALL,
            orphanRemoval = true)
    @Builder.Default
    private List<Espacio> espacios = new ArrayList<>();

    @Column
    private LocalDateTime fechaCreacion;

    @Column
    private LocalDateTime fechaActualizacion;

}
