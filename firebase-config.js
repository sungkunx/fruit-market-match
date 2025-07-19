// Firebase configuration and initialization
// TODO: Replace with your actual Firebase config from Firebase Console

const firebaseConfig = {
  apiKey: "AIzaSyDyDqTl2h2KD7APYvsKTz8w9pQ0aCohV9A",
  authDomain: "fruit-market-match.firebaseapp.com",
  projectId: "fruit-market-match",
  storageBucket: "fruit-market-match.firebasestorage.app",
  messagingSenderId: "91761391607",
  appId: "1:91761391607:web:65cc5289d519426859e0f2"
};

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  deleteDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export for use in other files
window.firebaseDB = db;
window.firebaseUtils = {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  serverTimestamp
};