package ec.edu.ec.usuarios.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public class AuditEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(AuditEventPublisher.class);

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private JsonMapper objectMapper; // Spring Boot 4 ya lo autoconfigura

    @Value("${RABBITMQ_EXCHANGE:exchange_audit}")
    private String exchange;

    @Value("${RABBITMQ_ROUTING_KEY:routing_audit}")
    private String routingKey;

    @Async
    public void publish(AuditEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            rabbitTemplate.convertAndSend(exchange, routingKey, payload);
            log.debug("Evento de auditoría publicado: {} - {} - {}", event.servicio(), event.accion(), event.entidad());
        } catch (Exception exception) {
            log.error("No se pudo publicar el evento de auditoría", exception);
        }
    }
}
