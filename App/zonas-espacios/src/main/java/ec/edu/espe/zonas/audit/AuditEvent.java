package ec.edu.espe.zonas.audit;

public record AuditEvent(
        String servicio,
        String accion,
        String entidad,
        String entidadId,
        Object datos,
        String usuario,
        String ip,
        String mac) {
}