// src/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA1xN-SKMteteCwUT3M8VLY29rCgNfK60o",
    authDomain: "felsefi-1c987.firebaseapp.com",
    projectId: "felsefi-1c987",
    storageBucket: "felsefi-1c987.firebasestorage.app",
    messagingSenderId: "640936464958",
    appId: "1:640936464958:web:9716240389dc2c1668776f",
    measurementId: "G-3HKWTLCCZM"
};

// Başlat ve Dışarı Aktar (Export)
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);