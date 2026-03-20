const STORAGE_KEY = 'fairsplit_data';

function defaultData() {
  return { trips: [], activeTripId: null };
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultData();
  } catch {
    return defaultData();
  }
}

export function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getActiveTrip() {
  const data = load();
  if (!data.activeTripId) return null;
  return data.trips.find(t => t.id === data.activeTripId) || null;
}

export function setActiveTrip(tripId) {
  const data = load();
  data.activeTripId = tripId;
  save(data);
}

export function saveTrip(trip) {
  const data = load();
  const idx = data.trips.findIndex(t => t.id === trip.id);
  trip.updatedAt = new Date().toISOString();
  if (idx >= 0) data.trips[idx] = trip;
  else data.trips.push(trip);
  save(data);
}

export function deleteTrip(tripId) {
  const data = load();
  data.trips = data.trips.filter(t => t.id !== tripId);
  if (data.activeTripId === tripId) {
    data.activeTripId = data.trips.length ? data.trips[0].id : null;
  }
  save(data);
}
