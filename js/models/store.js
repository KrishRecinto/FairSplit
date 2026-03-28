import * as fb from '../firebase.js';

// In-memory cache so views can call load()/getActiveTrip() synchronously
let cachedData = { trips: [], activeTripId: null, userId: null };

const LOCAL_KEY = 'fairsplit_local_trips';
const ACTIVE_KEY = 'fairsplit_activeTripId';

// --- Local storage helpers ---

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch { return []; }
}

function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(cachedData.trips));
}

// --- Sync API (used by views, reads from cache) ---

export function load() {
  return cachedData;
}

export function isSignedIn() {
  return !!cachedData.userId;
}

export function getActiveTrip() {
  if (!cachedData.activeTripId) return null;
  return cachedData.trips.find(t => t.id === cachedData.activeTripId) || null;
}

export function setActiveTrip(tripId) {
  cachedData.activeTripId = tripId;
  localStorage.setItem(ACTIVE_KEY, tripId);
}

// --- Async API (writes to Firestore if signed in, localStorage otherwise) ---

export async function saveTrip(trip) {
  // Update cache immediately for responsiveness
  const idx = cachedData.trips.findIndex(t => t.id === trip.id);
  trip.updatedAt = new Date().toISOString();
  if (idx >= 0) cachedData.trips[idx] = trip;
  else cachedData.trips.push(trip);

  if (cachedData.userId) {
    await fb.saveTrip(trip, cachedData.userId);
  } else {
    saveLocal();
  }
}

export async function deleteTrip(tripId) {
  cachedData.trips = cachedData.trips.filter(t => t.id !== tripId);
  if (cachedData.activeTripId === tripId) {
    cachedData.activeTripId = cachedData.trips.length ? cachedData.trips[0].id : null;
  }

  if (cachedData.userId) {
    await fb.deleteTrip(tripId);
  } else {
    saveLocal();
  }
}

// --- Join trip by share code (requires sign-in) ---

export async function joinTripByCode(code) {
  if (!cachedData.userId) return { success: false, error: 'Not signed in' };
  const trip = await fb.findTripByShareCode(code);
  if (!trip) return { success: false, error: 'Trip not found. Check the code and try again.' };
  if (trip.memberUids && trip.memberUids.includes(cachedData.userId)) {
    return { success: true, trip, alreadyMember: true };
  }
  await fb.joinTrip(trip.id, cachedData.userId);
  trip.memberUids = trip.memberUids || [];
  trip.memberUids.push(cachedData.userId);
  cachedData.trips.push(trip);
  return { success: true, trip, alreadyMember: false };
}

// --- Init: offline mode (no auth) ---

export function initOffline() {
  cachedData.userId = null;
  cachedData.trips = loadLocal();
  cachedData.activeTripId = localStorage.getItem(ACTIVE_KEY) || null;
}

// --- Init: online mode (after sign-in) ---

export function initStore(userId) {
  cachedData.userId = userId;
  cachedData.activeTripId = localStorage.getItem(ACTIVE_KEY) || null;
}

// Migrate any local trips to Firestore after sign-in
export async function migrateLocalTrips(userId) {
  const localTrips = loadLocal();
  if (localTrips.length === 0) return [];

  for (const trip of localTrips) {
    // Check if this trip already exists in Firestore (avoid duplicates)
    const existing = cachedData.trips.find(t => t.id === trip.id);
    if (!existing) {
      trip.ownerUid = userId;
      trip.memberUids = [userId];
      await fb.saveTrip(trip, userId);
      cachedData.trips.push(trip);
    }
  }

  // Clear local storage now that everything is in Firestore
  localStorage.removeItem(LOCAL_KEY);
  return localTrips;
}

// Set up real-time listener that also handles initial load
export function onTripsChange(userId, callback) {
  let initialLoad = true;
  let resolveReady;
  const ready = new Promise(r => { resolveReady = r; });

  const unsub = fb.onTripsSnapshot(userId, (trips) => {
    cachedData.trips = trips;
    if (initialLoad) {
      initialLoad = false;
      resolveReady();
    }
    callback(trips);
  });

  return { unsub, ready };
}
