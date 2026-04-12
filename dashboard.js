import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    doc, getDoc, getDocs, collection, addDoc, query, orderBy, 
    limit, onSnapshot, deleteDoc, updateDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- GLOBAL DEĞİŞKENLER ---
let currentUserData = null;

// --- 1. OTURUM VE KULLANICI VERİLERİ ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Firestore'dan kullanıcı verisini çek
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                currentUserData = userDoc.data(); 
                
                // Verileri Arayüze Dağıt ve Sistemleri Başlat
                setupUI();             // Arayüzü ve Navigasyonu hazırla
                initDataListeners();   // Filozofları gerçek zamanlı dinle
                initLeaderboard();     // Liderlik tablosunu çek
                
            } else {
                console.error("Kullanıcı dökümanı bulunamadı!");
            }
        } catch (error) {
            console.error("Veri çekme hatası:", error);
        }
    } else {
        // Oturum kapalıysa giriş sayfasına at
        window.location.href = "index.html"; 
    }
});

// --- ARAYÜZ VE NAVİGASYON MOTORU ---

function setupUI() {
    if (!currentUserData) return; 

    const { username, role, level, points } = currentUserData;

    // 1. Kullanıcı Bilgilerini Yazdır
    const displayNames = ['topUsername', 'heroName', 'displayUsername'];
    displayNames.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = username;
    });
    
    // 2. Puan ve Rütbe Güncelleme
    const arenaPointsDisplay = document.querySelector('.stat-box .text-yellow')?.parentElement?.querySelector('.stat-value');
    if (arenaPointsDisplay) {
        arenaPointsDisplay.innerText = points || 0;
    }

    const rankElement = document.getElementById('topRank');
    if (rankElement) rankElement.innerText = level || "Epistemon";

    // 3. Admin Kontrolü
    if (role === "admin") {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }

    // 4. Navigasyonu Başlat
    setupNavigation();
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.page-section');

    navButtons.forEach(btn => {
        // .onclick kullanımı mevcut eski olayları temizler ve çakışmayı önler
        btn.onclick = () => {
            const targetId = btn.getAttribute('data-target');

            // Aktif buton stilini değiştir
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Sayfaları değiştir
            sections.forEach(section => {
                section.classList.add('hidden');
                if (section.id === targetId) {
                    section.classList.remove('hidden');
                }
            });

            // Koleksiyon tıklandıysa motoru çalıştır
            if (targetId === 'collection-section') {
                if (typeof renderCollection === "function") {
                    renderCollection();
                }
            }
        };
    });
}

// --- 2. NAVİGASYON KONTROLLERİ (PC & MOBİL) ---
const allNavButtons = document.querySelectorAll('.nav-btn, .sub-btn, .dock-item');
const allSections = document.querySelectorAll('.page-section');

allNavButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        if (!target) return;

        // Sayfa Değiştir
        allSections.forEach(sec => sec.classList.add('hidden'));
        document.getElementById(target).classList.remove('hidden');

        // Aktif Buton Stilini Güncelle
        allNavButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Mobilde menü tıklandığında profil menüsü açıksa kapat
        document.getElementById('profileMenu').classList.add('hidden');
    });
});

// Yan Menü Dropdown (Öğrenme Odaları)
const learningToggle = document.getElementById('learningToggle');
if (learningToggle) {
    learningToggle.addEventListener('click', () => {
        learningToggle.parentElement.classList.toggle('open');
    });
}

// Profil Menüsü (Açılır/Kapanır)
const profileTrigger = document.getElementById('profileTrigger');
const profileMenu = document.getElementById('profileMenu');

if (profileTrigger) {
    profileTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle('hidden');
    });
}

// Ekranda herhangi bir yere tıklandığında menüleri kapat
document.addEventListener('click', () => {
    profileMenu.classList.add('hidden');
});

// ==========================================
// KARTLARI VE ZAMAN AKIŞINI GETİREN FONKSİYON
// ==========================================
function initDataListeners() {
    const phiGrid = document.getElementById('phiGrid');
    const timelineWrapper = document.getElementById('timelineWrapper');
    
    if (!phiGrid) return; // Hata almamak için güvenlik kontrolü

    const phiQuery = query(collection(db, "philosophers"), orderBy("phiYear", "asc"));

    onSnapshot(phiQuery, (snapshot) => {
        phiGrid.innerHTML = "";
        if(timelineWrapper) timelineWrapper.innerHTML = "";
        
        let cardCount = 0;

        snapshot.forEach((docSnap) => {
            const phi = docSnap.data();
            const id = docSnap.id;
            cardCount++;

            // YENİ KAYDIRILABİLİR KART YAPISI
            const card = document.createElement('div');
            card.className = "phi-card";
            
            card.innerHTML = `
                ${currentUserData && currentUserData.role === 'admin' ? `<button class="delete-btn" onclick="deletePhilosopher('${id}')" style="position:absolute; top:10px; right:10px; z-index:10; background:red; border:none; color:white; border-radius:50%; width:30px; height:30px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>` : ''}
                <div class="card-img-box" onclick="viewPhilosopher('${id}')">
                    <img src="${phi.phiImg || 'https://images.unsplash.com/photo-1549813067-14a044b755ee?q=80&w=500'}" alt="${phi.phiName}">
                </div>
                <div class="card-info-content" onclick="viewPhilosopher('${id}')">
                    <h4 style="margin:0; font-size:1.1rem;">${phi.phiName}</h4>
                    <small class="profile-badge" style="display:inline-block; margin:8px 0;">${phi.phiEra}</small>
                    <p style="font-size: 0.9rem; color: #ccc; line-height:1.5;">${phi.phiThought}</p>
                </div>
            `;
            phiGrid.appendChild(card);

            // ZAMAN AKIŞINI DOLDUR
            if(timelineWrapper) {
                const tlItem = document.createElement('div');
                tlItem.className = "timeline-item";
                tlItem.innerHTML = `<strong>${phi.phiEra}</strong> - ${phi.phiName}`;
                timelineWrapper.appendChild(tlItem);
            }
        });

        // OKUNAN KART İSTATİSTİĞİNİ GÜNCELLE
        const stats = document.querySelectorAll('.stat-value');
        if(stats[2]) stats[2].innerText = cardCount;
    });
}

// ==========================================
// CANLI LİDERLİK TABLOSUNU GETİREN FONKSİYON
// ==========================================
function initLeaderboard() {
    const leaderboardBody = document.getElementById('leaderboardBody');
    if (!leaderboardBody) return; // Tablo HTML'de yoksa hata verme

    try {
        // En yüksek puanı olan ilk 10 kişiyi getir
        const q = query(collection(db, "users"), orderBy("points", "desc"), limit(10));

        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                leaderboardBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px;">Henüz arenada savaşan kimse yok.</td></tr>`;
                return;
            }

            leaderboardBody.innerHTML = "";
            let rank = 1;

            snapshot.forEach((docSnap) => {
                const user = docSnap.data();
                
                // İsim yoksa Gezgin, puan yoksa 0 ata
                const username = user.username || "Anonim Gezgin";
                const points = user.points || 0;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="width: 50px; font-weight: bold;">#${rank}</td>
                    <td>
                        <div class="leaderboard-name">
                            <img src="https://ui-avatars.com/api/?name=${username}&background=random" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                            <span>${username}</span>
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: bold; color: var(--green);">${points} <small style="color:var(--text-dim); font-weight:normal;">XP</small></td>
                `;
                leaderboardBody.appendChild(row);
                rank++;
            });
        }, (error) => {
            console.error("Liderlik tablosu hatası:", error);
            leaderboardBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red;">Tablo yüklenemedi. İndeks hatası olabilir (Konsola bak).</td></tr>`;
        });
    } catch (err) {
        console.error("Liderlik tablosu başlatılamadı:", err);
    }
}
// --- 4. FONKSİYONLAR (PENCERELER VE İŞLEMLER) ---

// Filozof Detayını Görüntüle
window.viewPhilosopher = async (id) => {
    try {
        const docSnap = await getDoc(doc(db, "philosophers", id));
        if (docSnap.exists()) {
            const phi = docSnap.data();
            const content = document.getElementById('readContent');
            content.innerHTML = `
                <div style="text-align:center">
                    <img src="${phi.phiImg}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:3px solid var(--green); margin-bottom:15px;">
                    <h2>${phi.phiName}</h2>
                    <span class="profile-badge">${phi.phiEra}</span>
                </div>
                <hr>
                <p>${phi.phiThought}</p>
                <blockquote>"${phi.phiQuote}"</blockquote>
            `;
            openModal('readModal');
        }
    } catch (e) {
        alert("Bilgi yüklenirken hata oluştu.");
    }
};

// Filozof Sil (Sadece Admin)
window.deletePhilosopher = async (id) => {
    if (confirm("Bu düşünürü tarihin tozlu sayfalarına gömmek istediğine emin misin? (SİLİNECEK)")) {
        try {
            await deleteDoc(doc(db, "philosophers", id));
        } catch (e) {
            alert("Silme yetkiniz yok veya bir hata oluştu.");
        }
    }
};

// Yeni Filozof Kaydet
const addPhiForm = document.getElementById('addPhiForm');
if (addPhiForm) {
    addPhiForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Formdan verileri ve nadirlik seçimini alıyoruz
        const newPhi = {
            phiName: document.getElementById('phiName').value,
            phiEra: document.getElementById('phiEra').value,
            phiYear: parseInt(document.getElementById('phiYear').value),
            phiImg: document.getElementById('phiImg').value || "https://images.unsplash.com/photo-1549813067-14a044b755ee?q=80&w=500",
            phiThought: document.getElementById('phiThought').value,
            phiQuote: document.getElementById('phiQuote').value,
            phiRarity: document.getElementById('phiRarity').value, // <-- İŞTE BURASI! Nadirlik değerini ekledik.
            createdAt: new Date()
        };

        try {
            // Firebase'e kaydetme işlemi (Mevcut kodunun devamı)
            await addDoc(collection(db, "philosophers"), newPhi);
            
            // Başarılı ise formu temizle ve kapat
            addPhiForm.reset();
            closeModal('adminModal');
            alert("Filozof başarıyla sisteme ve koleksiyon havuzuna eklendi!");
        } catch (error) {
            console.error("Kaydedilirken hata oluştu: ", error);
            alert("Bir hata oluştu, konsolu kontrol et.");
        }
    });
}
// --- 5. YARDIMCI FONKSİYONLAR ---
window.openModal = (id) => {
    document.getElementById(id).style.display = 'flex';
};

window.closeModal = (id) => {
    document.getElementById(id).style.display = 'none';
};

// Çıkış Yap
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth);
});


// --- ARENA SİSTEMİ (GÜNCELLENMİŞ FULL VERSİYON) ---
let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timeLeft = 15;

const findMatchBtn = document.getElementById('findMatchBtn');
const lobby = document.getElementById('arena-lobby');
const battle = document.getElementById('arena-battle');
const result = document.getElementById('arena-result');

findMatchBtn.addEventListener('click', startSearch);

// 1. SORU HAVUZU VE YÜKLEME
function loadQuestionsFromCode() {
    // Buraya istediğin kadar soru ekleyebilirsin, Firebase ile uğraşmana gerek kalmaz.
    const allQuestions = [
        { q: "Sokrates'in en ünlü öğrencisi kimdir?", o: ["Aristoteles", "Platon", "Epikür", "Zeno"], a: "Platon" },
        { q: "'Bildiğim tek şey, hiçbir şey bilmediğimdir' kime aittir?", o: ["Sokrates", "Descartes", "Kant", "Nietzsche"], a: "Sokrates" },
        { q: "Modern felsefenin babası sayılan filozof?", o: ["Hegel", "Spinoza", "Descartes", "Locke"], a: "Descartes" },
        { q: "Aristoteles'e göre 'Erdem' nerede bulunur?", o: ["Uç noktalarda", "Altın ortada", "Sadece fikirlerde", "Tanrı katında"], a: "Altın ortada" },
        { q: "Varoluşçuluk akımının en önemli temsilcilerinden biri?", o: ["Jean-Paul Sartre", "Thomas Hobbes", "John Locke", "David Hume"], a: "Jean-Paul Sartre" },
        { q: "Mağara Alegorisi hangi filozofa aittir?", o: ["Aristoteles", "Platon", "Sokrates", "Farabi"], a: "Platon" },
    { q: "İnsan doğasını 'Tabula Rasa' (Boş Levha) olarak tanımlayan kimdir?", o: ["John Locke", "Thomas Hobbes", "Kant", "Descartes"], a: "John Locke" },
    { q: "Devlet için 'Leviathan' benzetmesini yapan düşünür hangisidir?", o: ["Rousseau", "Machiavelli", "Thomas Hobbes", "Marx"], a: "Thomas Hobbes" },
    { q: "Ahlak felsefesinde 'Ödev Ahlakı' ve 'Kategorik İmperatif' kime aittir?", o: ["Nietzsche", "Spinoza", "Kant", "Mill"], a: "Kant" },
    { q: "İslam dünyasında 'Muallim-i Sani' (İkinci Öğretmen) kimdir?", o: ["Gazali", "Farabi", "İbn-i Sina", "İbn-i Rüşd"], a: "Farabi" },
    { q: "İbn-i Sina'nın ruhun bedenden ayrı olduğunu kanıtladığı deneyin adı nedir?", o: ["Mağara Deneyi", "Uçan Adam", "Gemi Deneyi", "Kedi Deneyi"], a: "Uçan Adam" },
    { q: "'Varoluş özden önce gelir' diyerek varoluşçuluğu özetleyen kimdir?", o: ["Albert Camus", "Sartre", "Heidegger", "Kierkegaard"], a: "Sartre" },
    { q: "Sokrates'in bilgiyi sorularla ortaya çıkarma yöntemine ne ad verilir?", o: ["Diyalektik", "Maiyutik (Doğurtma)", "Arke", "Paradigma"], a: "Maiyutik (Doğurtma)" },
    { q: "Bilimin 'Paradigma' değişimleriyle ilerlediğini savunan bilim filozofu?", o: ["Karl Popper", "Thomas Kuhn", "Newton", "Francis Bacon"], a: "Thomas Kuhn" },
    { q: "Panteist bir anlayışla 'Tanrı ya da Doğa' diyen filozof hangisidir?", o: ["Spinoza", "Descartes", "Hegel", "Leibniz"], a: "Spinoza" },
    { q: "Sisifos Söyleni eseriyle 'Absürdizm'i anlatan yazar-filozof?", o: ["Sartre", "Nietzsche", "Albert Camus", "Kafka"], a: "Albert Camus" },
    { q: "Aristoteles'e göre erdemli yaşamın anahtarı olan denge durumu nedir?", o: ["Mutlak İyi", "Altın Orta", "Nirvana", "Ataraxia"], a: "Altın Orta" },
    { q: "Modern felsefenin kurucusu sayılan 'Şüpheci' düşünür kimdir?", o: ["David Hume", "Descartes", "Kant", "Locke"], a: "Descartes" },
    { q: "Gazali'nin filozofları eleştirdiği meşhur eserinin adı nedir?", o: ["El-Kanun", "Medinetü'l Fazıla", "Tehâfütü'l-Felâsife", "İhya"], a: "Tehâfütü'l-Felâsife" }
    ];

    // Soruları karıştır ve içinden 5 tanesini seç
    return allQuestions.sort(() => Math.random() - 0.5).slice(0, 5);
}

// 2. ARAMA VE BAŞLATMA
async function startSearch() {
    findMatchBtn.innerText = "Düello Hazırlanıyor...";
    findMatchBtn.disabled = true;

    // UX için kısa bir bekleme süresi
    setTimeout(() => {
        // Soruları kod içindeki havuzdan çekiyoruz
        currentQuestions = loadQuestionsFromCode();
        
        lobby.classList.add('hidden');
        battle.classList.remove('hidden');
        showQuestion();
    }, 1500);
}

// 3. SORUYU EKRANA BASMA
function showQuestion() {
    if (currentQuestionIndex >= currentQuestions.length) {
        endBattle();
        return;
    }

    const qData = currentQuestions[currentQuestionIndex];
    document.getElementById('questionText').innerText = qData.q;
    document.getElementById('questionCount').innerText = `Soru ${currentQuestionIndex + 1}/${currentQuestions.length}`;
    
    const grid = document.getElementById('optionsGrid');
    grid.innerHTML = "";
    
    qData.o.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "option-btn";
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(opt, qData.a, btn);
        grid.appendChild(btn);
    });

    startTimer();
}

// 4. CEVAP KONTROL VE ZAMANLAYICI
function startTimer() {
    timeLeft = 15;
    const bar = document.getElementById('timerProgress');
    const text = document.getElementById('timeLeft');
    
    clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        text.innerText = timeLeft + "s";
        bar.style.width = (timeLeft / 15) * 100 + "%";
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            nextQuestion();
        }
    }, 1000);
}

function checkAnswer(selected, correct, btn) {
    clearInterval(timer);
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.disabled = true);

    if (selected === correct) {
        btn.classList.add('correct');
        score += 10 + timeLeft; // Doğru cevap + kalan süre puanı
    } else {
        btn.classList.add('wrong');
    }

    setTimeout(nextQuestion, 1200);
}

function nextQuestion() {
    currentQuestionIndex++;
    showQuestion();
}

// 5. BİTİŞ VE PUANI FİREBASE'E KAYDETME
async function endBattle() {
    battle.classList.add('hidden');
    result.classList.remove('hidden');
    document.getElementById('resultMsg').innerText = `Tebrikler! Toplam ${score} Arena Puanı kazandın.`;
    
    // Firebase güncellemesi
    if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        try {
            await updateDoc(userRef, {
                points: increment(score) // Mevcut puanın üzerine ekler
            });
            console.log("Puan başarıyla Firebase'e işlendi.");
        } catch (e) {
            console.error("Puan kaydedilemedi:", e);
        }
    }
}

window.resetArena = () => {
    result.classList.add('hidden');
    lobby.classList.remove('hidden');
    findMatchBtn.innerText = "Düello Ara";
    findMatchBtn.disabled = false;
    currentQuestionIndex = 0;
    score = 0;
};

// JS dosyasının en altına, her şeyin dışına ekle:
window.addEventListener('DOMContentLoaded', () => {
    initDataListeners();
    initLeaderboard();
});


// ==========================================
// KİMİN SÖZÜ? OYUN MOTORU (VİP TASARIM)
// ==========================================
let quoteGameData = {
    philosophers: [],
    current: null,
    streak: 0,
    timer: null,
    timeLeft: 10
};

// Modül içinde fonksiyonun HTML'den tetiklenebilmesi için window'a ekledik
window.startQuoteGame = async () => {
    const lobby = document.getElementById('arena-lobby');
    const quoteArena = document.getElementById('quote-game-arena');

    // Lobi gizle, Oyun sahasını aç
    lobby.classList.add('hidden');
    quoteArena.classList.remove('hidden');
    quoteArena.innerHTML = `<h2 style="padding: 40px; color: var(--text-dim);">Filozoflar Çağrılıyor...</h2>`;

    try {
        const snap = await getDocs(collection(db, "philosophers"));
        quoteGameData.philosophers = [];
        snap.forEach(d => {
            if(d.data().phiQuote) quoteGameData.philosophers.push(d.data());
        });

        if(quoteGameData.philosophers.length < 4) {
            alert("Oyunu oynamak için sistemde sözü olan en az 4 filozof olmalı.");
            resetQuoteGameScreen();
            return;
        }

        quoteGameData.streak = 0;
        
        // Oyun iskeletini çiz
        quoteArena.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 25px;">
                <div style="background: var(--green); color: black; padding: 6px 15px; border-radius: 20px; font-weight: bold;">Seri: <span id="quoteStreak">0</span></div>
                <div style="background: #e74c3c; color: white; padding: 6px 15px; border-radius: 20px; font-weight: bold;"><i class="fa-solid fa-stopwatch"></i> <span id="quoteTimer">10</span>s</div>
            </div>
            <div style="padding: 30px; border: 2px dashed var(--yellow); border-radius: 16px; margin-bottom: 30px; background: rgba(0,0,0,0.3);">
                <h3 id="quoteText" style="font-size: 1.4rem; font-style: italic; color: #fff; line-height: 1.6;">"Yükleniyor..."</h3>
            </div>
            <div id="quoteOptionsGrid" class="options-grid"></div>
        `;

        renderQuoteRound();
    } catch (error) {
        console.error("Hata:", error);
        resetQuoteGameScreen();
    }
};

window.handleQuoteAnswer = (selectedName, element) => {
    clearInterval(quoteGameData.timer);
    
    // Çift tıklamayı önlemek için butonları kilitle
    const allButtons = document.querySelectorAll('#quoteOptionsGrid .option-btn');
    allButtons.forEach(btn => btn.style.pointerEvents = 'none');
    
    if(selectedName === quoteGameData.current.phiName) {
        element.classList.add('correct');
        quoteGameData.streak++;
        setTimeout(() => renderQuoteRound(), 800); // 0.8sn yeşil yanıp yeni soruya geçer
    } else {
        element.classList.add('wrong');
        setTimeout(() => finishQuoteGame(`Yanlış! Sözün sahibi: <strong>${quoteGameData.current.phiName}</strong>`), 1000);
    }
};

function renderQuoteRound() {
    const randomPhi = quoteGameData.philosophers[Math.floor(Math.random() * quoteGameData.philosophers.length)];
    quoteGameData.current = randomPhi;

    document.getElementById('quoteText').innerText = `"${randomPhi.phiQuote}"`;
    document.getElementById('quoteStreak').innerText = quoteGameData.streak;

    let opts = [randomPhi.phiName];
    let others = quoteGameData.philosophers.filter(p => p.phiName !== randomPhi.phiName);
    others.sort(() => Math.random() - 0.5);
    opts.push(others[0].phiName, others[1].phiName, others[2].phiName);
    opts.sort(() => Math.random() - 0.5);

    // Seçenekleri rekabetçi moddaki buton sınıfıyla (option-btn) bas
    const grid = document.getElementById('quoteOptionsGrid');
    grid.innerHTML = opts.map(o => `
        <button class="option-btn" onclick="handleQuoteAnswer('${o}', this)">${o}</button>
    `).join('');

    resetQuoteTimer();
}

function resetQuoteTimer() {
    clearInterval(quoteGameData.timer);
    quoteGameData.timeLeft = 10;
    document.getElementById('quoteTimer').innerText = quoteGameData.timeLeft;

    quoteGameData.timer = setInterval(() => {
        quoteGameData.timeLeft--;
        document.getElementById('quoteTimer').innerText = quoteGameData.timeLeft;
        if(quoteGameData.timeLeft <= 0) {
            clearInterval(quoteGameData.timer);
            finishQuoteGame("Zaman Doldu!");
        }
    }, 1000);
}

async function finishQuoteGame(msg) {
    const quoteArena = document.getElementById('quote-game-arena');
    const xp = quoteGameData.streak * 5;

    quoteArena.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <i class="fa-solid fa-comment-dots result-icon" style="color: var(--yellow);"></i>
            <h2 style="color: var(--yellow); margin-bottom: 10px;">Oyun Bitti</h2>
            <p style="color: var(--text-dim); font-size: 1.1rem;">${msg}</p>
            <h1 style="font-size: 4rem; margin: 20px 0;">${quoteGameData.streak} <span style="font-size: 1.5rem; color: #777;">Seri</span></h1>
            <p style="font-size: 1.2rem; font-weight: bold; color: var(--green);">+${xp} XP Kazandın</p>
            <button class="btn-save" onclick="resetQuoteGameScreen()" style="margin-top: 30px;">Arenaya Dön</button>
        </div>
    `;

    // XP Firebase'e yazdırılıyor
    if(xp > 0 && auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            points: increment(xp)
        });
    }
}

window.resetQuoteGameScreen = () => {
    document.getElementById('quote-game-arena').classList.add('hidden');
    document.getElementById('arena-lobby').classList.remove('hidden');
};




// --- KOLEKSİYON SİSTEMİ: KARTLARI LİSTELEME ---
async function renderCollection() {
    const collectionGrid = document.getElementById('collection-grid');
    if (!collectionGrid) return;

    collectionGrid.innerHTML = `<div class="loading-msg">Çanta düzenleniyor...</div>`;

    try {
        // 1. Tüm filozofları çek (Sıralama yılına göre)
        const q = query(collection(db, "philosophers"), orderBy("phiYear", "asc"));
        const snapshot = await getDocs(q);
        
        // 2. Kullanıcının envanterini al (Yoksa boş dizi say)
        const userInventory = currentUserData?.inventory || [];

        let html = "";

        snapshot.forEach(doc => {
            const phi = doc.data();
            const rarity = phi.phiRarity || "common";
            
            // Kullanıcı bu filozofa sahip mi?
            const isOwned = userInventory.includes(phi.phiName);
            
            // Sahip değilse "locked" sınıfı, sahipse nadirlik sınıfı ekle
            const statusClass = isOwned ? `card-${rarity}` : "locked";

            html += `
                <div class="phi-card ${statusClass}" ${isOwned ? `onclick="openReadModal('${doc.id}')"` : ""}>
                    <div class="card-img-box">
                        <img src="${phi.phiImg}" alt="${phi.phiName}">
                        ${!isOwned ? '<div class="lock-overlay"><i class="fa-solid fa-lock"></i></div>' : ""}
                    </div>
                    <div class="card-info">
                        <span class="era-tag">${phi.phiEra}</span>
                        <h3>${phi.phiName}</h3>
                        <p>${isOwned ? phi.phiThought.substring(0, 60) + "..." : "??? Bilinmiyor ???"}</p>
                        <div class="rarity-badge badge-${rarity}">${rarity.toUpperCase()}</div>
                    </div>
                </div>
            `;
        });

        collectionGrid.innerHTML = html;

    } catch (error) {
        console.error("Koleksiyon yüklenirken hata:", error);
        collectionGrid.innerHTML = "Koleksiyon yüklenemedi.";
    }
}


// dashboard.js dosyanın en altına bunları ekle:


async function renderCollection() {
    const collectionGrid = document.getElementById('collection-grid');
    if (!collectionGrid) return;

    collectionGrid.innerHTML = `<div class="loading-msg">Çanta düzenleniyor...</div>`;

    try {
        const q = query(collection(db, "philosophers"), orderBy("phiYear", "asc"));
        const snapshot = await getDocs(q);
        const userInventory = currentUserData?.inventory || [];

        let html = "";
        snapshot.forEach(docSnap => {
            const phi = docSnap.data();
            const rarity = phi.phiRarity || "common";
            const isOwned = userInventory.includes(phi.phiName);
            const statusClass = isOwned ? `card-${rarity}` : "locked";

            html += `
                <div class="phi-card ${statusClass}" ${isOwned ? `onclick="openReadModal('${docSnap.id}')"` : ""}>
                    <div class="card-img-box">
                        <img src="${phi.phiImg}" alt="${phi.phiName}">
                        ${!isOwned ? '<div class="lock-overlay"><i class="fa-solid fa-lock"></i></div>' : ""}
                    </div>
                    <div class="card-info">
                        <span class="era-tag">${phi.phiEra}</span>
                        <h3>${phi.phiName}</h3>
                        <p>${isOwned ? (phi.phiThought?.substring(0, 60) + "...") : "??? Bilinmiyor ???"}</p>
                        <div class="rarity-badge badge-${rarity}">${rarity.toUpperCase()}</div>
                    </div>
                </div>`;
        });
        collectionGrid.innerHTML = html;
    } catch (error) {
        console.error("Koleksiyon hatası:", error);
        collectionGrid.innerHTML = "Veriler yüklenemedi.";
    }
}

// ÖNEMLİ: setupUI fonksiyonunun en sonuna setupNavigation(); satırını eklemeyi unutma!