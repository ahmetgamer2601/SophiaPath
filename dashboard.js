import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    doc, getDoc, getDocs, collection, addDoc, query, orderBy, 
    onSnapshot, updateDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- GLOBAL DEĞİŞKENLER ---
let currentUserData = null;

/**
 * 1. OTURUM VE KULLANICI VERİLERİNİ YÖNETME
 * Sayfa açıldığında kullanıcının giriş yapıp yapmadığını kontrol eder.
 */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Kullanıcının Firestore'daki dökümanını dinle (Canlı Güncelleme)
            const userRef = doc(db, "users", user.uid);
            
            onSnapshot(userRef, (userDoc) => {
                if (userDoc.exists()) {
                    currentUserData = userDoc.data();
                    
                    // Veriler geldikten sonra UI'ı güncelle
                    updateUserUI();
                    
                    // Admin kontrolü (Eğer role 'admin' ise artı butonunu göster)
                    const adminBtn = document.querySelector('.admin-only');
                    if (currentUserData.role === 'admin') {
                        adminBtn?.classList.remove('hidden');
                    }
                } else {
                    console.error("Kullanıcı dökümanı bulunamadı!");
                    // Eğer döküman yoksa login'e atabiliriz
                }
            });

            // Diğer sistemleri başlat
            setupNavigation();
            initHomePhilosophers();
            initCollectionSystem();

        } catch (error) {
            console.error("Başlatma hatası:", error);
        }
    } else {
        // Giriş yapmamışsa index.html'e yönlendir
        window.location.href = "index.html";
    }
});

/**
 * 2. KULLANICI ARAYÜZÜNÜ GÜNCELLEME (GEZGİN SORUNU ÇÖZÜMÜ)
 */
function updateUserUI() {
    if (!currentUserData) return;

    // HTML'deki tüm değişken alanları güvenli bir şekilde doldur
    const username = currentUserData.username || "Gezgin";
    const rank = currentUserData.level || "Çırak";
    const points = currentUserData.points || 0;

    // DOM Elementlerini güncelle
    const elements = {
        topUsername: document.getElementById('topUsername'),
        heroName: document.getElementById('heroName'),
        topRank: document.getElementById('topRank'),
        headerPoints: document.getElementById('headerPoints')
    };

    if (elements.topUsername) elements.topUsername.innerText = username;
    if (elements.heroName) elements.heroName.innerText = username;
    if (elements.topRank) elements.topRank.innerText = rank;
    if (elements.headerPoints) elements.headerPoints.innerText = points;
}

/**
 * 3. NAVİGASYON MANTIĞI
 */
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.page-section');

    navButtons.forEach(btn => {
        btn.onclick = () => {
            const target = btn.getAttribute('data-target');
            
            // Aktif buton görselini değiştir
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Sayfalar arası geçiş yap
            sections.forEach(s => s.classList.add('hidden'));
            document.getElementById(target)?.classList.remove('hidden');
        };
    });
}

/**
 * 4. ANA SAYFA FİLOZOF LİSTESİ (REAL-TIME)
 */
function initHomePhilosophers() {
    const phiGrid = document.getElementById('phiGrid');
    if (!phiGrid) return;

    const q = query(collection(db, "philosophers"), orderBy("phiYear", "asc"));

    onSnapshot(q, (snapshot) => {
        phiGrid.innerHTML = "";
        snapshot.forEach(docSnap => {
            const phi = docSnap.data();
            const rarity = phi.phiRarity || "common";
            
            const card = document.createElement('div');
            card.className = `phi-card card-${rarity}`;
            card.innerHTML = `
                <div class="card-img-box">
                    <img src="${phi.phiImg || 'https://via.placeholder.com/200'}" alt="${phi.phiName}">
                </div>
                <div class="card-info">
                    <span class="era-tag">${phi.phiEra || 'Antik Dönem'}</span>
                    <h3>${phi.phiName}</h3>
                    <p>${phi.phiThought ? phi.phiThought.substring(0, 70) + '...' : ''}</p>
                    <div class="rarity-badge badge-${rarity}">${rarity.toUpperCase()}</div>
                </div>
            `;
            card.onclick = () => openReadModal(docSnap.id);
            phiGrid.appendChild(card);
        });
    });
}

/**
 * 5. KOLEKSİSYON (ÇANTA) SİSTEMİ
 * Kullanıcının sahip olduğu kartları 'envanter' dizisinden kontrol eder.
 */
function initCollectionSystem() {
    const collectionGrid = document.getElementById('collectionGrid');
    if (!collectionGrid) return;

    // Filozoflar değiştikçe veya kullanıcı verisi değiştikçe koleksiyonu güncelle
    const q = query(collection(db, "philosophers"), orderBy("phiYear", "asc"));
    
    onSnapshot(q, (snapshot) => {
        collectionGrid.innerHTML = "";
        const userInventory = currentUserData?.inventory || [];

        snapshot.forEach(docSnap => {
            const phi = docSnap.data();
            const rarity = phi.phiRarity || "common";
            const isOwned = userInventory.includes(phi.phiName);
            
            const card = document.createElement('div');
            card.className = `phi-card ${isOwned ? `card-${rarity}` : 'locked'}`;
            
            card.innerHTML = `
                <div class="card-img-box">
                    <img src="${phi.phiImg}" alt="${phi.phiName}">
                    ${!isOwned ? '<div class="lock-overlay"><i class="fa-solid fa-lock"></i></div>' : ''}
                </div>
                <div class="card-info">
                    <span class="era-tag">${phi.phiEra}</span>
                    <h3>${isOwned ? phi.phiName : '???'}</h3>
                    <p>${isOwned ? phi.phiThought.substring(0, 50) + '...' : 'Kilidi açmak için keşfet.'}</p>
                    <div class="rarity-badge badge-${rarity}">${rarity.toUpperCase()}</div>
                </div>
            `;

            if (isOwned) {
                card.onclick = () => openReadModal(docSnap.id);
            }
            collectionGrid.appendChild(card);
        });
    });
}

/**
 * 6. MODAL VE OKUMA SİSTEMİ
 */
async function openReadModal(id) {
    const modal = document.getElementById('readModal');
    const content = document.getElementById('readContent');
    
    const docRef = doc(db, "philosophers", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const phi = docSnap.data();
        content.innerHTML = `
            <div class="modal-phi-header">
                <img src="${phi.phiImg}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; margin-bottom:15px;">
                <h2>${phi.phiName}</h2>
                <span class="era-tag">${phi.phiEra}</span>
            </div>
            <hr style="opacity:0.1; margin:20px 0;">
            <div class="modal-phi-body">
                <h3>Temel Düşünce</h3>
                <p>${phi.phiThought}</p>
                <br>
                <h3>Meşhur Sözü</h3>
                <blockquote style="font-style:italic; color:var(--green);">"${phi.phiQuote || 'Bilgi güçtür.'}"</blockquote>
            </div>
        `;
        modal.style.display = "flex";
    }
}

// Modal Kapatma (Global yapıyoruz ki HTML'den erişilsin)
window.closeModal = (id) => {
    document.getElementById(id).style.display = "none";
};

/**
 * 7. ADMİN: YENİ FİLOZOF EKLEME
 */
const addPhiForm = document.getElementById('addPhiForm');
if (addPhiForm) {
    addPhiForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const newPhi = {
            phiName: document.getElementById('phiName').value,
            phiEra: document.getElementById('phiEra').value,
            phiYear: parseInt(document.getElementById('phiYear').value),
            phiRarity: document.getElementById('phiRarity').value,
            phiImg: document.getElementById('phiImg').value || "https://via.placeholder.com/200",
            phiThought: document.getElementById('phiThought').value,
            phiQuote: document.getElementById('phiQuote').value
        };

        try {
            await addDoc(collection(db, "philosophers"), newPhi);
            alert("Bilgelik başarıyla sisteme eklendi!");
            addPhiForm.reset();
            window.closeModal('adminModal');
        } catch (error) {
            console.error("Ekleme hatası:", error);
        }
    };
}

// Çıkış Yapma
document.getElementById('logoutBtn').onclick = () => signOut(auth);

// Modal dışına tıklandığında kapatma
window.onclick = (event) => {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.style.display = "none";
    }
};
