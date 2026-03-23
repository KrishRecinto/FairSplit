import { generateId } from '../utils/dom.js';

export const GROUP_TYPES = [
  { key: 'trip', icon: '✈️', label: 'Trip' },
  { key: 'household', icon: '🏠', label: 'Household' },
  { key: 'dinner', icon: '🍽️', label: 'Dinner' },
  { key: 'event', icon: '🎉', label: 'Event' },
  { key: 'other', icon: '📋', label: 'Other' }
];

function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createTrip(name, currency = '$', type = 'trip') {
  return {
    id: generateId('trip'),
    name,
    currency,
    type,
    shareCode: generateShareCode(),
    people: [],
    expenses: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
