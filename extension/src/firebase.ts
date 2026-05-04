import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
export const auth = getAuth(app);
export const db = getFirestore(app);
