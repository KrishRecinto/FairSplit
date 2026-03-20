import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDbPhfLjyXnxsDtlNeRNrQYSJM2NI5CQK0",
  authDomain: "fairsplit-d6d79.firebaseapp.com",
  projectId: "fairsplit-d6d79",
  storageBucket: "fairsplit-d6d79.firebasestorage.app",
  messagingSenderId: "218230898526",
  appId: "1:218230898526:web:8c9b003d881f2682c959cf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function logOut() {
  return signOut(auth);
}

export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// --- Firestore trip operations ---

export async function saveTrip(trip, userId) {
  trip.updatedAt = new Date().toISOString();
  // Ensure the creator's userId is stored and they're in the members list
  if (!trip.ownerUid) trip.ownerUid = userId;
  if (!trip.memberUids) trip.memberUids = [userId];
  if (!trip.memberUids.includes(userId)) trip.memberUids.push(userId);

  await setDoc(doc(db, 'trips', trip.id), trip);
}

export async function loadTrips(userId) {
  const q = query(collection(db, 'trips'), where('memberUids', 'array-contains', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data());
}

export async function getTrip(tripId) {
  const snap = await getDoc(doc(db, 'trips', tripId));
  return snap.exists() ? snap.data() : null;
}

export async function deleteTrip(tripId) {
  await deleteDoc(doc(db, 'trips', tripId));
}

// Real-time listener for a single trip
export function onTripSnapshot(tripId, callback) {
  return onSnapshot(doc(db, 'trips', tripId), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// Real-time listener for all user's trips
export function onTripsSnapshot(userId, callback) {
  const q = query(collection(db, 'trips'), where('memberUids', 'array-contains', userId));
  return onSnapshot(q, (snapshot) => {
    const trips = snapshot.docs.map(d => d.data());
    callback(trips);
  });
}
