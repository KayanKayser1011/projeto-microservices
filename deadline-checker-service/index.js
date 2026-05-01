const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const client = require('prom-client');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3002;

client.collectDefaultMetrics();

const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'service']
});

const httpRequestDurationSeconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code', 'service'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

const httpRequestErrorsTotal = new client.Counter({
    name: 'http_request_errors_total',
    help: 'Total number of HTTP requests with error status codes',
    labelNames: ['method', 'route', 'status_code', 'service']
});

app.use(cors());
app.use(express.json());

const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'deadline-checker.db'));
db.prepare(`CREATE TABLE IF NOT EXISTS check_logs (
    id TEXT PRIMARY KEY,
    demand_id TEXT,
    title TEXT,
    status TEXT,
    deadline TEXT,
    days_remaining INTEGER,
    alert_type TEXT,
    message TEXT,
    checked_at TEXT,
    correlation_id TEXT
)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS alert_logs (
    id TEXT PRIMARY KEY,
    demand_id TEXT,
    type TEXT,
    message TEXT,
    sent_at TEXT,
    correlation_id TEXT
)`).run();

function saveCheckLog(entry) {
    db.prepare(`INSERT INTO check_logs (id, demand_id, title, status, deadline, days_remaining, alert_type, message, checked_at, correlation_id)
        VALUES (@id, @demand_id, @title, @status, @deadline, @days_remaining, @alert_type, @message, @checked_at, @correlation_id)`).run(entry);
}

function saveAlertLog(entry) {
    db.prepare(`INSERT INTO alert_logs (id, demand_id, type, message, sent_at, correlation_id)
        VALUES (@id, @demand_id, @type, @message, @sent_at, @correlation_id)`).run(entry);
}

app.use((req, res, next) => {
    const end = httpRequestDurationSeconds.startTimer();

    res.on('finish', () => {
        const route = req.route && req.route.path ? req.route.path : req.path;
        const labels = {
            method: req.method,
            route,
            status_code: res.statusCode,
            service: 'deadline_checker_service'
        };

        httpRequestsTotal.inc(labels);
        end(labels);

        if (res.statusCode >= 500) {
            httpRequestErrorsTotal.inc(labels);
        }
    });

    next();
});

app.use((req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || uuidv4();
    res.set('x-correlation-id', req.correlationId);
    next();
});

app.use((req, res, next) => {
    console.log(JSON.stringify({
        service: "deadline-checker-service",
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString()
    }));
    next();
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Deadline Checker Service</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .container {
                    background: white;
                    border-radius: 12px;
                    padding: 40px;
                    max-width: 600px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 { color: #f5576c; margin-bottom: 20px; font-size: 28px; }
                .status {
                    display: inline-block;
                    background: #10b981;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 20px;
                }
                p { color: #6b7280; line-height: 1.6; margin-bottom: 16px; }
                .section { margin-bottom: 30px; }
                .section h2 { font-size: 18px; color: #374151; margin-bottom: 12px; }
                code {
                    background: #f3f4f6;
                    padding: 2px 6px;
                    border-radius: 4px;
                    color: #d97706;
                    font-family: 'Monaco', 'Courier New', monospace;
                }
                a {
                    color: #f5576c;
                    text-decoration: none;
                    font-weight: 500;
                    border-bottom: 2px solid #f5576c;
                }
                a:hover { color: #f093fb; border-bottom-color: #f093fb; }
                .endpoint {
                    background: #f9fafb;
                    border-left: 4px solid #f5576c;
                    padding: 12px 16px;
                    border-radius: 4px;
                    margin: 8px 0;
                    font-family: 'Monaco', 'Courier New', monospace;
                    font-size: 14px;
                }
                .correlationId {
                    background: #dbeafe;
                    border: 1px solid #0ea5e9;
                    padding: 12px;
                    border-radius: 6px;
                    font-weight: 500;
                    color: #0369a1;
                    margin-top: 8px;
                }
                .note {
                    background: #fef3c7;
                    border: 1px solid #fcd34d;
                    padding: 12px;
                    border-radius: 6px;
                    margin-top: 12px;
                    font-size: 14px;
                    color: #78350f;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⏰ Deadline Checker Service</h1>
                <div class="status">✓ Operational</div>

                <div class="section">
                    <h2>O que é?</h2>
                    <p>Microsserviço que verifica prazos das demandas e envia alertas por email quando necessário.</p>
                </div>

                <div class="section">
                    <h2>Regras de Alerta</h2>
                    <ul style="color: #6b7280; line-height: 1.6;">
                        <li><strong>5 dias restantes:</strong> Alerta único para demandas pendentes</li>
                        <li><strong>3 dias restantes:</strong> Alertas diários para demandas sem tratativa</li>
                    </ul>
                </div>

                <div class="section">
                    <h2>Endpoints Disponíveis</h2>
                    <div class="endpoint">GET /health</div>
                    <p>Verifica o status de saúde do serviço</p>

                    <div class="endpoint">POST /check-deadlines</div>
                    <p>Força verificação manual de prazos</p>
                </div>

                <div class="section">
                    <h2>Como Funciona</h2>
                    <p>Executa automaticamente a cada hora verificando prazos e enviando alertas.</p>
                    <div class="note">
                        Integra com Demand Service (porta 3001) e Email Service (porta 3003).
                    </div>
                </div>

                <div class="section">
                    <h2>Rastreabilidade</h2>
                    <p>Quando você acessa este serviço, um ID único é gerado para rastrear a requisição.</p>
                    <div class="correlationId">
                        <strong>Seu ID de Rastreamento:</strong><br>${req.correlationId}
                    </div>
                </div>

                <div class="section">
                    <p>
                        <strong>Fase:</strong> Desenvolvimento Local<br>
                        <strong>Stack:</strong> Node.js + Express + Cron<br>
                        <strong>Porta:</strong> 3002<br>
                        <strong>Dependências:</strong> Demand Service (3001), Email Service (3003)
                    </p>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({ status: 'UP' });
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

app.post('/check-deadlines', async (req, res) => {
    try {
        await checkDeadlines();
        res.json({ message: 'Deadline check completed' });
    } catch (error) {
        console.error(JSON.stringify({
            service: "deadline-checker-service",
            correlationId: req.correlationId,
            error: error.message,
            timestamp: new Date().toISOString()
        }));
        res.status(500).json({ error: 'Failed to check deadlines' });
    }
});

app.get('/logs', (req, res) => {
    const checks = db.prepare('SELECT * FROM check_logs ORDER BY checked_at DESC LIMIT 50').all();
    const alerts = db.prepare('SELECT * FROM alert_logs ORDER BY sent_at DESC LIMIT 50').all();
    res.json({ checks, alerts });
});

app.delete('/logs', (req, res) => {
    try {
        db.prepare('DELETE FROM check_logs').run();
        db.prepare('DELETE FROM alert_logs').run();
        res.json({ message: 'Logs e alertas limpos com sucesso' });
    } catch (error) {
        console.error('Erro ao limpar logs:', error);
        res.status(500).json({ error: 'Falha ao limpar logs' });
    }
});

cron.schedule('0 * * * *', async () => {
    console.log('Running scheduled deadline check...');
    await checkDeadlines();
});

async function checkDeadlines() {
    try {
        const response = await axios.get('http://demand-service:3001/demands', {
            headers: { 'x-correlation-id': uuidv4() },
            timeout: 5000
        });

        const demands = response.data;
        const now = new Date();

        for (const demand of demands) {
            if (demand.status === 'FINALIZADA') continue;

            const deadline = new Date(demand.deadline);
            const daysRemaining = calculateBusinessDays(now, deadline);
            let alertType = null;
            let alertMessage = null;

            if (daysRemaining === 5 && (demand.status === 'PENDENTE' || demand.status === 'EM_TRATATIVA')) {
                alertType = 'warning';
                alertMessage = `Demanda "${demand.title}" vence em 5 dias úteis`;
                await sendAlert(demand, alertType, alertMessage);
            }

            if (daysRemaining <= 3 && (demand.status === 'PENDENTE' || demand.status === 'EM_TRATATIVA')) {
                alertType = 'urgent';
                alertMessage = `URGENTE: Demanda "${demand.title}" vence em ${daysRemaining} dias úteis`;
                await sendAlert(demand, alertType, alertMessage);
            }

            saveCheckLog({
                id: uuidv4(),
                demand_id: demand.id,
                title: demand.title,
                status: demand.status,
                deadline: deadline.toISOString(),
                days_remaining: daysRemaining,
                alert_type: alertType,
                message: alertMessage,
                checked_at: now.toISOString(),
                correlation_id: uuidv4()
            });
        }
    } catch (error) {
        console.error('Error checking deadlines:', error.message);
    }
}

async function sendAlert(demand, type, message) {
    const correlationId = uuidv4();
    try {
        await axios.post('http://email-service:3003/send-alert', {
            demandId: demand.id,
            type,
            message,
            correlationId
        }, {
            headers: { 'x-correlation-id': correlationId },
            timeout: 5000
        });

        saveAlertLog({
            id: uuidv4(),
            demand_id: demand.id,
            type,
            message,
            sent_at: new Date().toISOString(),
            correlation_id: correlationId
        });
    } catch (error) {
        console.error('Error sending alert:', error.message);
        saveAlertLog({
            id: uuidv4(),
            demand_id: demand.id,
            type,
            message: `${message} (failed: ${error.message})`,
            sent_at: new Date().toISOString(),
            correlation_id: correlationId
        });
    }
}

function calculateBusinessDays(fromDate, toDate) {
    let businessDays = 0;
    let currentDate = new Date(fromDate);

    while (currentDate < toDate) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
            businessDays++;
        }
    }

    return businessDays;
}

app.listen(PORT, () => {
    console.log(`Deadline Checker Service running on port ${PORT}`);
});