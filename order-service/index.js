const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.use((req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || uuidv4();
    res.set('x-correlation-id', req.correlationId);
    next();
});

app.use((req, res, next) => {
    console.log(JSON.stringify({
        service: "order-service",
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
            <title>Order Service</title>
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
                <h1>🛒 Order Service</h1>
                <div class="status">✓ Operational</div>
                
                <div class="section">
                    <h2>O que é?</h2>
                    <p>Um microsserviço responsável por processar pedidos. Ele se comunica com o Product Service para obter informações dos produtos cadastrados.</p>
                </div>
                
                <div class="section">
                    <h2>Endpoints Disponíveis</h2>
                    <div class="endpoint">GET /health</div>
                    <p>Verifica o status de saúde do serviço</p>
                    
                    <div class="endpoint">POST /orders</div>
                    <p>Cria um novo pedido consultando os produtos disponíveis</p>
                    <div class="note">
                        Tenta conectar automaticamente ao Product Service (porta 3001) para buscar os produtos.
                    </div>
                </div>

                <div class="section">
                    <h2>Como Testar</h2>
                    <p>Use curl para criar um pedido:</p>
                    <div class="endpoint">
                        curl -X POST http://localhost:3002/orders
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
                        <strong>Stack:</strong> Node.js + Express<br>
                        <strong>Porta:</strong> 3002<br>
                        <strong>Dependências:</strong> Product Service (localhost:3001)
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

app.post('/orders', async (req, res) => {
    try {
        const response = await axios.get('http://product-service:3001/products', {
            headers: { 'x-correlation-id': req.correlationId },
            timeout: 5000
        });

        const order = {
            id: uuidv4(),
            products: response.data,
            createdAt: new Date(),
            status: 'CREATED'
        };

        res.status(201).json(order);
    } catch (error) {
        console.error(JSON.stringify({
            service: "order-service",
            correlationId: req.correlationId,
            error: error.message,
            timestamp: new Date().toISOString()
        }));
        res.status(500).json({ error: 'Failed to create order' });
    }
});

app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
});