package ec.edu.ec.usuarios.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_role")
@Setter
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(onlyExplicitlyIncluded = true)
public class UserRole {

    @EmbeddedId
    @EqualsAndHashCode.Include
    @ToString.Include
    private UserRoleId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @ToString.Exclude
    @MapsId("idUser")
    @JoinColumn(name = "id_user")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @ToString.Exclude
    @MapsId("idRole")
    @JoinColumn(name = "id_role")
    private Role role;

    @Builder.Default
    private boolean active = true;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate(){
        assignedAt = LocalDateTime.now();
    }

}
