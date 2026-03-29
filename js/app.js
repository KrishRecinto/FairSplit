import { showView } from './utils/dom.js';
import * as store from './models/store.js';
import { createPerson } from './models/person.js';
import { signInWithGoogle, signInAnonymously, logOut, onAuth, findTripByShareCode } from './firebase.js';
import { renderTripList, populateTripDropdown } from './views/tripList.js';
import { renderExpenses } from './views/expenses.js';
import { renderDashboard } from './views/dashboard.js';
import { renderImportExport } from './views/importExport.js';

const viewContainers = {
  trips: () => document.getElementById('view-trips'),
  expenses: () => document.getElementById('view-expenses'),
  dashboard: () => document.getElementById('view-dashboard'),
  import: () => document.getElementById('view-import')
};

let currentView = 'trips';
let unsubTrips = null;
let pendingJoinCode = null;
let pendingShare = false;

export function setPendingJoin(code) {
  pendingJoinCode = code;
}

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

// --- Sign-in (called when user needs to share/sync) ---

export async function promptSignIn() {
  try {
    await signInWithGoogle();
    return true;
  } catch (err) {
    console.error('Sign-in error:', err);
    return false;
  }
}

// --- Auth ---

function initAuth() {
  const loginScreen = document.getElementById('loginScreen');
  const content = document.getElementById('content');
  const loadingScreen = document.getElementById('loadingScreen');
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

  // Check for ?join=CODE — this requires auth, so show guest join screen
  const joinCode = new URLSearchParams(window.location.search).get('join');
  if (joinCode) {
    loadingScreen.style.display = 'none';
    content.style.display = 'none';
    showGuestJoinScreen(joinCode);
    // Also listen for auth to complete the join
    onAuth(async (user) => {
      if (user) {
        await handleSignedIn(user, joinCode);
      }
    });
    return;
  }

  // No join code — start in offline mode immediately, show the app
  store.initOffline();
  loadingScreen.style.display = 'none';
  content.style.display = 'block';

  const data = store.load();
  if (data.activeTripId && data.trips.find(t => t.id === data.activeTripId)) {
    enterTripMode(store.getActiveTrip());
  } else {
    showTripList();
  }

  // Listen for auth state changes (user signs in later, or was already signed in)
  onAuth(async (user) => {
    if (user) {
      await handleSignedIn(user);
    } else {
      // User signed out — switch back to offline mode
      if (unsubTrips) { unsubTrips(); unsubTrips = null; }
      userBtn.style.display = 'none';
      store.initOffline();
      showTripList();
    }
  });
}

// Handle transition to signed-in state
async function handleSignedIn(user, joinCode) {
  const content = document.getElementById('content');
  const loadingScreen = document.getElementById('loadingScreen');
  const loginScreen = document.getElementById('loginScreen');
  const userBtn = document.getElementById('userBtn');

  // Hide any login/guest screens
  loginScreen.style.display = 'none';
  const guestScreen = document.getElementById('guestJoinScreen');
  if (guestScreen) guestScreen.style.display = 'none';

  // Show user button
  const guestName = localStorage.getItem('fairsplit_guestName');
  const displayName = user.displayName || guestName || user.email || 'Guest';
  userBtn.style.display = 'flex';
  userBtn.textContent = displayName[0].toUpperCase();
  userBtn.title = `${displayName} — Click to sign out`;
  userBtn.onclick = async () => {
    if (confirm('Sign out?')) {
      if (unsubTrips) unsubTrips();
      await logOut();
    }
  };

  // Init Firestore store
  store.initStore(user.uid);

  // Set up real-time sync listener (runs in background)
  if (unsubTrips) unsubTrips();
  const { unsub, ready } = store.onTripsChange(user.uid, () => {
    if (currentView === 'trips') {
      showTripList();
    } else {
      const trip = store.getActiveTrip();
      if (trip) switchToView(currentView);
    }
  });
  unsubTrips = unsub;

  // Handle join code if present (from URL or manual entry as guest)
  const effectiveJoinCode = joinCode || pendingJoinCode;
  if (pendingJoinCode) pendingJoinCode = null;

  if (effectiveJoinCode) {
    // Fast path: skip waiting for trips snapshot — new joiners have no existing trips.
    // Go straight to the join operation (saves 1-3s of Firestore roundtrip).
    loadingScreen.style.display = 'flex';
    content.style.display = 'none';
    window.history.replaceState({}, '', window.location.pathname);
    try {
      const result = await store.joinTripByCode(effectiveJoinCode);
      if (result.success) {
        store.setActiveTrip(result.trip.id);
        loadingScreen.style.display = 'none';
        content.style.display = 'block';
        enterTripMode(result.trip);
        return;
      }
    } catch (joinErr) {
      console.error('Join trip error:', joinErr);
    }
    // If join failed, fall through to show normal app
  }

  // Regular path: wait for trips snapshot then show app (8s timeout to prevent hangs)
  loadingScreen.style.display = 'flex';
  content.style.display = 'none';
  await Promise.race([ready, new Promise(r => setTimeout(r, 8000))]);

  // Migrate any local trips to Firestore
  await store.migrateLocalTrips(user.uid);

  // Show app
  loadingScreen.style.display = 'none';
  content.style.display = 'block';
  const data = store.load();
  if (data.activeTripId && data.trips.find(t => t.id === data.activeTripId)) {
    enterTripMode(store.getActiveTrip());
  } else {
    showTripList();
  }
}

// --- Guest Join ---

async function showGuestJoinScreen(joinCode) {
  const guestScreen = document.getElementById('guestJoinScreen');
  const guestNameInput = document.getElementById('guestNameInput');
  const guestJoinBtn = document.getElementById('guestJoinBtn');
  const guestJoinMsg = document.getElementById('guestJoinMsg');
  const guestTripName = document.getElementById('guestTripName');
  const switchToLogin = document.getElementById('guestSwitchToLogin');

  guestScreen.style.display = 'flex';
  guestJoinMsg.textContent = '';

  try {
    const trip = await findTripByShareCode(joinCode);
    if (trip) {
      guestTripName.textContent = `Join "${trip.name}"`;
    } else {
      guestTripName.textContent = 'Group not found';
      guestJoinMsg.textContent = 'This invite link may be invalid or expired.';
      guestJoinBtn.disabled = true;
      return;
    }
  } catch (e) {
    // Couldn't fetch trip name, that's okay
  }

  switchToLogin.onclick = () => {
    guestScreen.style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
  };

  async function handleGuestJoin() {
    const name = guestNameInput.value.trim();
    if (!name) {
      guestJoinMsg.textContent = 'Please enter your name.';
      guestNameInput.focus();
      return;
    }

    guestJoinBtn.disabled = true;
    guestJoinBtn.textContent = 'Joining...';
    guestJoinMsg.textContent = '';

    try {
      await signInAnonymously();
      localStorage.setItem('fairsplit_guestName', name);
    } catch (err) {
      console.error('Guest join error:', err);
      guestJoinMsg.textContent = 'Something went wrong. Please try again.';
      guestJoinBtn.disabled = false;
      guestJoinBtn.textContent = 'Join Group';
    }
  }

  guestJoinBtn.onclick = handleGuestJoin;
  guestNameInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGuestJoin();
    }
  };

  guestNameInput.focus();
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

function copyShareLink(btn) {
  const currentTrip = store.getActiveTrip();
  if (!currentTrip || !currentTrip.shareCode) {
    btn.textContent = 'No code yet';
    setTimeout(() => { btn.textContent = 'Share'; }, 2000);
    return;
  }
  const shareUrl = `${window.location.origin}?join=${currentTrip.shareCode}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Share'; }, 2000);
    });
  } else {
    prompt('Copy this link:', shareUrl);
  }
}

function enterTripMode(trip) {
  document.getElementById('tabBar').style.display = 'flex';
  document.getElementById('tripSelector').style.display = 'flex';

  // Share button
  const shareBtn = document.getElementById('shareBtn');
  shareBtn.style.display = 'flex';
  shareBtn.onclick = async () => {
    if (!store.isSignedIn()) {
      // Mark pending so enterTripMode auto-copies after sign-in + migration
      pendingShare = true;
      shareBtn.textContent = 'Signing in...';
      const success = await promptSignIn();
      if (!success) { shareBtn.textContent = 'Share'; pendingShare = false; }
      // handleSignedIn → enterTripMode will handle copying once migration is done
      return;
    }
    copyShareLink(shareBtn);
  };

  // Auto-copy if user just signed in to share
  if (pendingShare) {
    pendingShare = false;
    copyShareLink(shareBtn);
  }

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
