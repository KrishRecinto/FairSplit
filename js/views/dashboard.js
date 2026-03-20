import { el, clearEl } from '../utils/dom.js';
import { computeBalances } from '../algorithms/settlement.js';

let chartInstance = null;

export function renderDashboard(container, trip) {
  clearEl(container);

  if (trip.expenses.length === 0) {
    container.appendChild(el('div', { className: 'empty-state' }, [
      el('p', { textContent: 'Add some expenses to see the dashboard.' })
    ]));
    return;
  }

  const balances = computeBalances(trip);
  const totalSpent = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const fairShare = totalSpent / trip.people.length;

  // Total trip cost
  container.appendChild(el('div', { className: 'card text-center' }, [
    el('div', { className: 'text-muted', style: { fontSize: '0.85rem' }, textContent: 'Total Trip Cost' }),
    el('div', { style: { fontSize: '1.8rem', fontWeight: '700', color: '#4f46e5' }, textContent: `${trip.currency}${totalSpent.toFixed(2)}` }),
    el('div', { className: 'text-muted', style: { fontSize: '0.85rem' }, textContent: `Fair share: ${trip.currency}${fairShare.toFixed(2)} per person` })
  ]));

  // Person summary cards
  container.appendChild(el('div', { className: 'section-title', textContent: 'Who Paid What' }));
  const cards = el('div', { className: 'summary-cards' });

  const paidByPerson = {};
  trip.people.forEach(p => { paidByPerson[p.id] = 0; });
  trip.expenses.forEach(exp => {
    paidByPerson[exp.paidBy] = (paidByPerson[exp.paidBy] || 0) + exp.amount;
  });

  const maxPaid = Math.max(...Object.values(paidByPerson), 1);

  trip.people.forEach(p => {
    const paid = paidByPerson[p.id] || 0;
    const net = Math.round(balances[p.id] * 100) / 100;

    const card = el('div', { className: 'person-card' }, [
      el('div', { className: 'name', textContent: p.name }),
      el('div', { className: 'stat' }, [
        el('span', { textContent: 'Total paid' }),
        el('span', { className: 'stat-value', textContent: `${trip.currency}${paid.toFixed(2)}` })
      ]),
      el('div', { className: 'stat' }, [
        el('span', { textContent: 'Fair share' }),
        el('span', { className: 'stat-value', textContent: `${trip.currency}${fairShare.toFixed(2)}` })
      ]),
      el('div', { className: `net ${net >= 0 ? 'positive' : 'negative'}`, textContent: net >= 0 ? `Owed ${trip.currency}${net.toFixed(2)}` : `Owes ${trip.currency}${Math.abs(net).toFixed(2)}` }),
      el('div', { className: 'bar-container' }, [
        el('div', { className: 'bar-fill', style: { width: `${(paid / maxPaid) * 100}%` } })
      ])
    ]);

    cards.appendChild(card);
  });

  container.appendChild(cards);

  // Category breakdown chart
  container.appendChild(el('div', { className: 'section-title', textContent: 'Spending by Category' }));
  const chartContainer = el('div', { className: 'chart-container' });
  const canvas = el('canvas', { id: 'categoryChart' });
  chartContainer.appendChild(canvas);
  container.appendChild(chartContainer);

  renderCategoryChart(canvas, trip, paidByPerson);

  // Top expenses
  container.appendChild(el('div', { className: 'section-title', textContent: 'Biggest Expenses' }));
  const table = el('table', { className: 'data-table' });
  const thead = el('thead', {}, [
    el('tr', {}, [
      el('th', { textContent: 'Description' }),
      el('th', { textContent: 'Amount' }),
      el('th', { textContent: 'Paid By' }),
      el('th', { textContent: 'Date' })
    ])
  ]);
  const tbody = el('tbody');

  const top5 = [...trip.expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
  top5.forEach(exp => {
    const payer = trip.people.find(p => p.id === exp.paidBy);
    tbody.appendChild(el('tr', {}, [
      el('td', { textContent: exp.description }),
      el('td', { style: { fontWeight: '600' }, textContent: `${trip.currency}${exp.amount.toFixed(2)}` }),
      el('td', { textContent: payer ? payer.name : '?' }),
      el('td', { textContent: exp.date })
    ]));
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(el('div', { className: 'card', style: { overflow: 'auto' } }, [table]));
}

function renderCategoryChart(canvas, trip) {
  if (chartInstance) chartInstance.destroy();

  const categories = {};
  const personCategories = {};

  trip.people.forEach(p => { personCategories[p.id] = {}; });

  trip.expenses.forEach(exp => {
    const cat = exp.category || 'other';
    categories[cat] = (categories[cat] || 0) + exp.amount;
    if (personCategories[exp.paidBy]) {
      personCategories[exp.paidBy][cat] = (personCategories[exp.paidBy][cat] || 0) + exp.amount;
    }
  });

  const catList = Object.keys(categories).sort((a, b) => categories[b] - categories[a]);
  const colors = ['#4f46e5', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899'];

  const datasets = catList.map((cat, i) => ({
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    data: trip.people.map(p => (personCategories[p.id][cat] || 0)),
    backgroundColor: colors[i % colors.length],
    borderRadius: 4
  }));

  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: trip.people.map(p => p.name),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, ticks: { callback: v => `${trip.currency}${v}` } }
      }
    }
  });
}
