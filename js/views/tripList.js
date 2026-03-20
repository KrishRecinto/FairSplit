import { el, clearEl } from '../utils/dom.js';
import { createTrip } from '../models/trip.js';
import { createPerson } from '../models/person.js';
import * as store from '../models/store.js';

export function renderTripList(container, onTripSelected) {
  clearEl(container);
  const data = store.load();

  const wrapper = el('div', {}, [
    el('div', { className: 'empty-state' }, [
      el('div', { className: 'empty-state-icon', textContent: '$' }),
      el('h3', { textContent: 'Welcome to FairSplit' }),
      el('p', { textContent: 'Split trip expenses fairly with custom ratios, see who paid what, and settle up with minimal transactions.' })
    ]),
    buildCreateForm(onTripSelected),
  ]);

  if (data.trips.length > 0) {
    const listSection = el('div', { className: 'mt-16' }, [
      el('div', { className: 'section-title', textContent: 'Your Trips' })
    ]);
    data.trips.forEach(trip => {
      listSection.appendChild(buildTripCard(trip, onTripSelected));
    });
    wrapper.appendChild(listSection);
  }

  container.appendChild(wrapper);
}

function buildCreateForm(onTripSelected) {
  const form = el('div', { className: 'card' }, [
    el('div', { className: 'card-title', textContent: 'Create a Trip' }),
  ]);

  const nameInput = el('input', { type: 'text', placeholder: 'e.g. Iceland 2026', id: 'tripName' });
  const currencyInput = el('input', { type: 'text', placeholder: '$', value: '$', id: 'tripCurrency', maxLength: '3' });
  const peopleInput = el('input', { type: 'text', placeholder: 'Alice, Bob, Charlie', id: 'tripPeople' });

  form.appendChild(el('div', { className: 'form-group' }, [
    el('label', { textContent: 'Trip Name' }),
    nameInput
  ]));

  form.appendChild(el('div', { className: 'form-row' }, [
    el('div', { className: 'form-group' }, [
      el('label', { textContent: 'Currency Symbol' }),
      currencyInput
    ]),
    el('div', { className: 'form-group' }, [
      el('label', { textContent: 'People (comma-separated)' }),
      peopleInput
    ])
  ]));

  const createBtn = el('button', {
    className: 'btn btn-primary btn-block',
    textContent: 'Create Trip',
    onClick: () => {
      const name = nameInput.value.trim();
      const currency = currencyInput.value.trim() || '$';
      const peopleStr = peopleInput.value.trim();

      if (!name) { nameInput.focus(); return; }
      if (!peopleStr) { peopleInput.focus(); return; }

      const trip = createTrip(name, currency);
      const names = peopleStr.split(',').map(n => n.trim()).filter(Boolean);
      if (names.length < 2) {
        alert('Please add at least 2 people.');
        return;
      }
      trip.people = names.map(n => createPerson(n));
      store.saveTrip(trip);
      store.setActiveTrip(trip.id);
      onTripSelected(trip);
    }
  });

  form.appendChild(el('div', { className: 'mt-8' }, [createBtn]));
  return form;
}

function buildTripCard(trip, onTripSelected) {
  const card = el('div', { className: 'card', style: { cursor: 'pointer' } }, [
    el('div', { className: 'flex-between' }, [
      el('div', {}, [
        el('div', { className: 'card-title', textContent: trip.name }),
        el('div', { className: 'text-muted', style: { fontSize: '0.85rem' }, textContent: `${trip.people.length} people · ${trip.expenses.length} expenses` })
      ]),
      el('button', {
        className: 'btn btn-primary btn-sm',
        textContent: 'Open',
        onClick: (e) => {
          e.stopPropagation();
          store.setActiveTrip(trip.id);
          onTripSelected(trip);
        }
      })
    ])
  ]);

  return card;
}

export function populateTripDropdown(dropdown, onTripChanged) {
  const data = store.load();
  clearEl(dropdown);

  data.trips.forEach(trip => {
    const opt = el('option', { value: trip.id, textContent: trip.name });
    if (trip.id === data.activeTripId) opt.selected = true;
    dropdown.appendChild(opt);
  });

  const newOpt = el('option', { value: '__new__', textContent: '+ New Trip' });
  dropdown.appendChild(newOpt);

  dropdown.onchange = () => {
    if (dropdown.value === '__new__') {
      onTripChanged(null);
    } else {
      store.setActiveTrip(dropdown.value);
      onTripChanged(store.getActiveTrip());
    }
  };
}
