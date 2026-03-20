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
    el('div', { className: 'flex gap-8' }, [
      el('button', {
        className: 'btn btn-secondary',
        textContent: 'Export Expenses CSV',
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
