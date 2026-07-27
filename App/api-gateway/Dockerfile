FROM kong:3.6

USER root
COPY kong.yml /kong/declarative/kong.yml
RUN chown -R kong:kong /kong

USER kong

ENV KONG_DATABASE=off \
    KONG_DECLARATIVE_CONFIG=/kong/declarative/kong.yml \
    KONG_PROXY_LISTEN=0.0.0.0:8080 \
    KONG_ADMIN_LISTEN=0.0.0.0:8001 \
    KONG_PROXY_ACCESS_LOG=/dev/stdout \
    KONG_ADMIN_ACCESS_LOG=/dev/stdout \
    KONG_PROXY_ERROR_LOG=/dev/stderr \
    KONG_ADMIN_ERROR_LOG=/dev/stderr \
    KONG_LOG_LEVEL=info \
    KONG_NGINX_HTTP_CLIENT_MAX_BODY_SIZE=10m

EXPOSE 8080 8001

# JWT se valida en cada microservicio vía /api/auth/validate.
# Kong aporta enrutamiento, rate-limiting, CORS y transformación de headers.
