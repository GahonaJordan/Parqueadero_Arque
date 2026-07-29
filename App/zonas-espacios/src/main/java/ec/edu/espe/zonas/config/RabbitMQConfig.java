package ec.edu.espe.zonas.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    @Value("${RABBITMQ_EXCHANGE:exchange_audit}")
    private String exchange;

    @Value("${RABBITMQ_QUEUE:queue_audit}")
    private String queue;

    @Value("${RABBITMQ_ROUTING_KEY:routing_audit}")
    private String routingKey;

    @Bean
    public TopicExchange auditExchange() {
        return new TopicExchange(exchange, true, false);
    }

    @Bean
    public Queue auditQueue() {
        return new Queue(queue, true);
    }

    @Bean
    public Binding auditBinding(Queue auditQueue, TopicExchange auditExchange) {
        return BindingBuilder.bind(auditQueue).to(auditExchange).with(routingKey);
    }
}
