import { showView } from './utils/dom.js';
import * as store from './models/store.js';
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

function init() {
  initTheme();
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
  document.getElementById('tripSelector').style.display = 'block';

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
