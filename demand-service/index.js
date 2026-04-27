const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize SQLite database
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'demands.db'));

// Create demands table if it doesn't exist
db.prepare(`
    CREATE TABLE IF NOT EXISTS demands (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        deadline TEXT NOT NULL,
        correlationId TEXT
    )
`).run();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || uuidv4();
    res.set('x-correlation-id', req.correlationId);
    next();
});

app.use((req, res, next) => {
    console.log(JSON.stringify({
        service: "demand-service",
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
            <title>Demand Service</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                h1 { color: #667eea; margin-bottom: 20px; font-size: 28px; }
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
                    color: #667eea;
                    text-decoration: none;
                    font-weight: 500;
                    border-bottom: 2px solid #667eea;
                }
                a:hover { color: #764ba2; border-bottom-color: #764ba2; }
                .endpoint {
                    background: #f9fafb;
                    border-left: 4px solid #667eea;
                    padding: 12px 16px;
                    border-radius: 4px;
                    margin: 8px 0;
                    font-family: 'Monaco', 'Courier New', monospace;
                    font-size: 14px;
                }
                .correlationId {
                    background: #fff3cd;
                    border: 1px solid #ffc107;
                    padding: 12px;
                    border-radius: 6px;
                    font-weight: 500;
                    color: #856404;
                    margin-top: 8px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📋 Demand Service</h1>
                <div class="status">✓ Operational</div>

                <div class="section">
                    <h2>O que é?</h2>
                    <p>Microsserviço responsável por registrar e gerenciar demandas de problemas. Define prazo de 10 dias úteis para resposta.</p>
                </div>

                <div class="section">
                    <h2>Endpoints Disponíveis</h2>
                    <div class="endpoint">GET /health</div>
                    <p>Verifica o status de saúde do serviço</p>

                    <div class="endpoint">POST /demands</div>
                    <p>Cria uma nova demanda de problema</p>

                    <div class="endpoint">GET /demands</div>
                    <p>Lista todas as demandas registradas</p>
                </div>

                <div class="section">
                    <h2>Como Testar</h2>
                    <p>Criar uma demanda:</p>
                    <div class="endpoint">
                        curl -X POST http://localhost:3001/demands \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Problema X", "description": "Descrição detalhada"}'
                    </div>
                </div>

                <div class="section">
                    <h2>Rastreabilidade</h2>
                    <p>Todas as requisições são rastreadas com um ID único (Correlation ID).</p>
                    <div class="correlationId">
                        <strong>Seu ID:</strong> ${req.correlationId}
                    </div>
                </div>

                <div class="section">
                    <p>
                        <strong>Fase:</strong> Desenvolvimento Local<br>
                        <strong>Stack:</strong> Node.js + Express<br>
                        <strong>Porta:</strong> 3001<br>
                        <strong>Persistência:</strong> SQLite (Stateless)
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

app.post('/demands', (req, res) => {
    const { title, description } = req.body;

    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const deadline = calculateBusinessDays(new Date(), 10).toISOString();
    const status = 'PENDENTE';
    const correlationId = req.correlationId;

    try {
        db.prepare(`
            INSERT INTO demands (id, title, description, status, createdAt, deadline, correlationId)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, title, description, status, createdAt, deadline, correlationId);

        const demand = {
            id,
            title,
            description,
            status,
            createdAt,
            deadline,
            correlationId
        };

        res.status(201).json(demand);
    } catch (error) {
        console.error('Error creating demand:', error.message);
        res.status(500).json({ error: 'Failed to create demand' });
    }
});

app.get('/demands', (req, res) => {
    try {
        const demands = db.prepare(`SELECT * FROM demands`).all();
        res.json(demands);
    } catch (error) {
        console.error('Error fetching demands:', error.message);
        res.status(500).json({ error: 'Failed to fetch demands' });
    }
});

app.patch('/demands/:id', (req, res) => {
    const { id } = req.params;
    const { title, description, status, deadline } = req.body;

    try {
        const demand = db.prepare(`SELECT * FROM demands WHERE id = ?`).get(id);

        if (!demand) {
            return res.status(404).json({ error: 'Demanda não encontrada' });
        }

        const updatedTitle = title || demand.title;
        const updatedDescription = description || demand.description;
        const updatedStatus = status || demand.status;
        const updatedDeadline = deadline || demand.deadline;

        db.prepare(`
            UPDATE demands SET title = ?, description = ?, status = ?, deadline = ?
            WHERE id = ?
        `).run(updatedTitle, updatedDescription, updatedStatus, updatedDeadline, id);

        const updated = {
            ...demand,
            title: updatedTitle,
            description: updatedDescription,
            status: updatedStatus,
            deadline: updatedDeadline
        };

        res.json(updated);
    } catch (error) {
        console.error('Error updating demand:', error.message);
        res.status(500).json({ error: 'Failed to update demand' });
    }
});

app.delete('/demands/:id', (req, res) => {
    const { id } = req.params;

    try {
        const demand = db.prepare(`SELECT * FROM demands WHERE id = ?`).get(id);

        if (!demand) {
            return res.status(404).json({ error: 'Demanda não encontrada' });
        }

        if (demand.status !== 'FINALIZADA') {
            return res.status(400).json({ error: 'Só é possível apagar demandas finalizadas' });
        }

        db.prepare(`DELETE FROM demands WHERE id = ?`).run(id);

        res.json({ message: 'Demanda finalizada apagada com sucesso' });
    } catch (error) {
        console.error('Error deleting demand:', error.message);
        res.status(500).json({ error: 'Failed to delete demand' });
    }
});

function calculateBusinessDays(startDate, businessDays) {
    let currentDate = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < businessDays) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
            daysAdded++;
        }
    }

    return currentDate;
}

app.listen(PORT, () => {
    console.log(`Demand Service running on port ${PORT}`);
});