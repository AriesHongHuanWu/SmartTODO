import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDfn3ACarmmVYCW3Sz872UUJyaB9i_284E",
  authDomain: "smarttodo-245f9.firebaseapp.com",
  projectId: "smarttodo-245f9",
  storageBucket: "smarttodo-245f9.firebasestorage.app",
  messagingSenderId: "651874494995",
  appId: "1:651874494995:web:d9136f97f588aa9f59ede6",
  measurementId: "G-R7ENMYNS1C"
};

const app = initializeApp(firebaseConfig);

// In Chrome Extension Manifest V3, we must use initializeAuth with indexedDBLocalPersistence
// standard getAuth() often fails or loses session in service workers.
export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence
});

export const db = getFirestore(app);
