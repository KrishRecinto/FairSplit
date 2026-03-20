export function parseExpenseCsv(csvText, trip) {
  const results = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const expenses = [];
  const errors = [];

  results.data.forEach((row, i) => {
    const lineNum = i + 2; // +2 for header + 1-indexed
    const desc = (row.description || '').trim();
    const amount = parseFloat(row.amount);
    const date = (row.date || '').trim();
    const category = (row.category || 'other').trim().toLowerCase();
    const paidByName = (row.paid_by || '').trim();
    const splitType = (row.split_type || 'equal').trim().toLowerCase();
    const splitDetails = (row.split_details || '').trim();

    if (!desc) { errors.push(`Row ${lineNum}: Missing description`); return; }
    if (isNaN(amount) || amount <= 0) { errors.push(`Row ${lineNum}: Invalid amount`); return; }
    if (!paidByName) { errors.push(`Row ${lineNum}: Missing paid_by`); return; }

    const payer = trip.people.find(p => p.name.toLowerCase() === paidByName.toLowerCase());
    if (!payer) { errors.push(`Row ${lineNum}: Unknown person "${paidByName}"`); return; }

    let splits = [];
    if (splitType === 'custom' && splitDetails) {
      const parts = splitDetails.split(',').map(s => s.trim());
      for (const part of parts) {
        const [name, pct] = part.split(':').map(s => s.trim());
        const person = trip.people.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (!person) { errors.push(`Row ${lineNum}: Unknown person in split "${name}"`); return; }
        const percent = parseFloat(pct);
        if (isNaN(percent)) { errors.push(`Row ${lineNum}: Invalid percentage for "${name}"`); return; }
        splits.push({ personId: person.id, percent });
      }
      const totalPct = splits.reduce((s, sp) => s + sp.percent, 0);
      if (Math.abs(totalPct - 100) > 0.5) {
        errors.push(`Row ${lineNum}: Split percentages sum to ${totalPct}%, expected 100%`);
        return;
      }
    } else {
      const pct = 100 / trip.people.length;
      splits = trip.people.map(p => ({ personId: p.id, percent: pct }));
    }

    expenses.push({
      description: desc,
      amount,
      date: date || new Date().toISOString().split('T')[0],
      category,
      paidBy: payer.id,
      splits
    });
  });

  return { expenses, errors };
}

export function exportExpensesCsv(trip) {
  const rows = trip.expenses.map(exp => {
    const payer = trip.people.find(p => p.id === exp.paidBy);
    const isEqual = exp.splits.length === trip.people.length &&
      exp.splits.every(s => Math.abs(s.percent - exp.splits[0].percent) < 0.1);

    let splitType = 'equal';
    let splitDetails = '';
    if (!isEqual) {
      splitType = 'custom';
      splitDetails = exp.splits.map(s => {
        const person = trip.people.find(p => p.id === s.personId);
        return `${person ? person.name : '?'}:${s.percent}`;
      }).join(',');
    }

    return {
      date: exp.date,
      description: exp.description,
      amount: exp.amount.toFixed(2),
      category: exp.category,
      paid_by: payer ? payer.name : '?',
      split_type: splitType,
      split_details: splitDetails
    };
  });

  return Papa.unparse(rows);
}

export function downloadCsv(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
