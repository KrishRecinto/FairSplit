import { generateId } from '../utils/dom.js';

export function createTrip(name, currency = '$') {
  return {
    id: generateId('trip'),
    name,
    currency,
    people: [],
    expenses: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
