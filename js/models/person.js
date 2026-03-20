import { generateId } from '../utils/dom.js';

export function createPerson(name) {
  return {
    id: generateId('person'),
    name: name.trim()
  };
}
