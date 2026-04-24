const demandTable = document.getElementById('demand-table');
const createForm = document.getElementById('create-form');
const createResult = document.getElementById('create-result');
const logsContainer = document.getElementById('logs-container');
const alertsContainer = document.getElementById('alerts-container');
const logsStatus = document.getElementById('logs-status');

const demandBase = 'http://localhost:3001';
const checkerBase = 'http://localhost:3002';

async function fetchDemands() {
  const response = await fetch(`${demandBase}/demands`);
  return response.json();
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', { timeZone: 'UTC' });
}

async function refreshDemands() {
  const demands = await fetchDemands();
  demandTable.innerHTML = '';

  demands.forEach(demand => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${demand.title}</td>
      <td><span class="status-badge ${demand.status}">${demand.status.replace('_', ' ')}</span></td>
      <td><input type="date" value="${new Date(demand.deadline).toISOString().slice(0,10)}" data-id="${demand.id}" class="deadline-input" /></td>
      <td>${daysRemaining(demand.deadline)}</td>
      <td style="text-align: right;">
        <select data-id="${demand.id}" class="status-select" style="margin-right: 8px;">
          <option value="PENDENTE" ${demand.status === 'PENDENTE' ? 'selected' : ''}>PENDENTE</option>
          <option value="EM_TRATATIVA" ${demand.status === 'EM_TRATATIVA' ? 'selected' : ''}>EM_TRATATIVA</option>
          <option value="FINALIZADA" ${demand.status === 'FINALIZADA' ? 'selected' : ''}>FINALIZADA</option>
        </select>
        <button class="small-button update-button" data-id="${demand.id}" style="margin-right: 8px;">Salvar Status</button>
        ${demand.status === 'FINALIZADA' ? `<button class="small-button delete-button" data-id="${demand.id}">Apagar</button>` : ''}
      </td>
    `;
    demandTable.appendChild(row);
  });
}

function daysRemaining(deadline) {
  const today = new Date();
  const end = new Date(deadline);

  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const endUTC = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));

  let current = new Date(todayUTC);
  let businessDays = 0;

  while (current < endUTC) {
    current.setUTCDate(current.getUTCDate() + 1);
    if (current.getUTCDay() !== 0 && current.getUTCDay() !== 6) {
      businessDays++;
    }
  }

  return businessDays;
}

function buildCheckSummary(checks) {
  if (!checks || checks.length === 0) {
    return '<p>Nenhuma verificação recente disponível.</p>';
  }

  const rows = checks.map(check => {
    return `
      <tr>
        <td>${check.title}</td>
        <td>${check.status}</td>
        <td>${new Date(check.deadline).toLocaleString('pt-BR', { timeZone: 'UTC' })}</td>
        <td>${check.days_remaining}</td>
        <td>${check.alert_type || '-'}</td>
        <td>${check.message || '-'}</td>
      </tr>
    `;
  }).join('');

  return `
    <p><strong>Total de verificações:</strong> ${checks.length}</p>
    <table>
      <thead>
        <tr>
          <th>Demanda</th>
          <th>Status</th>
          <th>Deadline</th>
          <th>Dias restantes</th>
          <th>Tipo alerta</th>
          <th>Mensagem</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildAlertSummary(alerts) {
  if (!alerts || alerts.length === 0) {
    return '<p>Nenhum alerta enviado recentemente.</p>';
  }

  const rows = alerts.map(alert => {
    return `
      <tr>
        <td>${alert.demand_id}</td>
        <td>${alert.type}</td>
        <td>${alert.message}</td>
        <td>${new Date(alert.sent_at).toLocaleString('pt-BR', { timeZone: 'UTC' })}</td>
      </tr>
    `;
  }).join('');

  return `
    <p><strong>Total de alertas:</strong> ${alerts.length}</p>
    <table>
      <thead>
        <tr>
          <th>Demand ID</th>
          <th>Tipo</th>
          <th>Mensagem</th>
          <th>Enviado em</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function refreshLogs() {
  try {
    logsStatus.textContent = 'Carregando logs...';
    const response = await fetch(`${checkerBase}/logs`);
    const data = await response.json();
    logsStatus.textContent = '';

    logsContainer.innerHTML = buildCheckSummary(data.checks);
    alertsContainer.innerHTML = buildAlertSummary(data.alerts);
  } catch (error) {
    logsStatus.textContent = 'Erro ao carregar logs.';
    logsContainer.innerHTML = `<pre>${error.message}</pre>`;
  }
}

async function forceCheck() {
  logsStatus.textContent = 'Executando verificação...';
  logsContainer.innerHTML = '';
  alertsContainer.innerHTML = '';

  const response = await fetch(`${checkerBase}/check-deadlines`, { method: 'POST' });
  const data = await response.json();
  alert(`Verificação concluída: ${data.message}`);
  refreshLogs();
}

async function clearLogs() {
  const firstConfirm = confirm('ATENÇÃO: Esta ação irá apagar todos os logs e alertas do sistema!\n\nEsta é uma funcionalidade para demonstração acadêmica.\n\nTem certeza que deseja continuar?');
  if (!firstConfirm) return;

  const secondConfirm = confirm('ÚLTIMA CONFIRMAÇÃO: Todos os dados de logs e alertas serão perdidos para sempre!\n\nRealmente deseja prosseguir:');
  if (!secondConfirm) return;

  logsStatus.textContent = 'Limpando logs...';
  logsContainer.innerHTML = '';
  alertsContainer.innerHTML = '';

  try {
    const response = await fetch(`${checkerBase}/logs`, { method: 'DELETE' });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Falha ao limpar logs');
    }

    alert('Logs e alertas limpos com sucesso!');
    refreshLogs();
  } catch (error) {
    logsStatus.textContent = 'Erro ao limpar logs.';
    logsContainer.innerHTML = `<pre>${error.message}</pre>`;
  }
}

createForm.addEventListener('submit', async event => {
  event.preventDefault();
  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;

  try {
    const response = await fetch(`${demandBase}/demands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });

    const data = await response.json();

    if (!response.ok) {
      createResult.innerHTML = `<div class="alert-error">Erro: ${data.error || 'Falha ao criar demanda'}</div>`;
      return;
    }

    createResult.innerHTML = `<div class="alert-warning">Demanda criada: ${data.id}</div>`;
    createForm.reset();
    refreshDemands();
  } catch (error) {
    createResult.innerHTML = `<div class="alert-error">Erro de conexão: ${error.message}</div>`;
  }
});

window.addEventListener('click', async event => {
  if (event.target.classList.contains('update-button')) {
    const id = event.target.dataset.id;
    const row = event.target.closest('tr');
    const statusSelect = row.querySelector('.status-select').value;

    await fetch(`${demandBase}/demands/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusSelect })
    });

    refreshDemands();
  }

  if (event.target.classList.contains('delete-button')) {
    const id = event.target.dataset.id;
    const confirmed = confirm('Tem certeza que deseja apagar esta demanda finalizada?');
    if (!confirmed) return;

    const response = await fetch(`${demandBase}/demands/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json();

    if (!response.ok) {
      alert(`Erro ao apagar demanda: ${data.error || 'falha'}`);
      return;
    }

    alert(data.message);
    refreshDemands();
  }
});

window.addEventListener('change', async event => {
  if (event.target.classList.contains('deadline-input')) {
    const id = event.target.dataset.id;
    const deadlineInput = event.target.value;

    const deadlineDate = new Date(deadlineInput);
    deadlineDate.setHours(0, 0, 0, 0);

    await fetch(`${demandBase}/demands/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deadline: deadlineDate.toISOString() })
    });

    refreshDemands();
  }
});

document.getElementById('refresh-demands').addEventListener('click', refreshDemands);
document.getElementById('force-check').addEventListener('click', forceCheck);
document.getElementById('clear-logs').addEventListener('click', clearLogs);

refreshDemands();
refreshLogs();
setInterval(refreshLogs, 30000);