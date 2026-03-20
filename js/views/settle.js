import { el, clearEl } from '../utils/dom.js';
import { computeBalances, computeSettlements } from '../algorithms/settlement.js';

export function renderSettle(container, trip) {
  clearEl(container);

  if (trip.expenses.length === 0) {
    container.appendChild(el('div', { className: 'empty-state' }, [
      el('p', { textContent: 'Add some expenses to calculate settlements.' })
    ]));
    return;
  }

  const balances = computeBalances(trip);
  const settlements = computeSettlements(balances, trip.people);

  // Net balances
  container.appendChild(el('div', { className: 'section-title', textContent: 'Net Balances' }));
  const balanceCard = el('div', { className: 'card' });

  trip.people.forEach(p => {
    const net = Math.round(balances[p.id] * 100) / 100;
    const row = el('div', { className: 'flex-between', style: { padding: '6px 0', borderBottom: '1px solid #f1f5f9' } }, [
      el('span', { style: { fontWeight: '500' }, textContent: p.name }),
      el('span', {
        className: net >= 0 ? 'net positive' : 'net negative',
        style: { fontWeight: '600' },
        textContent: net >= 0 ? `+${trip.currency}${net.toFixed(2)}` : `-${trip.currency}${Math.abs(net).toFixed(2)}`
      })
    ]);
    balanceCard.appendChild(row);
  });

  container.appendChild(balanceCard);

  // Settlements
  container.appendChild(el('div', { className: 'section-title', textContent: 'Settle Up' }));

  if (settlements.length === 0) {
    container.appendChild(el('div', { className: 'card text-center' }, [
      el('p', { style: { color: '#16a34a', fontWeight: '500' }, textContent: 'All settled! No payments needed.' })
    ]));
    return;
  }

  container.appendChild(el('div', { className: 'text-muted mb-8', style: { fontSize: '0.85rem' } },
    [`Only ${settlements.length} transaction${settlements.length > 1 ? 's' : ''} needed to settle up`]
  ));

  settlements.forEach(s => {
    const card = el('div', { className: 'settlement-card' });

    const fromEl = el('span', { style: { fontWeight: '500' }, textContent: s.fromName });
    const arrow = el('span', { className: 'settlement-arrow', textContent: '\u2192' });
    const toEl = el('span', { style: { fontWeight: '500' }, textContent: s.toName });
    const amount = el('span', { className: 'settlement-amount', textContent: `${trip.currency}${s.amount.toFixed(2)}` });

    const paidBtn = el('button', {
      className: 'btn btn-success btn-sm',
      textContent: 'Paid',
      onClick: () => {
        card.classList.toggle('paid');
        paidBtn.textContent = card.classList.contains('paid') ? 'Undo' : 'Paid';
      }
    });

    card.appendChild(fromEl);
    card.appendChild(arrow);
    card.appendChild(toEl);
    card.appendChild(amount);
    card.appendChild(paidBtn);
    container.appendChild(card);
  });
}
