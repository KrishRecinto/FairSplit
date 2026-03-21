import { generateId, todayStr } from '../utils/dom.js';

export const CATEGORIES = ['accommodation', 'food', 'drinks', 'transport', 'activities', 'shopping', 'other'];

export function createExpense(description, amount, paidBy, splits, category = 'other', date = null) {
  return {
    id: generateId('exp'),
    description,
    amount: parseFloat(amount),
    category,
    date: date || todayStr(),
    paidBy,
    splits // [{ personId, percent }]
  };
}

export function equalSplits(people) {
  const pct = 100 / people.length;
  return people.map(p => ({ personId: p.id, percent: pct }));
}
