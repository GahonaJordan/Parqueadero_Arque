package ec.edu.ec.usuarios.services.impl;

import ec.edu.ec.usuarios.dto.request.TenantRequest;
import ec.edu.ec.usuarios.dto.response.TenantResponse;
import ec.edu.ec.usuarios.entity.Tenant;
import ec.edu.ec.usuarios.repository.TenantRepository;
import ec.edu.ec.usuarios.repository.UserRepository;
import ec.edu.ec.usuarios.services.TenantService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class TenantServiceImpl implements TenantService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    @Override
    public TenantResponse createTenant(TenantRequest request) {
        String slug = normalizeSlug(request.getSlug());
        if (tenantRepository.existsBySlugIgnoreCase(slug)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya existe un tenant con el slug '" + slug + "'");
        }
        Tenant tenant = Tenant.builder()
                .slug(slug)
                .name(request.getName().trim())
                .description(safe(request.getDescription()))
                .active(request.getActive() == null || request.getActive())
                .build();
        return map(tenantRepository.save(tenant));
    }

    @Override
    @Transactional(readOnly = true)
    public List<TenantResponse> getAllTenants() {
        return tenantRepository.findAll().stream().map(this::map).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TenantResponse> getActiveTenants() {
        return tenantRepository.findAll().stream()
                .filter(Tenant::isActive)
                .map(this::map)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public TenantResponse getTenantById(UUID id) {
        return map(findOrThrow(id));
    }

    @Override
    public TenantResponse updateTenant(UUID id, TenantRequest request) {
        Tenant tenant = findOrThrow(id);
        String slug = normalizeSlug(request.getSlug());
        if (!tenant.getSlug().equalsIgnoreCase(slug) && tenantRepository.existsBySlugIgnoreCase(slug)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya existe un tenant con el slug '" + slug + "'");
        }
        tenant.setSlug(slug);
        tenant.setName(request.getName().trim());
        tenant.setDescription(safe(request.getDescription()));
        if (request.getActive() != null) {
            tenant.setActive(request.getActive());
        }
        tenant.setUpdatedAt(LocalDateTime.now());
        return map(tenantRepository.save(tenant));
    }

    @Override
    public void deleteTenant(UUID id) {
        Tenant tenant = findOrThrow(id);
        if (userRepository.existsByTenant_Id(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No se puede eliminar un tenant con usuarios asociados");
        }
        tenantRepository.delete(tenant);
    }

    private Tenant findOrThrow(UUID id) {
        return tenantRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant no encontrado"));
    }

    private TenantResponse map(Tenant tenant) {
        return TenantResponse.builder()
                .id(tenant.getId())
                .slug(tenant.getSlug())
                .name(tenant.getName())
                .description(tenant.getDescription())
                .active(tenant.isActive())
                .createdAt(tenant.getCreatedAt())
                .updatedAt(tenant.getUpdatedAt())
                .build();
    }

    private String normalizeSlug(String slug) {
        return slug == null ? "" : slug.trim().toLowerCase(Locale.ROOT);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
