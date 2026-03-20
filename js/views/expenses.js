import { el, clearEl, todayStr } from '../utils/dom.js';
import { formatMoney, computeSplitAmounts } from '../utils/currency.js';
import { createExpense, equalSplits, CATEGORIES } from '../models/expense.js';
import * as store from '../models/store.js';

let editingExpenseId = null;

export function renderExpenses(container, trip) {
  clearEl(container);
  editingExpenseId = null;
  container.appendChild(buildExpenseForm(trip, container));
  container.appendChild(el('div', { className: 'section-title', textContent: 'Expenses' }));
  container.appendChild(buildExpenseList(trip, container));
}

function buildExpenseForm(trip, rootContainer) {
  const card = el('div', { className: 'card' });
  card.innerHTML = `<div class="card-title" id="formTitle">Add Expense</div>`;

  const descInput = el('input', { type: 'text', placeholder: 'What was this for?', id: 'expDesc' });
  const amountInput = el('input', { type: 'number', placeholder: '0.00', step: '0.01', min: '0', id: 'expAmount' });
  const dateInput = el('input', { type: 'date', value: todayStr(), id: 'expDate' });
  const categorySelect = el('select', { id: 'expCategory' });
  CATEGORIES.forEach(c => {
    categorySelect.appendChild(el('option', { value: c, textContent: c.charAt(0).toUpperCase() + c.slice(1) }));
  });

  const paidBySelect = el('select', { id: 'expPaidBy' });
  trip.people.forEach(p => {
    paidBySelect.appendChild(el('option', { value: p.id, textContent: p.name }));
  });

  card.appendChild(el('div', { className: 'form-group' }, [
    el('label', { textContent: 'Description' }), descInput
  ]));

  card.appendChild(el('div', { className: 'form-row' }, [
    el('div', { className: 'form-group' }, [
      el('label', { textContent: `Amount (${trip.currency})` }), amountInput
    ]),
    el('div', { className: 'form-group' }, [
      el('label', { textContent: 'Date' }), dateInput
    ])
  ]));

  card.appendChild(el('div', { className: 'form-row' }, [
    el('div', { className: 'form-group' }, [
      el('label', { textContent: 'Category' }), categorySelect
    ]),
    el('div', { className: 'form-group' }, [
      el('label', { textContent: 'Paid by' }), paidBySelect
    ])
  ]));

  // Split type toggle
  let splitType = 'equal';
  const equalBtn = el('button', { className: 'active', textContent: 'Equal Split' });
  const customBtn = el('button', { textContent: 'Custom Split' });
  const toggle = el('div', { className: 'split-toggle' }, [equalBtn, customBtn]);

  const splitContainer = el('div', { id: 'splitContainer' });

  equalBtn.onclick = () => {
    splitType = 'equal';
    equalBtn.className = 'active';
    customBtn.className = '';
    renderSplitInputs(splitContainer, trip, splitType, amountInput);
  };

  customBtn.onclick = () => {
    splitType = 'custom';
    customBtn.className = 'active';
    equalBtn.className = '';
    renderSplitInputs(splitContainer, trip, splitType, amountInput);
  };

  card.appendChild(el('div', { className: 'form-group' }, [
    el('label', { textContent: 'Split' }), toggle
  ]));

  card.appendChild(splitContainer);
  renderSplitInputs(splitContainer, trip, splitType, amountInput);

  amountInput.addEventListener('input', () => {
    updateSplitAmounts(splitContainer, amountInput);
  });

  // Remaining indicator
  const remaining = el('div', { className: 'split-remaining', id: 'splitRemaining' });
  card.appendChild(remaining);

  // Buttons
  const saveBtn = el('button', {
    className: 'btn btn-primary',
    textContent: 'Add Expense',
    id: 'saveExpBtn',
    onClick: () => {
      const desc = descInput.value.trim();
      const amount = parseFloat(amountInput.value);
      if (!desc) { descInput.focus(); return; }
      if (!amount || amount <= 0) { amountInput.focus(); return; }

      const splits = getSplitsFromInputs(splitContainer, trip, splitType);
      if (!splits) return;

      const totalPct = splits.reduce((s, sp) => s + sp.percent, 0);
      if (Math.abs(totalPct - 100) > 0.1) {
        alert('Split percentages must add up to 100%');
        return;
      }

      const activeTrip = store.getActiveTrip();
      if (editingExpenseId) {
        const idx = activeTrip.expenses.findIndex(e => e.id === editingExpenseId);
        if (idx >= 0) {
          activeTrip.expenses[idx].description = desc;
          activeTrip.expenses[idx].amount = amount;
          activeTrip.expenses[idx].date = dateInput.value;
          activeTrip.expenses[idx].category = categorySelect.value;
          activeTrip.expenses[idx].paidBy = paidBySelect.value;
          activeTrip.expenses[idx].splits = splits;
        }
        editingExpenseId = null;
      } else {
        const expense = createExpense(desc, amount, paidBySelect.value, splits, categorySelect.value, dateInput.value);
        activeTrip.expenses.push(expense);
      }

      store.saveTrip(activeTrip);
      renderExpenses(rootContainer, activeTrip);
    }
  });

  const cancelBtn = el('button', {
    className: 'btn btn-secondary',
    textContent: 'Cancel',
    style: { display: 'none' },
    id: 'cancelExpBtn',
    onClick: () => {
      editingExpenseId = null;
      renderExpenses(rootContainer, store.getActiveTrip());
    }
  });

  card.appendChild(el('div', { className: 'flex gap-8 mt-8' }, [saveBtn, cancelBtn]));

  return card;
}

function renderSplitInputs(container, trip, splitType, amountInput) {
  clearEl(container);

  trip.people.forEach(p => {
    const row = el('div', { className: 'split-row', 'data-person-id': p.id });
    row.appendChild(el('span', { className: 'person-name', textContent: p.name }));

    if (splitType === 'equal') {
      const cb = el('input', {
        type: 'checkbox',
        checked: 'checked',
        className: 'split-checkbox',
        'data-person-id': p.id,
      });
      cb.addEventListener('change', () => updateEqualSplits(container, amountInput));
      row.appendChild(cb);
    } else {
      const pctInput = el('input', {
        type: 'number',
        className: 'split-pct',
        value: (100 / trip.people.length).toFixed(1),
        min: '0',
        max: '100',
        step: '0.1',
        'data-person-id': p.id
      });
      pctInput.addEventListener('input', () => {
        updateCustomRemaining(container);
        updateSplitAmounts(container, amountInput);
      });
      row.appendChild(pctInput);
      row.appendChild(el('span', { textContent: '%', style: { fontSize: '0.85rem', color: '#64748b' } }));
    }

    row.appendChild(el('span', { className: 'split-amount', 'data-amount-for': p.id }));
    container.appendChild(row);
  });

  updateSplitAmounts(container, amountInput);
  if (splitType === 'custom') updateCustomRemaining(container);
}

function updateEqualSplits(container, amountInput) {
  updateSplitAmounts(container, amountInput);
}

function updateSplitAmounts(container, amountInput) {
  const amount = parseFloat(amountInput.value) || 0;
  const rows = container.querySelectorAll('.split-row');
  const checkboxes = container.querySelectorAll('.split-checkbox');
  const pctInputs = container.querySelectorAll('.split-pct');

  if (checkboxes.length > 0) {
    // Equal mode
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    const perPerson = checked.length > 0 ? amount / checked.length : 0;
    rows.forEach(row => {
      const pid = row.getAttribute('data-person-id');
      const cb = row.querySelector('.split-checkbox');
      const amountEl = row.querySelector('.split-amount');
      if (cb && cb.checked) {
        amountEl.textContent = formatMoney(perPerson);
      } else if (amountEl) {
        amountEl.textContent = formatMoney(0);
      }
    });
  } else if (pctInputs.length > 0) {
    // Custom mode
    rows.forEach(row => {
      const pctInput = row.querySelector('.split-pct');
      const amountEl = row.querySelector('.split-amount');
      if (pctInput && amountEl) {
        const pct = parseFloat(pctInput.value) || 0;
        amountEl.textContent = formatMoney(amount * pct / 100);
      }
    });
  }
}

function updateCustomRemaining(container) {
  const pctInputs = container.querySelectorAll('.split-pct');
  let total = 0;
  pctInputs.forEach(inp => { total += parseFloat(inp.value) || 0; });
  const rem = document.getElementById('splitRemaining');
  if (rem) {
    const diff = 100 - total;
    if (Math.abs(diff) < 0.1) {
      rem.textContent = 'Splits add up to 100%';
      rem.className = 'split-remaining valid';
    } else {
      rem.textContent = `${diff > 0 ? diff.toFixed(1) + '% remaining' : Math.abs(diff).toFixed(1) + '% over'}`;
      rem.className = 'split-remaining invalid';
    }
  }
}

function getSplitsFromInputs(container, trip, splitType) {
  const splits = [];

  if (splitType === 'equal') {
    const checkboxes = container.querySelectorAll('.split-checkbox');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    if (checked.length === 0) {
      alert('Select at least one person for the split.');
      return null;
    }
    const pct = 100 / checked.length;
    checked.forEach(cb => {
      splits.push({ personId: cb.getAttribute('data-person-id'), percent: pct });
    });
  } else {
    const pctInputs = container.querySelectorAll('.split-pct');
    pctInputs.forEach(inp => {
      const pct = parseFloat(inp.value) || 0;
      if (pct > 0) {
        splits.push({ personId: inp.getAttribute('data-person-id'), percent: pct });
      }
    });
  }

  return splits;
}

function buildExpenseList(trip, rootContainer) {
  const list = el('div', { id: 'expenseList' });

  if (trip.expenses.length === 0) {
    list.appendChild(el('div', { className: 'empty-state' }, [
      el('p', { textContent: 'No expenses yet. Add your first expense above.' })
    ]));
    return list;
  }

  const sorted = [...trip.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(exp => {
    const payer = trip.people.find(p => p.id === exp.paidBy);
    const item = el('div', { className: 'expense-item' });

    const header = el('div', { className: 'expense-header' });
    header.appendChild(el('div', { className: 'expense-info' }, [
      el('div', { className: 'expense-desc', textContent: exp.description }),
      el('div', { className: 'expense-meta', textContent: `${payer ? payer.name : '?'} paid · ${exp.date}` }),
    ]));
    header.appendChild(el('span', { className: 'category-tag', textContent: exp.category }));
    header.appendChild(el('div', { className: 'expense-amount', textContent: `${trip.currency}${exp.amount.toFixed(2)}` }));

    const details = el('div', { className: 'expense-details' });

    const totalPct = exp.splits.reduce((s, sp) => s + sp.percent, 0);
    exp.splits.forEach(sp => {
      const person = trip.people.find(p => p.id === sp.personId);
      const amount = exp.amount * sp.percent / totalPct;
      details.appendChild(el('div', { className: 'expense-detail-row' }, [
        el('span', { textContent: person ? person.name : '?' }),
        el('span', { textContent: `${sp.percent.toFixed(1)}% — ${trip.currency}${amount.toFixed(2)}` })
      ]));
    });

    const actions = el('div', { className: 'expense-actions' }, [
      el('button', {
        className: 'btn btn-secondary btn-sm',
        textContent: 'Edit',
        onClick: (e) => {
          e.stopPropagation();
          startEdit(exp, trip, rootContainer);
        }
      }),
      el('button', {
        className: 'btn btn-danger btn-sm',
        textContent: 'Delete',
        onClick: (e) => {
          e.stopPropagation();
          if (confirm(`Delete "${exp.description}"?`)) {
            const t = store.getActiveTrip();
            t.expenses = t.expenses.filter(ex => ex.id !== exp.id);
            store.saveTrip(t);
            renderExpenses(rootContainer, t);
          }
        }
      })
    ]);
    details.appendChild(actions);

    header.onclick = () => details.classList.toggle('open');
    item.appendChild(header);
    item.appendChild(details);
    list.appendChild(item);
  });

  return list;
}

function startEdit(expense, trip, rootContainer) {
  editingExpenseId = expense.id;
  renderExpenses(rootContainer, trip);

  // Populate form
  setTimeout(() => {
    document.getElementById('formTitle').textContent = 'Edit Expense';
    document.getElementById('expDesc').value = expense.description;
    document.getElementById('expAmount').value = expense.amount;
    document.getElementById('expDate').value = expense.date;
    document.getElementById('expCategory').value = expense.category;
    document.getElementById('expPaidBy').value = expense.paidBy;
    document.getElementById('saveExpBtn').textContent = 'Update Expense';
    document.getElementById('cancelExpBtn').style.display = 'inline-flex';

    // Check if custom split
    const isEqual = expense.splits.length > 0 &&
      expense.splits.every(s => Math.abs(s.percent - expense.splits[0].percent) < 0.1);

    if (!isEqual) {
      // Trigger custom mode
      const toggle = document.querySelector('.split-toggle');
      if (toggle) {
        toggle.children[1].click(); // custom button
        setTimeout(() => {
          expense.splits.forEach(sp => {
            const input = document.querySelector(`.split-pct[data-person-id="${sp.personId}"]`);
            if (input) input.value = sp.percent.toFixed(1);
          });
          // Set others to 0
          document.querySelectorAll('.split-pct').forEach(inp => {
            const pid = inp.getAttribute('data-person-id');
            if (!expense.splits.find(s => s.personId === pid)) {
              inp.value = '0';
            }
          });
          updateCustomRemaining(document.getElementById('splitContainer'));
        }, 50);
      }
    }
  }, 50);
}
