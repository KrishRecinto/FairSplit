import { el, clearEl } from '../utils/dom.js';
import { createTrip, GROUP_TYPES } from '../models/trip.js';
import { createPerson } from '../models/person.js';
import * as store from '../models/store.js';
import { promptSignIn, setPendingJoin } from '../app.js';
import { signInAnonymously } from '../firebase.js';

export function renderTripList(container, onTripSelected) {
  clearEl(container);
  const data = store.load();

  const wrapper = el('div', {}, [
    el('div', { className: 'empty-state', style: { paddingBottom: '24px' } }, [
      el('div', { className: 'empty-state-icon', textContent: '$' }),
      el('h3', { textContent: 'Welcome to FairSplit' }),
      el('p', { style: { marginBottom: '0' }, textContent: 'Split expenses fairly with friends — trips, meals, rent, and more.' })
    ]),
  ]);

  // Two action buttons
  const formContainer = el('div');
  let activeForm = null;

  const createBtn = el('button', {
    className: 'btn btn-primary home-action-btn',
    textContent: 'New Group',
    onClick: () => {
      if (activeForm === 'create') {
        clearEl(formContainer);
        activeForm = null;
        createBtn.className = 'btn btn-primary home-action-btn';
        return;
      }
      clearEl(formContainer);
      formContainer.appendChild(buildCreateForm(onTripSelected));
      activeForm = 'create';
      createBtn.className = 'btn btn-primary home-action-btn active';
      joinBtn.className = 'btn btn-secondary home-action-btn';
    }
  });

  const joinBtn = el('button', {
    className: 'btn btn-secondary home-action-btn',
    textContent: 'Join Group',
    onClick: () => {
      if (activeForm === 'join') {
        clearEl(formContainer);
        activeForm = null;
        joinBtn.className = 'btn btn-secondary home-action-btn';
        return;
      }
      clearEl(formContainer);
      formContainer.appendChild(buildJoinForm(onTripSelected));
      activeForm = 'join';
      joinBtn.className = 'btn btn-secondary home-action-btn active';
      createBtn.className = 'btn btn-primary home-action-btn';
    }
  });

  wrapper.appendChild(el('div', { className: 'home-action-buttons' }, [createBtn, joinBtn]));
  wrapper.appendChild(formContainer);

  if (data.trips.length > 0) {
    const listSection = el('div', { className: 'mt-16' }, [
      el('div', { className: 'section-title', textContent: 'Your Groups' })
    ]);
    data.trips.forEach(trip => {
      listSection.appendChild(buildTripCard(trip, onTripSelected));
    });
    wrapper.appendChild(listSection);
  }

  container.appendChild(wrapper);
}

function buildJoinForm(onTripSelected) {
  const signedIn = store.isSignedIn();

  const form = el('div', { className: 'card' }, [
    el('div', { className: 'card-title', textContent: 'Join a Group' }),
    el('p', { className: 'text-muted', style: { fontSize: '0.85rem', marginBottom: '10px' }, textContent: 'Enter the 6-character code from your invite.' }),
  ]);

  // Name field for guests
  let nameInput = null;
  if (!signedIn) {
    nameInput = el('input', { type: 'text', placeholder: 'Your name' });
    form.appendChild(el('div', { className: 'form-group' }, [
      el('label', { textContent: 'Your name' }),
      nameInput
    ]));
  }

  const codeInput = el('input', {
    type: 'text',
    placeholder: 'Code or invite link',
    className: 'join-code-input',
    id: 'joinCode'
  });
  codeInput.addEventListener('input', () => {
    let val = codeInput.value.trim();
    // Accept full invite URL — extract the code from ?join=CODE
    const urlMatch = val.match(/[?&]join=([A-Za-z0-9]{6})/i);
    if (urlMatch) {
      codeInput.value = urlMatch[1].toUpperCase();
    } else {
      codeInput.value = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    }
  });

  const joinMsg = el('div', { id: 'joinMsg', style: { marginTop: '8px' } });

  const joinBtn = el('button', {
    className: 'btn btn-primary',
    textContent: 'Join Group',
    onClick: async () => {
      const code = codeInput.value.trim();

      if (!store.isSignedIn()) {
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
          joinMsg.textContent = 'Please enter your name.';
          joinMsg.className = 'people-hint invalid';
          if (nameInput) nameInput.focus();
          return;
        }
        if (code.length !== 6) {
          joinMsg.textContent = 'Please enter a 6-character code.';
          joinMsg.className = 'people-hint invalid';
          return;
        }
        joinBtn.disabled = true;
        joinBtn.textContent = 'Joining...';
        localStorage.setItem('fairsplit_guestName', name);
        setPendingJoin(code);
        try {
          await signInAnonymously();
          // onAuth fires → handleSignedIn picks up pendingJoinCode and navigates
        } catch (err) {
          console.error('Guest join error:', err);
          joinMsg.textContent = 'Something went wrong. Please try again.';
          joinMsg.className = 'people-hint invalid';
          joinBtn.disabled = false;
          joinBtn.textContent = 'Join Group';
        }
        return;
      }

      if (code.length !== 6) {
        joinMsg.textContent = 'Please enter a 6-character code.';
        joinMsg.className = 'people-hint invalid';
        return;
      }
      joinBtn.disabled = true;
      joinBtn.textContent = 'Joining...';
      const result = await store.joinTripByCode(code);
      if (result.success) {
        store.setActiveTrip(result.trip.id);
        onTripSelected(result.trip);
      } else {
        joinMsg.textContent = result.error;
        joinMsg.className = 'people-hint invalid';
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Group';
      }
    }
  });

  const row = el('div', { className: 'person-input-row' }, [codeInput, joinBtn]);
  form.appendChild(el('div', { className: 'form-group' }, [
    el('label', { textContent: 'Invite code' }),
    row
  ]));
  form.appendChild(joinMsg);
  return form;
}

function buildCreateForm(onTripSelected) {
  const form = el('div', { className: 'card' }, [
    el('div', { className: 'card-title', textContent: 'Create a Group' }),
  ]);

  // Group type selector
  const typeSelect = el('select', { id: 'groupType' });
  GROUP_TYPES.forEach(gt => {
    typeSelect.appendChild(el('option', { value: gt.key, textContent: gt.label }));
  });

  form.appendChild(el('div', { className: 'form-group' }, [
    el('label', { textContent: 'Type' }),
    typeSelect
  ]));

  const placeholders = {
    trip: 'e.g. Iceland 2026',
    household: 'e.g. Apartment 4B',
    meals: 'e.g. Friday dinner',
    event: 'e.g. Birthday party',
    other: 'e.g. Group name'
  };
  const nameLabels = {
    trip: 'Trip Name',
    household: 'Household Name',
    meals: 'Meal Name',
    event: 'Event Name',
    other: 'Group Name'
  };

  const nameInput = el('input', { type: 'text', placeholder: placeholders.trip, id: 'tripName' });
  const nameLabel = el('label', { textContent: 'Trip Name' });

  typeSelect.addEventListener('change', () => {
    const t = typeSelect.value;
    nameInput.placeholder = placeholders[t] || placeholders.other;
    nameLabel.textContent = nameLabels[t] || nameLabels.other;
  });
  const currencyInput = el('select', { id: 'tripCurrency' });
  const currencies = [
    { symbol: '$', label: '$ — USD (US Dollar)' },
    { symbol: '€', label: '€ — EUR (Euro)' },
    { symbol: '£', label: '£ — GBP (British Pound)' },
    { symbol: '¥', label: '¥ — JPY (Japanese Yen)' },
    { symbol: '₩', label: '₩ — KRW (Korean Won)' },
    { symbol: 'C$', label: 'C$ — CAD (Canadian Dollar)' },
    { symbol: 'A$', label: 'A$ — AUD (Australian Dollar)' },
    { symbol: '₹', label: '₹ — INR (Indian Rupee)' },
    { symbol: '₱', label: '₱ — PHP (Philippine Peso)' },
    { symbol: 'CHF', label: 'CHF — Swiss Franc' },
    { symbol: 'R$', label: 'R$ — BRL (Brazilian Real)' },
    { symbol: '₪', label: '₪ — ILS (Israeli Shekel)' },
    { symbol: 'kr', label: 'kr — SEK / NOK / DKK (Krona)' },
    { symbol: 'zł', label: 'zł — PLN (Polish Zloty)' },
    { symbol: '฿', label: '฿ — THB (Thai Baht)' },
    { symbol: 'RM', label: 'RM — MYR (Malaysian Ringgit)' },
    { symbol: 'S$', label: 'S$ — SGD (Singapore Dollar)' },
    { symbol: 'R', label: 'R — ZAR (South African Rand)' },
    { symbol: '₫', label: '₫ — VND (Vietnamese Dong)' },
    { symbol: 'Mex$', label: 'Mex$ — MXN (Mexican Peso)' },
  ];
  currencies.forEach(c => {
    currencyInput.appendChild(el('option', { value: c.symbol, textContent: c.label }));
  });
  // People — chip-based input
  const peopleNames = [];
  const chipsContainer = el('div', { className: 'people-chips', id: 'peopleChips' });
  const peopleHint = el('div', { className: 'people-hint', id: 'peopleHint', textContent: 'Add at least 2 people' });

  const personInput = el('input', { type: 'text', placeholder: 'Type a name...', id: 'personInput' });
  const addPersonBtn = el('button', {
    className: 'btn btn-primary btn-add-person',
    textContent: '+',
    onClick: () => addPerson()
  });

  const personRow = el('div', { className: 'person-input-row' }, [personInput, addPersonBtn]);

  // Add person on Enter key
  personInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPerson();
    }
  });

  function addPerson() {
    const name = personInput.value.trim();
    if (!name) { personInput.focus(); return; }
    if (peopleNames.includes(name)) {
      personInput.value = '';
      personInput.focus();
      return;
    }
    peopleNames.push(name);
    personInput.value = '';
    personInput.focus();
    renderChips();
  }

  function removePerson(name) {
    const idx = peopleNames.indexOf(name);
    if (idx >= 0) peopleNames.splice(idx, 1);
    renderChips();
  }

  function renderChips() {
    clearEl(chipsContainer);
    peopleNames.forEach(name => {
      const chip = el('span', { className: 'person-chip' }, [
        el('span', { textContent: name }),
        el('button', {
          className: 'chip-remove',
          textContent: '\u00d7',
          onClick: () => removePerson(name)
        })
      ]);
      chipsContainer.appendChild(chip);
    });
    // Update hint
    const count = peopleNames.length;
    if (count === 0) {
      peopleHint.textContent = 'Add at least 2 people';
      peopleHint.className = 'people-hint';
    } else if (count === 1) {
      peopleHint.textContent = 'Add at least 1 more person';
      peopleHint.className = 'people-hint';
    } else {
      peopleHint.textContent = `${count} people added`;
      peopleHint.className = 'people-hint valid';
    }
  }

  form.appendChild(el('div', { className: 'form-group' }, [
    nameLabel,
    nameInput
  ]));

  form.appendChild(el('div', { className: 'form-group' }, [
    el('label', { textContent: 'Currency' }),
    currencyInput
  ]));

  form.appendChild(el('div', { className: 'form-group' }, [
    el('label', { textContent: 'People' }),
    personRow,
    chipsContainer,
    peopleHint
  ]));

  const createBtn = el('button', {
    className: 'btn btn-primary btn-block',
    textContent: 'Create Group',
    onClick: () => {
      const name = nameInput.value.trim();
      const currency = currencyInput.value.trim() || '$';

      if (!name) { nameInput.focus(); return; }
      if (peopleNames.length < 2) {
        personInput.focus();
        peopleHint.textContent = 'Please add at least 2 people';
        peopleHint.className = 'people-hint invalid';
        return;
      }

      const trip = createTrip(name, currency, typeSelect.value);
      trip.people = peopleNames.map(n => createPerson(n));
      store.saveTrip(trip);
      store.setActiveTrip(trip.id);
      onTripSelected(trip);
    }
  });

  form.appendChild(el('div', { className: 'mt-8' }, [createBtn]));
  return form;
}

function buildTripCard(trip, onTripSelected) {
  const shareCode = trip.shareCode || '------';
  const shareUrl = `${window.location.origin}?join=${shareCode}`;

  const copyBtn = el('button', {
    className: 'btn btn-secondary btn-sm',
    textContent: '🔗 Invite',
    onClick: async (e) => {
      e.stopPropagation();
      // If not signed in, prompt sign-in first
      if (!store.isSignedIn()) {
        copyBtn.textContent = 'Signing in...';
        const success = await promptSignIn();
        if (!success) {
          copyBtn.textContent = '🔗 Invite';
        }
        // After sign-in, the view will re-render with share codes
        return;
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = '🔗 Invite'; }, 2000);
        });
      } else {
        prompt('Copy this link:', shareUrl);
      }
    }
  });

  const deleteBtn = el('button', {
    className: 'btn btn-danger btn-sm',
    textContent: 'Delete',
    onClick: (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${trip.name}"? This cannot be undone.`)) {
        store.deleteTrip(trip.id);
      }
    }
  });

  const tripType = trip.type === 'dinner' ? 'meals' : (trip.type || 'trip');
  const typeInfo = GROUP_TYPES.find(gt => gt.key === tripType) || GROUP_TYPES[0];

  const card = el('div', { className: 'card', style: { cursor: 'pointer' } }, [
    el('div', { className: 'flex-between' }, [
      el('div', {}, [
        el('div', { className: 'card-title', textContent: trip.name }),
        el('div', { className: 'text-muted', style: { fontSize: '0.85rem' }, textContent: `${typeInfo.label} · ${trip.people.length} people · ${trip.expenses.length} expenses` }),
        el('div', { className: 'share-code-label', textContent: `Code: ${shareCode}` })
      ]),
      el('div', { className: 'trip-card-actions' }, [
        copyBtn,
        el('button', {
          className: 'btn btn-primary btn-sm',
          textContent: 'Open',
          onClick: (e) => {
            e.stopPropagation();
            store.setActiveTrip(trip.id);
            onTripSelected(trip);
          }
        }),
        deleteBtn
      ])
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

  const newOpt = el('option', { value: '__new__', textContent: '+ New Group' });
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
