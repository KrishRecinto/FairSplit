import { showView } from './utils/dom.js';
import * as store from './models/store.js';
import { createPerson } from './models/person.js';
import { renderTripList, populateTripDropdown } from './views/tripList.js';
import { renderExpenses } from './views/expenses.js';
import { renderDashboard } from './views/dashboard.js';
import { renderSettle } from './views/settle.js';
import { renderImportExport } from './views/importExport.js';

const viewContainers = {
  trips: () => document.getElementById('view-trips'),
  expenses: () => document.getElementById('view-expenses'),
  dashboard: () => document.getElementById('view-dashboard'),
  settle: () => document.getElementById('view-settle'),
  import: () => document.getElementById('view-import')
};

let currentView = 'trips';

function initTheme() {
  const saved = localStorage.getItem('fairsplit_theme');
  const btn = document.getElementById('themeToggle');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    btn.innerHTML = '&#9788;';
  }
  btn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('fairsplit_theme', 'light');
      btn.innerHTML = '&#9790;';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('fairsplit_theme', 'dark');
      btn.innerHTML = '&#9788;';
    }
  });
}

function initAddMember() {
  const btn = document.getElementById('addMemberBtn');
  const panel = document.getElementById('addMemberPanel');
  const input = document.getElementById('newMemberInput');
  const confirmBtn = document.getElementById('confirmAddMember');
  const cancelBtn = document.getElementById('cancelAddMember');
  const chipsEl = document.getElementById('memberChips');

  btn.addEventListener('click', () => {
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      input.value = '';
      input.focus();
      renderMemberChips();
    }
  });

  cancelBtn.addEventListener('click', () => {
    panel.style.display = 'none';
  });

  function addMember() {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }

    const trip = store.getActiveTrip();
    if (!trip) return;

    // Check for duplicate
    if (trip.people.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      input.value = '';
      input.focus();
      return;
    }

    trip.people.push(createPerson(name));
    store.saveTrip(trip);
    input.value = '';
    input.focus();
    renderMemberChips();
    switchToView(currentView); // Refresh current view
  }

  confirmBtn.addEventListener('click', addMember);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMember();
    }
  });

  function renderMemberChips() {
    chipsEl.innerHTML = '';
    const trip = store.getActiveTrip();
    if (!trip) return;
    trip.people.forEach(p => {
      const chip = document.createElement('span');
      chip.className = 'person-chip';
      chip.textContent = p.name;
      chipsEl.appendChild(chip);
    });
  }
}

function init() {
  initTheme();
  initAddMember();
  const data = store.load();

  if (data.activeTripId && data.trips.find(t => t.id === data.activeTripId)) {
    enterTripMode(store.getActiveTrip());
  } else {
    showTripList();
  }

  // Tab clicks
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      switchToView(view);
    });
  });
}

function showTripList() {
  document.getElementById('tabBar').style.display = 'none';
  document.getElementById('tripSelector').style.display = 'none';
  showView('trips');
  currentView = 'trips';
  renderTripList(viewContainers.trips(), (trip) => {
    if (trip) enterTripMode(trip);
  });
}

function enterTripMode(trip) {
  document.getElementById('tabBar').style.display = 'flex';
  document.getElementById('tripSelector').style.display = 'flex';

  populateTripDropdown(document.getElementById('tripDropdown'), (selectedTrip) => {
    if (selectedTrip) {
      enterTripMode(selectedTrip);
    } else {
      showTripList();
    }
  });

  switchToView('expenses');
}

function switchToView(view) {
  currentView = view;

  // Update tab active state
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === view);
  });

  showView(view);

  const trip = store.getActiveTrip();
  if (!trip) { showTripList(); return; }

  switch (view) {
    case 'expenses':
      renderExpenses(viewContainers.expenses(), trip);
      break;
    case 'dashboard':
      renderDashboard(viewContainers.dashboard(), trip);
      break;
    case 'settle':
      renderSettle(viewContainers.settle(), trip);
      break;
    case 'import':
      renderImportExport(viewContainers.import(), trip);
      break;
  }
}

document.addEventListener('DOMContentLoaded', init);
