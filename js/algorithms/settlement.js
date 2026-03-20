export function computeBalances(trip) {
  const balances = {};
  trip.people.forEach(p => { balances[p.id] = 0; });

  trip.expenses.forEach(exp => {
    balances[exp.paidBy] = (balances[exp.paidBy] || 0) + exp.amount;
    const totalPct = exp.splits.reduce((s, sp) => s + sp.percent, 0);
    exp.splits.forEach(sp => {
      const owed = exp.amount * sp.percent / totalPct;
      balances[sp.personId] = (balances[sp.personId] || 0) - owed;
    });
  });

  return balances;
}

export function computeSettlements(balances, people) {
  const creditors = [];
  const debtors = [];

  for (const [personId, amount] of Object.entries(balances)) {
    const rounded = Math.round(amount * 100) / 100;
    if (rounded > 0.005) creditors.push({ personId, amount: rounded });
    else if (rounded < -0.005) debtors.push({ personId, amount: Math.abs(rounded) });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    const rounded = Math.round(transfer * 100) / 100;

    if (rounded > 0) {
      const fromPerson = people.find(p => p.id === debtors[i].personId);
      const toPerson = people.find(p => p.id === creditors[j].personId);
      settlements.push({
        fromId: debtors[i].personId,
        fromName: fromPerson ? fromPerson.name : debtors[i].personId,
        toId: creditors[j].personId,
        toName: toPerson ? toPerson.name : creditors[j].personId,
        amount: rounded
      });
    }

    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;

    if (debtors[i].amount < 0.005) i++;
    if (creditors[j].amount < 0.005) j++;
  }

  return settlements;
}
