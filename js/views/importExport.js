import { el, clearEl, generateId } from '../utils/dom.js';
import { parseExpenseCsv, exportExpensesCsv, downloadCsv } from '../utils/csv.js';
import { computeSettlements, computeBalances } from '../algorithms/settlement.js';
import * as store from '../models/store.js';

export function renderImportExport(container, trip) {
  clearEl(container);

  // Import section
  container.appendChild(el('div', { className: 'section-title', textContent: 'Import Expenses' }));

  const fileInput = el('input', { type: 'file', accept: '.csv' });
  const dropZone = el('div', { className: 'file-drop' }, [
    fileInput,
    el('div', { className: 'file-drop-text' }, [
      el('strong', { textContent: 'Click to upload' }),
      document.createTextNode(' or drag and drop a CSV file')
    ]),
    el('div', { className: 'text-muted', style: { fontSize: '0.8rem', marginTop: '6px' }, textContent: 'Columns: date, description, amount, category, paid_by, split_type, split_details' })
  ]);

  dropZone.onclick = () => fileInput.click();
  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
  dropZone.ondragleave = () => dropZone.classList.remove('dragover');
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, trip, container);
  };

  fileInput.onchange = () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0], trip, container);
  };

  container.appendChild(dropZone);

  const previewArea = el('div', { id: 'importPreview' });
  container.appendChild(previewArea);

  // Export section
  container.appendChild(el('div', { className: 'section-title', textContent: 'Export' }));

  const exportCard = el('div', { className: 'card' }, [
    el('div', { className: 'flex gap-8', style: { flexWrap: 'wrap' } }, [
      el('button', {
        className: 'btn btn-primary',
        textContent: 'View Receipt',
        onClick: () => {
          showReceipt(trip, container);
        }
      }),
      el('button', {
        className: 'btn btn-secondary',
        textContent: 'Export CSV',
        onClick: () => {
          const csv = exportExpensesCsv(trip);
          downloadCsv(csv, `${trip.name.replace(/\s+/g, '_')}_expenses.csv`);
        }
      }),
      el('button', {
        className: 'btn btn-secondary',
        textContent: 'Export Settlements CSV',
        onClick: () => {
          const balances = computeBalances(trip);
          const settlements = computeSettlements(balances, trip.people);
          const rows = settlements.map(s => ({
            from: s.fromName,
            to: s.toName,
            amount: s.amount.toFixed(2)
          }));
          const csv = Papa.unparse(rows);
          downloadCsv(csv, `${trip.name.replace(/\s+/g, '_')}_settlements.csv`);
        }
      })
    ])
  ]);

  container.appendChild(exportCard);

  // Receipt container
  const receiptArea = el('div', { id: 'receiptArea' });
  container.appendChild(receiptArea);

  // CSV format help
  container.appendChild(el('div', { className: 'section-title', textContent: 'CSV Format Guide' }));
  const help = el('div', { className: 'card' });
  help.innerHTML = `
    <div style="font-size:0.85rem; line-height:1.7">
      <strong>Required columns:</strong> date, description, amount, paid_by<br>
      <strong>Optional columns:</strong> category, split_type, split_details<br><br>
      <strong>split_type:</strong> "equal" (default) or "custom"<br>
      <strong>split_details:</strong> For custom splits, use "Name:Percent,Name:Percent"<br><br>
      <strong>Example:</strong><br>
      <code style="background:#f1f5f9; padding:8px; display:block; border-radius:6px; font-size:0.8rem; overflow-x:auto; white-space:nowrap">
2026-03-15,Hotel,450.00,accommodation,Alice,custom,"Alice:50,Bob:30,Charlie:20"</code>
    </div>
  `;
  container.appendChild(help);
}

function handleFile(file, trip, rootContainer) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const { expenses, errors } = parseExpenseCsv(text, trip);
    showPreview(expenses, errors, trip, rootContainer);
  };
  reader.readAsText(file);
}

function showPreview(expenses, errors, trip, rootContainer) {
  const preview = document.getElementById('importPreview');
  if (!preview) return;
  clearEl(preview);

  if (errors.length > 0) {
    errors.forEach(err => {
      preview.appendChild(el('div', { className: 'validation-msg error', textContent: err }));
    });
  }

  if (expenses.length === 0) {
    preview.appendChild(el('div', { className: 'validation-msg error', textContent: 'No valid expenses found in CSV.' }));
    return;
  }

  preview.appendChild(el('div', { className: 'validation-msg success', textContent: `${expenses.length} expense(s) ready to import` }));

  // Preview table
  const table = el('table', { className: 'data-table' });
  const thead = el('thead', {}, [
    el('tr', {}, [
      el('th', { textContent: 'Description' }),
      el('th', { textContent: 'Amount' }),
      el('th', { textContent: 'Paid By' }),
      el('th', { textContent: 'Split' })
    ])
  ]);
  const tbody = el('tbody');

  expenses.forEach(exp => {
    const payer = trip.people.find(p => p.id === exp.paidBy);
    const splitDesc = exp.splits.map(s => {
      const person = trip.people.find(p => p.id === s.personId);
      return `${person ? person.name : '?'}: ${s.percent}%`;
    }).join(', ');

    tbody.appendChild(el('tr', {}, [
      el('td', { textContent: exp.description }),
      el('td', { textContent: `${trip.currency}${exp.amount.toFixed(2)}` }),
      el('td', { textContent: payer ? payer.name : '?' }),
      el('td', { style: { fontSize: '0.8rem' }, textContent: splitDesc })
    ]));
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  preview.appendChild(el('div', { className: 'card', style: { overflow: 'auto' } }, [table]));

  preview.appendChild(el('button', {
    className: 'btn btn-primary btn-block mt-8',
    textContent: `Import ${expenses.length} Expense(s)`,
    onClick: () => {
      const activeTrip = store.getActiveTrip();
      expenses.forEach(exp => {
        activeTrip.expenses.push({
          id: generateId('exp'),
          ...exp
        });
      });
      store.saveTrip(activeTrip);
      renderImportExport(rootContainer, activeTrip);
    }
  }));
}

function showReceipt(trip, rootContainer) {
  const area = document.getElementById('receiptArea');
  if (!area) return;
  clearEl(area);

  const sorted = [...trip.expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
  const totalSpent = sorted.reduce((s, e) => s + e.amount, 0);
  const balances = computeBalances(trip);
  const settlements = computeSettlements(balances, trip.people);

  // Date range
  let dateRange = '';
  if (sorted.length > 0) {
    const first = sorted[0].date;
    const last = sorted[sorted.length - 1].date;
    dateRange = first === last ? first : `${first}  to  ${last}`;
  }

  // Per-person totals (what they paid)
  const paidTotals = {};
  const owesTotals = {};
  trip.people.forEach(p => { paidTotals[p.id] = 0; owesTotals[p.id] = 0; });
  trip.expenses.forEach(exp => {
    paidTotals[exp.paidBy] = (paidTotals[exp.paidBy] || 0) + exp.amount;
    const totalPct = exp.splits.reduce((s, sp) => s + sp.percent, 0);
    exp.splits.forEach(sp => {
      owesTotals[sp.personId] = (owesTotals[sp.personId] || 0) + (exp.amount * sp.percent / totalPct);
    });
  });

  const receipt = el('div', { className: 'receipt' });

  // Header
  const header = el('div', { className: 'receipt-header' });
  header.appendChild(el('div', { className: 'receipt-title', textContent: trip.name }));
  if (dateRange) {
    header.appendChild(el('div', { className: 'receipt-date', textContent: dateRange }));
  }
  header.appendChild(el('div', { className: 'receipt-people', textContent: trip.people.map(p => p.name).join('  \u00b7  ') }));
  receipt.appendChild(header);

  receipt.appendChild(el('div', { className: 'receipt-divider' }));

  // Itemized expenses
  const itemsHeader = el('div', { className: 'receipt-row receipt-row-header' });
  itemsHeader.appendChild(el('span', { textContent: 'ITEM' }));
  itemsHeader.appendChild(el('span', { textContent: 'PAID BY' }));
  itemsHeader.appendChild(el('span', { textContent: 'AMOUNT' }));
  receipt.appendChild(itemsHeader);

  receipt.appendChild(el('div', { className: 'receipt-divider-thin' }));

  sorted.forEach(exp => {
    const payer = trip.people.find(p => p.id === exp.paidBy);
    const row = el('div', { className: 'receipt-row' });
    row.appendChild(el('span', { className: 'receipt-item-desc', textContent: exp.description }));
    row.appendChild(el('span', { className: 'receipt-item-payer', textContent: payer ? payer.name : '?' }));
    row.appendChild(el('span', { className: 'receipt-item-amount', textContent: `${trip.currency}${exp.amount.toFixed(2)}` }));
    receipt.appendChild(row);
  });

  receipt.appendChild(el('div', { className: 'receipt-divider' }));

  // Total
  const totalRow = el('div', { className: 'receipt-row receipt-total' });
  totalRow.appendChild(el('span', { textContent: 'TOTAL' }));
  totalRow.appendChild(el('span'));
  totalRow.appendChild(el('span', { textContent: `${trip.currency}${totalSpent.toFixed(2)}` }));
  receipt.appendChild(totalRow);

  receipt.appendChild(el('div', { className: 'receipt-divider' }));

  // Per person breakdown
  receipt.appendChild(el('div', { className: 'receipt-section-title', textContent: 'PER PERSON' }));
  receipt.appendChild(el('div', { className: 'receipt-divider-thin' }));

  trip.people.forEach(p => {
    const paid = paidTotals[p.id] || 0;
    const owes = owesTotals[p.id] || 0;
    const net = paid - owes;
    const row = el('div', { className: 'receipt-row' });
    row.appendChild(el('span', { textContent: p.name }));
    row.appendChild(el('span', { className: 'receipt-person-detail', textContent: `paid ${trip.currency}${paid.toFixed(2)}` }));
    row.appendChild(el('span', {
      className: net >= 0 ? 'receipt-net positive' : 'receipt-net negative',
      textContent: net >= 0 ? `+${trip.currency}${net.toFixed(2)}` : `-${trip.currency}${Math.abs(net).toFixed(2)}`
    }));
    receipt.appendChild(row);
  });

  // Settlements
  if (settlements.length > 0) {
    receipt.appendChild(el('div', { className: 'receipt-divider' }));
    receipt.appendChild(el('div', { className: 'receipt-section-title', textContent: 'SETTLE UP' }));
    receipt.appendChild(el('div', { className: 'receipt-divider-thin' }));

    settlements.forEach(s => {
      const row = el('div', { className: 'receipt-row' });
      row.appendChild(el('span', { textContent: `${s.fromName}  \u2192  ${s.toName}` }));
      row.appendChild(el('span'));
      row.appendChild(el('span', { className: 'receipt-settle-amount', textContent: `${trip.currency}${s.amount.toFixed(2)}` }));
      receipt.appendChild(row);
    });
  }

  receipt.appendChild(el('div', { className: 'receipt-divider' }));

  // Footer
  const footer = el('div', { className: 'receipt-footer' });
  footer.appendChild(el('div', { textContent: 'Generated by FairSplit' }));
  footer.appendChild(el('div', { textContent: new Date().toLocaleDateString() }));
  receipt.appendChild(footer);

  // Zigzag bottom edge
  receipt.appendChild(el('div', { className: 'receipt-tear' }));

  area.appendChild(receipt);
}
