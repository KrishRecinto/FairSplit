import { showView } from './utils/dom.js';
import * as store from './models/store.js';
import { createPerson } from './models/person.js';
import { signInWithGoogle, logOut, onAuth } from './firebase.js';
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
let unsubTrips = null;

// --- Theme ---

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

// --- Auth ---

function initAuth() {
  const loginScreen = document.getElementById('loginScreen');
  const content = document.getElementById('content');
  const googleBtn = document.getElementById('googleSignIn');
  const userBtn = document.getElementById('userBtn');

  googleBtn.addEventListener('click', async () => {
    try {
      googleBtn.disabled = true;
      googleBtn.textContent = 'Signing in...';
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in error:', err);
      googleBtn.disabled = false;
      googleBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Sign in with Google`;
    }
  });

  // Listen for auth state changes
  onAuth(async (user) => {
    if (user) {
      // Logged in
      loginScreen.style.display = 'none';
      content.style.display = 'block';

      // Show user button with initial
      userBtn.style.display = 'flex';
      userBtn.textContent = (user.displayName || user.email || '?')[0].toUpperCase();
      userBtn.title = `${user.displayName || user.email} — Click to sign out`;
      userBtn.onclick = async () => {
        if (confirm('Sign out?')) {
          if (unsubTrips) unsubTrips();
          await logOut();
        }
      };

      try {
        // Init store with Firestore data
        await store.initStore(user.uid);

        // Set up real-time sync
        unsubTrips = store.onTripsChange(user.uid, () => {
          // When trips update from another device, refresh current view
          if (currentView === 'trips') {
            showTripList();
          } else {
            const trip = store.getActiveTrip();
            if (trip) switchToView(currentView);
          }
        });

        // Check for ?join=CODE in URL
        const joinCode = new URLSearchParams(window.location.search).get('join');
        if (joinCode) {
          // Clear the URL parameter
          window.history.replaceState({}, '', window.location.pathname);
          try {
            const result = await store.joinTripByCode(joinCode);
            if (result.success) {
              store.setActiveTrip(result.trip.id);
              enterTripMode(result.trip);
              return;
            }
          } catch (joinErr) {
            console.error('Join trip error:', joinErr);
          }
        }

        // Show app
        const data = store.load();
        if (data.activeTripId && data.trips.find(t => t.id === data.activeTripId)) {
          enterTripMode(store.getActiveTrip());
        } else {
          showTripList();
        }
      } catch (err) {
        console.error('Init error:', err);
        // Still show trip list even if init partially fails
        showTripList();
      }
    } else {
      // Logged out
      loginScreen.style.display = 'flex';
      content.style.display = 'none';
      userBtn.style.display = 'none';
      document.getElementById('tabBar').style.display = 'none';
      document.getElementById('tripSelector').style.display = 'none';
    }
  });
}

// --- Add Member ---

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

  async function addMember() {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }

    const trip = store.getActiveTrip();
    if (!trip) return;

    if (trip.people.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      input.value = '';
      input.focus();
      return;
    }

    trip.people.push(createPerson(name));
    await store.saveTrip(trip);
    input.value = '';
    input.focus();
    renderMemberChips();
    switchToView(currentView);
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

// --- Navigation ---

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

// --- Init ---

function init() {
  initTheme();
  initAddMember();
  initAuth();

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchToView(tab.dataset.view);
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
