AGENTS.md — Guía rápida para agentes AI

Objetivo
- Proveer a un agente AI la información mínima y accionable para ser productivo en este repositorio Spring Boot (Java 21) llamado "zonas-espacios".

Resumen de arquitectura (big picture)
- Micro/monolito ligero: aplicación Spring Boot ubicada en `src/main/java/ec/edu/espe/zonas` con clase de arranque `ZonasEspaciosApplication.java`.
- Capa de dominio: entidades JPA en `src/main/java/ec/edu/espe/zonas/entidades` (ej. `Zona.java`).
- Recursos estáticos: `src/main/resources/static` y plantillas en `src/main/resources/templates` (vacíos por defecto).
- Configuración: `src/main/resources/application.yaml` (actualmente solo define el nombre de la app).
- Persistencia: usa Spring Data JPA (dependencia en `pom.xml`) y conector MySQL en tiempo de ejecución; la configuración de datasource NO está incluida aquí — esperar variables de entorno o añadir `spring.datasource.*`.

Puntos críticos y decisiones observables
- Java 21 y Spring Boot 4 (ver `pom.xml` propiedades) — requiere JDK 21 en entorno de ejecución.
- Uso de Lombok (anotaciones en `Zona.java` y configuración del compilador en `pom.xml`) — el compilador está configurado para usar Lombok como procesador de anotaciones.
- Persistencia esperada con UUID: `@GeneratedValue(strategy = GenerationType.UUID)` aparece en `Zona.java`, lo que indica IDs tipo UUID.
- `Zona.java` está incompleta/fragmentada en el repo actual (faltan imports y campos). Agente debe validar/abrir ese archivo antes de editar.

Flujos de desarrollador (comandos útiles)
- Build reproducible (Windows PowerShell):
  mvnw.cmd clean package
- Ejecutar en desarrollo (Spring Boot):
  mvnw.cmd spring-boot:run
- Ejecutar tests:
  mvnw.cmd test
- Ejecutar con depuración remota (puerto 5005):
  mvnw.cmd spring-boot:run -Dspring-boot.run.jvmArguments="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"
- Ejecutar empaquetado y ejecutar jar (después de package):
  java -jar target/zonas-espacios-0.0.1-SNAPSHOT.jar

Patrones y convenciones del proyecto
- Estructura de paquetes: `ec.edu.espe.zonas` raíz; `entidades` para JPA entities. Mantener esa organización.
- Lombok: las entidades usan `@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor` — cuando añadas campos, no olvides actualizar constructores/serialización si decides remover Lombok.
- Anotaciones JPA: `@Entity`, `@Table(name="zonas")` y `@Id`/`@GeneratedValue` esperadas.
- Compiler: Maven configura `annotationProcessorPaths` para Lombok — no agregar otra configuración de procesador sin revisarla.

Integraciones y dependencias externas
- MySQL connector está presente (runtime). Sin `spring.datasource` la app no conectará a DB:
  - Agente: si crea pruebas de integración, mockear/reemplazar DataSource o añadir configuración embebida (H2) en `pom.xml` o `application.yaml`.
- No hay clientes HTTP, colas ni otros servicios externos detectados.

Edición segura: recomendaciones para el agente
- Validar compilación tras cambios: siempre ejecutar `mvnw.cmd -q -DskipTests=false package` y corregir errores de compilación/linter.
- Antes de modificar `Zona.java` inspeccionar si el archivo está intencionalmente incompleto (ejercicio o plantilla). Añadir imports:
  import jakarta.persistence.*;
  import lombok.*;
- No asumir propiedades de configuración (DB URL/credenciales) — documentar cualquier añadidura en `application.yaml` o leer variables de entorno.

Archivos clave a revisar
- `pom.xml` — dependencias, versión Spring Boot, Java target, configuración de Lombok.
- `src/main/java/ec/edu/espe/zonas/ZonasEspaciosApplication.java` — punto de arranque.
- `src/main/java/ec/edu/espe/zonas/entidades/Zona.java` — entidad principal (actualmente incompleta).
- `src/main/resources/application.yaml` — configuración central (actualmente mínima).

Checklist rápida para tareas comunes
- Ejecutar la app: `mvnw.cmd spring-boot:run` (Windows PowerShell)
- Compilar y testear: `mvnw.cmd clean package` y `mvnw.cmd test`
- Añadir entidad JPA: seguir paquete `entidades`, usar Lombok, añadir imports jakarta.persistence.*
- Añadir conexión DB: modificar `application.yaml` con `spring.datasource` o usar perfiles

Notas finales
- Este repo parece ser un esqueleto/ejercicio. Muchos artefactos (entidades completas, controladores, repositorios) pueden faltar intencionalmente. El agente debe confirmar la intención con el autor o crear PRs pequeñas y probadas.

---
Fuente: inspección de `pom.xml`, `ZonasEspaciosApplication.java`, `src/main/resources/application.yaml`, `src/main/java/ec/edu/espe/zonas/entidades/Zona.java`.

