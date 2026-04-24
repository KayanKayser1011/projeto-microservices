const express = require('express');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3003;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'alerts@company.com';
const EMAIL_TO = process.env.EMAIL_TO || 'alerts@company.com';
const useRealEmail = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.example.com',
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
});

app.use(express.json());

app.use((req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || uuidv4();
    res.set('x-correlation-id', req.correlationId);
    next();
});

app.use((req, res, next) => {
    console.log(JSON.stringify({
        service: "email-service",
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
            <title>Email Service</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
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
                h1 { color: #4facfe; margin-bottom: 20px; font-size: 28px; }
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
                    color: #4facfe;
                    text-decoration: none;
                    font-weight: 500;
                    border-bottom: 2px solid #4facfe;
                }
                a:hover { color: #00f2fe; border-bottom-color: #00f2fe; }
                .endpoint {
                    background: #f9fafb;
                    border-left: 4px solid #4facfe;
                    padding: 12px 16px;
                    border-radius: 4px;
                    margin: 8px 0;
                    font-family: 'Monaco', 'Courier New', monospace;
                    font-size: 14px;
                }
                .correlationId {
                    background: #e0f2fe;
                    border: 1px solid #0284c7;
                    padding: 12px;
                    border-radius: 6px;
                    font-weight: 500;
                    color: #0c4a6e;
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
                <h1>📧 Email Service</h1>
                <div class="status">✓ Operational</div>

                <div class="section">
                    <h2>O que é?</h2>
                    <p>Microsserviço responsável por enviar alertas por email sobre prazos de demandas.</p>
                </div>

                <div class="section">
                    <h2>Tipos de Alertas</h2>
                    <ul style="color: #6b7280; line-height: 1.6;">
                        <li><strong>Warning:</strong> Alerta com 5 dias restantes (envio único)</li>
                        <li><strong>Urgent:</strong> Alerta urgente com 3 dias ou menos (diário)</li>
                    </ul>
                </div>

                <div class="section">
                    <h2>Endpoints Disponíveis</h2>
                    <div class="endpoint">GET /health</div>
                    <p>Verifica o status de saúde do serviço</p>

                    <div class="endpoint">POST /send-alert</div>
                    <p>Envia um alerta por email</p>
                </div>

                <div class="section">
                    <h2>Como Funciona</h2>
                    <p>Recebe solicitações do Deadline Checker Service e simula envio de emails.</p>
                    <div class="note">
                        Em produção, seria configurado com SMTP real (Gmail, SendGrid, etc.).
                    </div>
                </div>

                <div class="section">
                    <h2>Rastreabilidade</h2>
                    <p>Todas as operações são rastreadas com Correlation ID.</p>
                    <div class="correlationId">
                        <strong>Seu ID de Rastreamento:</strong><br>${req.correlationId}
                    </div>
                </div>

                <div class="section">
                    <p>
                        <strong>Fase:</strong> Desenvolvimento Local<br>
                        <strong>Stack:</strong> Node.js + Express + Nodemailer<br>
                        <strong>Porta:</strong> 3003
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

app.post('/send-alert', async (req, res) => {
    const { demandId, type, message, correlationId } = req.body;

    try {
        if (useRealEmail) {
            await transporter.sendMail({
                from: EMAIL_FROM,
                to: EMAIL_TO,
                subject: `Alerta de Prazo - ${type.toUpperCase()}`,
                text: message
            });
        }

        console.log(JSON.stringify({
            service: "email-service",
            correlationId: correlationId || req.correlationId,
            action: "email_sent",
            demandId,
            type,
            message,
            recipient: EMAIL_TO,
            mode: useRealEmail ? 'smtp' : 'console',
            timestamp: new Date().toISOString()
        }));

        res.json({ message: 'Alert email sent successfully', smtp: useRealEmail });
    } catch (error) {
        console.error(JSON.stringify({
            service: "email-service",
            correlationId: req.correlationId,
            error: error.message,
            timestamp: new Date().toISOString()
        }));
        res.status(500).json({ error: 'Failed to send email' });
    }
});

app.listen(PORT, () => {
    console.log(`Email Service running on port ${PORT}`);
});