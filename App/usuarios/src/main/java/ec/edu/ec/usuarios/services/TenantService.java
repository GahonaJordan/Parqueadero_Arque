package ec.edu.ec.usuarios.services;

import ec.edu.ec.usuarios.dto.request.TenantRequest;
import ec.edu.ec.usuarios.dto.response.TenantResponse;

import java.util.List;
import java.util.UUID;

public interface TenantService {
    TenantResponse createTenant(TenantRequest request);
    List<TenantResponse> getAllTenants();
    List<TenantResponse> getActiveTenants();
    TenantResponse getTenantById(UUID id);
    TenantResponse updateTenant(UUID id, TenantRequest request);
    void deleteTenant(UUID id);
}
