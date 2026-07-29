# Script de despliegue para Kubernetes con Minikube - Proyecto Parqueaderos
# Automatiza la construcción de imágenes y despliegue en Kubernetes

Write-Host "Iniciando despliegue en Kubernetes para Proyecto Parqueaderos..." -ForegroundColor Green

# 1. Iniciar Minikube
Write-Host "`n[1/11] Iniciando Minikube con driver Docker..." -ForegroundColor Yellow
minikube start --driver=docker
minikube start --memory=6192 --cpus=4
# 2. Habilitar dashboard (opcional, en background)
Write-Host "`n[2/11] Habilitando dashboard de Minikube..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-Command", "minikube dashboard" -WindowStyle Hidden

# 3. Habilitar Ingress
Write-Host "`n[3/11] Habilitando addon Ingress..." -ForegroundColor Yellow
minikube addons enable ingress

# 4. Configurar entorno Docker para Minikube
Write-Host "`n[4/11] Configurando entorno Docker para Minikube..." -ForegroundColor Yellow
& minikube -p minikube docker-env | Invoke-Expression

# 5. Construir imágenes Docker
Write-Host "`n[5/11] Construyendo imágenes Docker..." -ForegroundColor Yellow
Write-Host "Construyendo api-gateway..." -ForegroundColor Cyan
docker build -t api-gateway:latest ./api-gateway
Write-Host "Construyendo usuarios..." -ForegroundColor Cyan
docker build -t usuarios:latest ./usuarios
Write-Host "Construyendo zonas-espacios..." -ForegroundColor Cyan
docker build -t zonas-espacios:latest ./zonas-espacios
Write-Host "Construyendo ms-audit..." -ForegroundColor Cyan
docker build -t ms-audit:latest ./ms-audit
Write-Host "Construyendo tickets..." -ForegroundColor Cyan
docker build -t tickets:latest ./tickets
Write-Host "Construyendo vehiculo..." -ForegroundColor Cyan
docker build -t vehiculo:latest ./vehiculo
Write-Host "Construyendo frontend MONITOREO..." -ForegroundColor Cyan
docker build -t frontend-monitoreo:latest ./MONITOREO

# 6. Listar imágenes en Minikube
Write-Host "`n[6/11] Listando imágenes en Minikube..." -ForegroundColor Yellow
minikube image ls
minikube status

# 7. Aplicar manifiestos de Kubernetes - Infraestructura
Write-Host "`n[7/11] Aplicando manifiestos de Kubernetes - Infraestructura..." -ForegroundColor Yellow
kubectl apply -f k8s/1-namespace.yml
kubectl apply -f k8s/2-redis.yml
kubectl apply -f k8s/3-rabbitmq.yml

# 8. Aplicar manifiestos de Kubernetes - Bases de datos
Write-Host "`n[8/11] Aplicando manifiestos de Kubernetes - Bases de datos..." -ForegroundColor Yellow
kubectl apply -f k8s/4-postgres-usuarios.yml
kubectl apply -f k8s/5-postgres-tickets.yml
kubectl apply -f k8s/6-postgres-vehiculo.yml
kubectl apply -f k8s/7-postgres-audit.yml
kubectl apply -f k8s/8-mysql-zonas.yml

# 9. Esperar a que las bases de datos estén listas
Write-Host "`n[9/11] Esperando a que las bases de datos estén listas..." -ForegroundColor Yellow
Write-Host "Esto puede tomar unos minutos..." -ForegroundColor Cyan
kubectl wait --for=condition=ready pod -l app=postgres-usuarios -n parqueaderos --timeout=300s
kubectl wait --for=condition=ready pod -l app=postgres-tickets -n parqueaderos --timeout=300s
kubectl wait --for=condition=ready pod -l app=postgres-vehiculo -n parqueaderos --timeout=300s
kubectl wait --for=condition=ready pod -l app=postgres-audit -n parqueaderos --timeout=300s
kubectl wait --for=condition=ready pod -l app=mysql-zonas -n parqueaderos --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n parqueaderos --timeout=300s
kubectl wait --for=condition=ready pod -l app=rabbitmq -n parqueaderos --timeout=300s

# 10. Aplicar manifiestos de Kubernetes - Microservicios
Write-Host "`n[10/11] Aplicando manifiestos de Kubernetes - Microservicios..." -ForegroundColor Yellow
kubectl apply -f k8s/9-api-gateway.yml
kubectl apply -f k8s/10-usuarios.yml
kubectl apply -f k8s/11-zonas-espacios.yml
kubectl apply -f k8s/12-ms-audit.yml
kubectl apply -f k8s/13-tickets.yml
kubectl apply -f k8s/14-vehiculo.yml
kubectl apply -f k8s/15-ingress.yml
kubectl apply -f k8s/16-front.yml

# 11. Verificar despliegue
Write-Host "`n[11/11] Verificando despliegue..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
kubectl get pods -n parqueaderos
kubectl get svc -n parqueaderos
kubectl get ingress -n parqueaderos

# agregar tunel para acceder a la aplicación desde el navegador
 minikube tunnel
 minikube dashboard
Write-Host "`n✓ Despliegue completado!" -ForegroundColor Green
Write-Host "`nComandos útiles:" -ForegroundColor Cyan
Write-Host "  - Ver pods: kubectl get pods -n parqueaderos" -ForegroundColor White
Write-Host "  - Ver servicios: kubectl get svc -n parqueaderos" -ForegroundColor White
Write-Host "  - Ver ingress: kubectl get ingress -n parqueaderos" -ForegroundColor White
Write-Host '  - Ver logs de un pod: kubectl logs <pod-name> -n parqueaderos' -ForegroundColor White
Write-Host '  - Acceder a un pod: kubectl exec -it <pod-name> -n parqueaderos -- sh' -ForegroundColor White
Write-Host "`nPara acceder a la aplicación:" -ForegroundColor Cyan
Write-Host "  1. Agrega 'parqueaderos.local' a tu archivo hosts (C:\Windows\System32\drivers\etc\hosts)" -ForegroundColor White
Write-Host "  2. Apunta a la IP de Minikube: $(minikube ip)" -ForegroundColor White
Write-Host "  3. Accede via http://parqueaderos.local" -ForegroundColor White
$minikubeIp = minikube ip
Write-Host "`nIP de Minikube: $minikubeIp" -ForegroundColor Yellow
