// src/auth.js
// Merkezi ayar dosyamızdan auth ve db'yi çağırıyoruz

import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Arayüz Elemanları
const splashScreen = document.getElementById('splash-screen');
const authScreen = document.getElementById('auth-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authTitle = document.getElementById('auth-title');

let selectedDevice = "pc"; // Varsayılan

// 1. Cihaz Seçimi
document.getElementById('btn-pc').addEventListener('click', () => {
    localStorage.setItem("sophiaPath_device", "pc");
    selectedDevice = "pc";
    switchScreen();
});

document.getElementById('btn-mobile').addEventListener('click', () => {
    localStorage.setItem("sophiaPath_device", "mobile");
    selectedDevice = "mobile";
    switchScreen();
});

function switchScreen() {
    splashScreen.classList.remove('active');
    splashScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
    authScreen.classList.add('active');
}

// 2. Form Geçişleri
document.getElementById('to-register').addEventListener('click', () => {
    loginForm.classList.remove('active-form');
    loginForm.classList.add('hidden-form');
    registerForm.classList.remove('hidden-form');
    registerForm.classList.add('active-form');
    authTitle.innerText = "Kayıt Ol";
});

document.getElementById('to-login').addEventListener('click', () => {
    registerForm.classList.remove('active-form');
    registerForm.classList.add('hidden-form');
    loginForm.classList.remove('hidden-form');
    loginForm.classList.add('active-form');
    authTitle.innerText = "Giriş Yap";
});

// 3. Kayıt Olma
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
        const userCreds = await createUserWithEmailAndPassword(auth, email, password);
        
        // Veritabanına Profili Kaydet
        await setDoc(doc(db, "users", userCreds.user.uid), {
            username: username,
            email: email,
            role: "user", // Adminleri manuel ayarlayacağız
            device: selectedDevice,
            level: "Epistemon"
        });

        alert("Başarıyla kayıt oldun! Ana sayfaya yönlendiriliyorsun...");
        window.location.href = "dashboard.html"; // ASIL UYGULAMAYA GEÇİŞ

    } catch (error) {
        alert("Hata: " + error.message);
    }
});

// 4. Giriş Yapma
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = "dashboard.html"; // ASIL UYGULAMAYA GEÇİŞ
    } catch (error) {
        alert("Giriş başarısız. E-posta veya şifre hatalı.");
    }
});