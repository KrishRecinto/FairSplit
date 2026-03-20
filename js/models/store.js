import * as fb from '../firebase.js';

// In-memory cache so views can call load()/getActiveTrip() synchronously
let cachedData = { trips: [], activeTripId: null, userId: null };

// --- Sync API (used by views, reads from cache) ---

export function load() {
  return cachedData;
}

export function getActiveTrip() {
  if (!cachedData.activeTripId) return null;
  return cachedData.trips.find(t => t.id === cachedData.activeTripId) || null;
}

export function setActiveTrip(tripId) {
  cachedData.activeTripId = tripId;
  localStorage.setItem('fairsplit_activeTripId', tripId);
}

// --- Async API (writes to Firestore) ---

export async function saveTrip(trip) {
  if (!cachedData.userId) return;
  // Update cache immediately for responsiveness
  const idx = cachedData.trips.findIndex(t => t.id === trip.id);
  trip.updatedAt = new Date().toISOString();
  if (idx >= 0) cachedData.trips[idx] = trip;
  else cachedData.trips.push(trip);
  // Write to Firestore
  await fb.saveTrip(trip, cachedData.userId);
}

export async function deleteTrip(tripId) {
  cachedData.trips = cachedData.trips.filter(t => t.id !== tripId);
  if (cachedData.activeTripId === tripId) {
    cachedData.activeTripId = cachedData.trips.length ? cachedData.trips[0].id : null;
  }
  await fb.deleteTrip(tripId);
}

// --- Join trip by share code ---

export async function joinTripByCode(code) {
  if (!cachedData.userId) return { success: false, error: 'Not signed in' };
  const trip = await fb.findTripByShareCode(code);
  if (!trip) return { success: false, error: 'Trip not found. Check the code and try again.' };
  if (trip.memberUids && trip.memberUids.includes(cachedData.userId)) {
    return { success: true, trip, alreadyMember: true };
  }
  await fb.joinTrip(trip.id, cachedData.userId);
  // Add to cache
  trip.memberUids = trip.memberUids || [];
  trip.memberUids.push(cachedData.userId);
  cachedData.trips.push(trip);
  return { success: true, trip, alreadyMember: false };
}

// --- Init: load from Firestore and set up real-time sync ---

export async function initStore(userId) {
  cachedData.userId = userId;
  cachedData.activeTripId = localStorage.getItem('fairsplit_activeTripId') || null;
  // Initial load
  try {
    cachedData.trips = await fb.loadTrips(userId);
  } catch (err) {
    console.error('Failed to load trips from Firestore:', err);
    cachedData.trips = [];
  }
}

// Set up real-time listener (returns unsubscribe function)
export function onTripsChange(userId, callback) {
  return fb.onTripsSnapshot(userId, (trips) => {
    cachedData.trips = trips;
    callback(trips);
  });
}
