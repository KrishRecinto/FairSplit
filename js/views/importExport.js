import { el, clearEl } from '../utils/dom.js';
import { computeSettlements, computeBalances } from '../algorithms/settlement.js';
import * as store from '../models/store.js';

export function renderImportExport(container, trip) {
  clearEl(container);

  if (trip.expenses.length === 0) {
    container.appendChild(el('div', { className: 'empty-state' }, [
      el('div', { className: 'empty-state-icon', textContent: '🧾' }),
      el('h3', { textContent: 'No expenses yet' }),
      el('p', { textContent: 'Add some expenses to see your receipt and settle up.' })
    ]));
  } else {
    renderReceipt(container, trip);
  }
}

function renderReceipt(container, trip) {
  const sorted = [...trip.expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
  const totalSpent = sorted.reduce((s, e) => s + e.amount, 0);
  const balances = computeBalances(trip);
  const settlements = computeSettlements(balances, trip.people);

  // Date range
  let dateRange = '';
  if (sorted.length > 0) {
    const first = sorted[0].date;
    const last = sorted[sorted.length - 1].date;
    dateRange = first === last ? first : `${first} – ${last}`;
  }

  // --- Trip header ---
  const headerCard = el('div', { className: 'receipt-trip-header' });
  headerCard.appendChild(el('div', { className: 'receipt-trip-name', textContent: trip.name }));
  if (dateRange) {
    headerCard.appendChild(el('div', { className: 'receipt-trip-date', textContent: dateRange }));
  }
  headerCard.appendChild(el('div', { className: 'receipt-trip-members', textContent: trip.people.map(p => p.name).join(' · ') }));
  container.appendChild(headerCard);

  // --- Settle Up (hero) ---
  if (settlements.length === 0) {
    container.appendChild(el('div', { className: 'settle-hero-done' }, [
      el('div', { style: { fontSize: '2rem', marginBottom: '4px' }, textContent: '\u2713' }),
      el('div', { style: { fontWeight: '700', fontSize: '1.1rem', marginBottom: '2px' }, textContent: 'All Settled!' }),
      el('div', { style: { fontSize: '0.85rem', opacity: '0.8' }, textContent: 'No payments needed' })
    ]));
  } else {
    container.appendChild(
      el('div', { className: 'text-muted mb-8', style: { fontSize: '0.85rem', marginTop: '16px' } },
        [`${settlements.length} payment${settlements.length > 1 ? 's' : ''} to settle up`]
      )
    );

    settlements.forEach(s => {
      const card = el('div', { className: 'settle-hero-card' });
      const paidBtn = el('button', {
        className: 'btn btn-primary btn-sm',
        textContent: 'Mark Paid',
        onClick: () => {
          card.classList.toggle('paid');
          const isPaid = card.classList.contains('paid');
          paidBtn.textContent = isPaid ? 'Undo' : 'Mark Paid';
          paidBtn.className = isPaid ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
        }
      });

      const names = el('div', { className: 'settle-hero-names' }, [
        el('span', { className: 'settle-from', textContent: s.fromName }),
        el('span', { className: 'settle-hero-arrow', textContent: '\u2192' }),
        el('span', { className: 'settle-to', textContent: s.toName })
      ]);

      card.appendChild(names);
      card.appendChild(el('span', { className: 'settle-hero-amount', textContent: `${trip.currency}${s.amount.toFixed(2)}` }));
      card.appendChild(paidBtn);
      container.appendChild(card);
    });
  }

  // --- Expenses (collapsible) ---
  const expBody = el('div', { style: { display: 'none' } });
  const expToggle = el('div', {
    className: 'expenses-accordion-toggle',
    onClick: () => {
      if (expBody.style.display === 'none') {
        expBody.style.display = 'block';
        expToggle.querySelector('.expenses-chevron').textContent = '\u25BE';
      } else {
        expBody.style.display = 'none';
        expToggle.querySelector('.expenses-chevron').textContent = '\u25B8';
      }
    }
  }, [
    el('span', {}, [
      el('span', { className: 'expenses-chevron', textContent: '\u25B8' }),
      document.createTextNode(' Expenses')
    ]),
    el('span', { className: 'expenses-accordion-summary', textContent: `${sorted.length} expense${sorted.length !== 1 ? 's' : ''} \u00B7 Total: ${trip.currency}${totalSpent.toFixed(2)}` })
  ]);
  container.appendChild(expToggle);

  const expCard = el('div', { className: 'card', style: { padding: '0', overflow: 'hidden' } });
  const table = el('table', { className: 'data-table' });
  const thead = el('thead', {}, [
    el('tr', {}, [
      el('th', { textContent: 'Description' }),
      el('th', { textContent: 'Paid By' }),
      el('th', { style: { textAlign: 'right' }, textContent: 'Amount' })
    ])
  ]);
  const tbody = el('tbody');

  sorted.forEach(exp => {
    const payer = trip.people.find(p => p.id === exp.paidBy);
    tbody.appendChild(el('tr', {}, [
      el('td', { textContent: exp.description }),
      el('td', { style: { color: 'var(--text-muted)', fontSize: '0.85rem' }, textContent: payer ? payer.name : '?' }),
      el('td', { style: { textAlign: 'right', fontWeight: '600' }, textContent: `${trip.currency}${exp.amount.toFixed(2)}` })
    ]));
  });

  // Total row
  tbody.appendChild(el('tr', { className: 'receipt-total-row' }, [
    el('td', { textContent: 'Total' }),
    el('td'),
    el('td', { style: { textAlign: 'right' }, textContent: `${trip.currency}${totalSpent.toFixed(2)}` })
  ]));

  table.appendChild(thead);
  table.appendChild(tbody);
  expCard.appendChild(table);
  expBody.appendChild(expCard);
  container.appendChild(expBody);
}

