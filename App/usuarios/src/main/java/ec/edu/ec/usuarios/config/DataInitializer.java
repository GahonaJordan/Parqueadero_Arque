package ec.edu.ec.usuarios.config;

import ec.edu.ec.usuarios.enums.RoleType;
import ec.edu.ec.usuarios.entity.Person;
import ec.edu.ec.usuarios.entity.Role;
import ec.edu.ec.usuarios.entity.Tenant;
import ec.edu.ec.usuarios.entity.User;
import ec.edu.ec.usuarios.entity.UserRole;
import ec.edu.ec.usuarios.entity.UserRoleId;
import ec.edu.ec.usuarios.repository.PersonRepository;
import ec.edu.ec.usuarios.repository.RoleRepository;
import ec.edu.ec.usuarios.repository.TenantRepository;
import ec.edu.ec.usuarios.repository.UserRepository;
import ec.edu.ec.usuarios.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final TenantRepository tenantRepository;
    private final PersonRepository personRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${bootstrap.super-admin.username:superadmin}")
    private String superAdminUsername;

    @Value("${bootstrap.super-admin.password:SuperAdmin123}")
    private String superAdminPassword;

    @Override
    @Transactional
    public void run(String... args) {
        createRoleIfMissing(RoleType.SUPER_ADMIN.name(), "Super Administrador del sistema");
        createRoleIfMissing(RoleType.ADMIN.name(), "Administrador del sistema");
        createRoleIfMissing(RoleType.OPERADOR.name(), "Operador de parqueadero");
        createRoleIfMissing(RoleType.USUARIO.name(), "Usuario regular");
        createTenantIfMissing("condado", "Parqueadero Condado", "Sede Condado Shopping");
        createTenantIfMissing("cci", "Parqueadero CCI", "Centro de Convenciones");
        createTenantIfMissing("espe", "Parqueadero ESPE", "Campus ESPE");
        createSuperAdminIfMissing();
    }

    private void createTenantIfMissing(String slug, String name, String description) {
        if (!tenantRepository.existsBySlugIgnoreCase(slug)) {
            tenantRepository.save(Tenant.builder()
                    .slug(slug)
                    .name(name)
                    .description(description)
                    .active(true)
                    .build());
        }
    }

    private void createRoleIfMissing(String name, String description) {
        if (!roleRepository.existsByName(name)) {
            roleRepository.save(Role.builder()
                    .name(name)
                    .description(description)
                    .active(true)
                    .build());
        }
    }

    private void createSuperAdminIfMissing() {
        Role superAdminRole = roleRepository.findByName(RoleType.SUPER_ADMIN.name())
                .orElseThrow(() -> new IllegalStateException("No se pudo inicializar el rol SUPER_ADMIN"));

        User existingUser = userRepository.findByUsername(superAdminUsername).orElse(null);
        if (existingUser != null) {
            assignRoleIfMissing(existingUser, superAdminRole);
            return;
        }

        Person person = personRepository.save(Person.builder()
                .dni("SUPERADMIN-001")
                .firtName("Super")
                .middleName("Admin")
                .lastName("Sistema")
                .email("superadmin@system.local")
                .phone("0000000000")
                .address("Cuenta interna del sistema")
                .nationality("Sistema")
                .build());

        User user = userRepository.save(User.builder()
                .person(person)
                .username(superAdminUsername)
                .passwordHash(passwordEncoder.encode(superAdminPassword))
                .active(true)
                .build());

        assignRoleIfMissing(user, superAdminRole);
    }

    private void assignRoleIfMissing(User user, Role superAdminRole) {
        if (userRoleRepository.existsByUser_IdAndRole_Id(user.getId(), superAdminRole.getId())) {
            return;
        }
        userRoleRepository.save(UserRole.builder()
                .id(new UserRoleId(user.getId(), superAdminRole.getId()))
                .user(user)
                .role(superAdminRole)
                .active(true)
                .build());
    }
}
