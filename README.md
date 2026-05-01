## Sistema de Gerenciamento de Demandas

Este projeto implementa uma arquitetura de microsserviços para gestão de demandas de problemas:
- **Demand Service**: registra demandas e define prazos de 10 dias úteis
- **Deadline Checker Service**: verifica prazos e envia alertas por email
- **Email Service**: envia notificações de alertas
- **Logging estruturado**: rastreamento de requisições com Correlation IDs
- **Observabilidade Prometheus**: métricas expostas em `/metrics`
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

curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:9091

# Observação
Se você já tiver outro Prometheus rodando em `localhost:9090`, este projeto usa `localhost:9091` para não conflitar.
```

### Variáveis de ambiente opcionais

Para usar SMTP real no `email-service`, crie um arquivo `.env` com as variáveis:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu_usuario
SMTP_PASS=sua_senha
EMAIL_FROM=alerts@company.com
EMAIL_TO=destino@company.com
```

### Demand Service (Port 3001)

**GET /**
- Página informativa amigável
- Response: HTML com informações do serviço

**GET /health**
- Health check do serviço
- Response: `{"status": "UP"}`

**GET /metrics**
- Prometheus metrics endpoint
- Response: métricas em formato text/plain

**POST /demands**
- Cria uma nova demanda de problema
- Define prazo automático de 10 dias úteis
- Body: `{"title": "string", "description": "string"}`
- Response: Demanda criada com ID, prazo, status

**GET /demands**
- Lista todas as demandas registradas
- Response: Array de demandas

Exemplo:
```bash
curl -X POST http://localhost:3001/demands \
  -H "Content-Type: application/json" \
  -d '{"title": "Problema X", "description": "Descrição detalhada"}'

curl http://localhost:3001/demands
```

### Deadline Checker Service (Port 3002)

**GET /**
- Página informativa amigável
- Response: HTML com informações do serviço

**GET /health**
- Health check do serviço
- Response: `{"status": "UP"}`

**GET /metrics**
- Prometheus metrics endpoint
- Response: métricas em formato text/plain

**POST /check-deadlines**
- Força verificação manual de prazos
- Response: `{"message": "Deadline check completed"}`

### Email Service (Port 3003)

**GET /**
- Página informativa amigável
- Response: HTML com informações do serviço

**GET /health**
- Health check do serviço
- Response: `{"status": "UP"}`

**GET /metrics**
- Prometheus metrics endpoint
- Response: métricas em formato text/plain

**POST /send-alert**
- Envia alerta por email
- Body: `{"demandId": "uuid", "type": "warning|urgent", "message": "string"}`
- Response: Confirmação de envio

### UI Service (Port 3000)

**GET /**
- Frontend dashboard estático
- Monitora demandas, deadlines e alertas
- Permite editar status e deadline de demandas
- Exibe logs recentes do Deadline Checker Service

**GET /health**
- Health check do serviço
- Response: `{"status": "UP"}`

## Regras de Negócio

- **Prazo**: Toda demanda tem 10 dias úteis para resposta
- **Alertas**: 
  - 5 dias restantes: alerta único para demandas pendentes
  - 3 dias restantes: alertas diários para demandas sem tratativa
- **Status**: PENDENTE → EM_TRATATIVA → FINALIZADA

## SLA e SLOs

O serviço de gerenciamento de demandas tem as seguintes metas de confiabilidade e desempenho:

- SLA: 99% de disponibilidade mensal para os endpoints principais (`/health`, `/demands`, `/check-deadlines`, `/send-alert`).
- SLO: 99% de sucesso nas respostas dos endpoints críticos em 30 dias.
- SLO: 95% das requisições ao Demand Service (`/demands`) retornam em até 500ms.
- SLO: `/health` responde com `status: UP` em até 300ms em 99,9% das verificações.
- SLO: o Deadline Checker executa seu ciclo horário com atraso máximo de 5 minutos.
- SLO: o Email Service processa alertas simulados em até 1 minuto após a detecção de prazo crítico.

## Comunicação entre Serviços

```
Cliente HTTP
    ↓
[POST /demands] → Demand Service (registra demanda)
    ↓
Deadline Checker (verifica prazos a cada hora)
    ├─ Consulta Demand Service → GET /demands
    ├─ Se prazo crítico → chama Email Service
    └─ Email Service → simula envio de email
    
Protocolo: HTTP/REST, JSON, Correlation ID no header X-Correlation-ID
```

## Documentação

- **ARQUITETURA.txt**: Documento completo de arquitetura, SLA/SLOs, observabilidade e segurança
- **ADR-001.txt**: Por que usar HTTP/REST em vez de mensageria assíncrona
- **ADR-002.txt**: Por que implementar Correlation IDs para rastreamento
- **ADR-003.txt**: Por que usar Docker Compose em vez de Kubernetes
- **ADR-004.txt**: Por que usar SQLite para persistência de dados (Demand Service) e logs (Deadline Checker)
- **ADR-005.txt**: Por que usar interface web estática
- **PEER_REVIEW_CHECKLIST.txt**: Checklist de avaliação preenchido

## Comandos Docker Compose

```bash
# Iniciar e manter terminal monitorando
docker compose up

# Verificar status dos serviços
docker compose ps

# Ver logs de um serviço específico
docker compose logs demand-service

# Iniciar em background
docker compose up -d

# Ver logs em tempo real
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f demand-service

# Parar os serviços
docker compose down

# Reiniciar
docker compose restart

# Rebuild das imagens (se modificou código)
docker compose up --build
```
