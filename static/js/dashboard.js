// dashboard.js
// Smart frontend: prefer backend API, fallback to localStorage

const API_BASE = '/api/transactions';
const LS_KEY = 'pft_transactions_v1';

let transactions = [];
let chart = null;

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  loadData();
});

// ================= UI =================
function initUI() {
  const form = document.getElementById('transactionForm');
  if (form) {
    form.addEventListener('submit', handleAdd);
  }

  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', trySyncLocalToServer);
  }
}

// ================= DATA =================
async function loadData() {
  try {
    const res = await fetch(API_BASE);
    if (res.ok) {
      transactions = await res.json();
      if (!Array.isArray(transactions)) transactions = [];
      renderAll();
      return;
    }
  } catch (err) {
    console.warn('Backend unavailable, using localStorage');
  }

  const raw = localStorage.getItem(LS_KEY);
  transactions = raw ? JSON.parse(raw) : [];
  renderAll();
}

// ================= ADD =================
async function handleAdd(e) {
  e.preventDefault();

  const date = document.getElementById('date').value;
  const description = document.getElementById('description').value.trim();
  const category = document.getElementById('category').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const type = document.getElementById('type').value;

  if (!date || !description || !category || isNaN(amount)) {
    alert('Please fill all fields correctly');
    return;
  }

  const tx = { date, description, category, amount, type };

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx)
    });

    if (res.ok) {
      clearForm();
      loadData();
      return;
    }
  } catch (err) {
    console.warn('Server unreachable, saving locally');
  }

  tx.id = generateLocalId();
  saveLocal(tx);
  clearForm();
  renderAll();
}

// ================= DELETE =================
async function deleteTransaction(id) {
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadData();
      return;
    }
  } catch (err) {
    console.warn('Delete failed, removing locally');
  }

  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return;

  let arr = JSON.parse(raw);
  arr = arr.filter(t => t.id !== id);
  localStorage.setItem(LS_KEY, JSON.stringify(arr));

  transactions = transactions.filter(t => t.id !== id);
  renderAll();
}

// ================= LOCAL STORAGE =================
function generateLocalId() {
  return Date.now() * -1;
}

function saveLocal(tx) {
  const raw = localStorage.getItem(LS_KEY);
  const arr = raw ? JSON.parse(raw) : [];
  arr.unshift(tx);
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
  transactions.unshift(tx);
}

async function trySyncLocalToServer() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    alert('No local data to sync');
    return;
  }

  const arr = JSON.parse(raw);
  let uploaded = 0;

  for (const t of arr) {
    if (t.id > 0) continue;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t)
      });
      if (res.ok) uploaded++;
    } catch {
      alert('Sync failed: server unreachable');
      return;
    }
  }

  if (uploaded > 0) {
    localStorage.removeItem(LS_KEY);
    loadData();
    alert(`Synced ${uploaded} transactions`);
  }
}

// ================= RENDER =================
function renderAll() {
  renderTable();
  updateTotals();
  updateChart();
}

function renderTable() {
  const table = document.getElementById('transactionsTable');
  if (!table) return;

  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';

  if (!transactions.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted center">No transactions yet</td></tr>`;
    return;
  }

  transactions.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(t.date)}</td>
      <td>${escapeHtml(t.description)}</td>
      <td>${escapeHtml(t.category)}</td>
      <td>${formatCurrency(t.amount)}</td>
      <td>${escapeHtml(t.type)}</td>
      <td>
        <button class="btn ghost" onclick="deleteTransaction(${t.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateTotals() {
  const incomeEl = document.getElementById('totalIncome');
  const expenseEl = document.getElementById('totalExpense');
  const balanceEl = document.getElementById('balance');

  if (!incomeEl || !expenseEl || !balanceEl) return;

  let income = 0, expense = 0;
  transactions.forEach(t => {
    if (t.type === 'income') income += Number(t.amount);
    else expense += Number(t.amount);
  });

  incomeEl.textContent = formatCurrency(income);
  expenseEl.textContent = formatCurrency(expense);
  balanceEl.textContent = formatCurrency(income - expense);
}

function updateChart() {
  const canvas = document.getElementById('expenseChart');
  if (!canvas) return;

  const map = {};
  transactions.forEach(t => {
    if (t.type !== 'expense') return;
    map[t.category] = (map[t.category] || 0) + Number(t.amount);
  });

  const labels = Object.keys(map);
  const data = labels.map(k => map[k]);

  if (chart) chart.destroy();

  chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map(() => randomColor()),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// ================= UTIL =================
function clearForm() {
  const form = document.getElementById('transactionForm');
  if (form) form.reset();
}

function formatCurrency(n) {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  );
}

function randomColor() {
  const colors = ['#60a5fa', '#34d399', '#f97316', '#f472b6', '#facc15', '#7c3aed'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// expose delete
window.deleteTransaction = deleteTransaction;
