## Visão Geral

Este projeto implementa uma arquitetura de microsserviços com:
- **Product Service**: gerencia catálogo de produtos
- **Order Service**: processa pedidos consultando produtos
- **Logging estruturado**: rastreamento de requisições com Correlation IDs
- **Docker Compose**: orquestração local completa

## Início Rápido

### Pré-requisitos
- Docker e Docker Compose instalados
- Curl ou Postman para testar APIs

### Executar

```bash
git clone https://github.com/KayanKayser1011/projeto-microservices
cd projeto-microservices

# Iniciar todos os serviços
docker compose up

curl http://localhost:3001/health
curl http://localhost:3002/health
```

### Product Service (Port 3001)

**GET /**
- Página informativa amigável
- Response: HTML com informações do serviço

**GET /health**
- Health check do serviço
- Response: `{"status": "UP"}`

**GET /products**
- Lista todos os produtos disponíveis
- Response: Array de produtos com id, name, price, stock

Exemplo:
```bash
curl http://localhost:3001/products
```

### Order Service (Port 3002)

**GET /**
- Página informativa amigável
- Response: HTML com instruções

**GET /health**
- Health check do serviço
- Response: `{"status": "UP"}`

**POST /orders**
- Cria um novo pedido
- Consulta automaticamente Product Service
- Response: Pedido criado com lista de produtos

Exemplo:
```bash
curl -X POST http://localhost:3002/orders \
  -H "Content-Type: application/json"
```

## Documentação

- **ARQUITETURA.txt**: Document completo de arquitetura, SLOs, observabilidade e segurança
- **ADR-001.txt**: Por que usar HTTP/REST em vez de message queues
- **ADR-002.txt**: Por que implementar Correlation IDs para rastreamento
- **ADR-003.txt**: Por que usar Docker Compose em vez de Kubernetes
- **PEER_REVIEW_CHECKLIST.txt**: Checklist de avaliação preenchido

## Comunicação entre Serviços

```
Cliente HTTP
    ↓
[curl localhost:3002/orders]
    ↓
Order Service
    ├─ Gera Correlation ID: abc-123
    ├─ Loga requisição
    ├─ Chama Product Service → GET /products
    │   ├─ Header X-Correlation-ID: abc-123
    │   └─ Timeout: 5 segundos
    │
    └─ Product Service responde com lista de produtos
       └─ Loga com mismo Correlation ID
    
Order Service cria pedido e retorna
```

## Comandos Docker Compose

```bash
# Iniciar e manter terminal monitorando
docker compose up

# Iniciar em background
docker compose up -d

# Ver logs em tempo real
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f product-service

# Parar os serviços
docker compose down

# Reiniciar
docker compose restart

# Rebuild das imagens (se modificou código)
docker compose up --build
```
