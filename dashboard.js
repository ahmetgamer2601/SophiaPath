/**
 * SophiaPath — Dashboard Logic
 * Modular ES6+ | Firebase Realtime | Skeleton Loaders | Toast Notifications
 */

import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    doc, getDoc, getDocs, addDoc, deleteDoc, updateDoc,
    collection, query, orderBy, limit, onSnapshot, increment, where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";


// ============================================================
// GLOBAL STATE
// ============================================================
let currentUserData = null;
let allPhilosophers  = []; // Gerçek zamanlı Firestore verisi (yerel cache)
let unsubLeaderboard = null;
let unsubPhilosophers = null;

const RANK_TITLES = [
    { min: 0,    label: "Epistemon" },
    { min: 100,  label: "Philosophos" },
    { min: 300,  label: "Sophistes" },
    { min: 700,  label: "Didaskalos" },
    { min: 1500, label: "Archon" },
    { min: 3000, label: "Sophokles" },
];


// ============================================================
// A. TOAST NOTIFICATION SİSTEMİ
// ============================================================
const TOAST_ICONS = {
    success: '<i class="fa-solid fa-circle-check"></i>',
    error:   '<i class="fa-solid fa-circle-xmark"></i>',
    info:    '<i class="fa-solid fa-circle-info"></i>',
    warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
};

/**
 * Toast bildirimi gösterir.
 * @param {string} type      - "success" | "error" | "info" | "warning"
 * @param {string} title     - Kalın başlık
 * @param {string} message   - Alt açıklama (isteğe bağlı)
 * @param {number} duration  - ms cinsinden (varsayılan: 4000)
 */
export function showToast(type = "info", title = "", message = "", duration = 4000) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-msg">${message}</div>` : ""}
        </div>
        <button class="toast-close" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
    `;

    const removeToast = () => {
        toast.classList.add("removing");
        toast.addEventListener("animationend", () => toast.remove(), { once: true });
    };

    toast.querySelector(".toast-close").addEventListener("click", removeToast);
    container.appendChild(toast);
    if (duration > 0) setTimeout(removeToast, duration);
}


// ============================================================
// B. AUTH & BAŞLANGIÇ
// ============================================================
// ============================================================
// B. AUTH & BAŞLANGIÇ (TAMİR EDİLDİ)
// ============================================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    try {
        console.log("Giriş başarılı, veriler kontrol ediliyor...");
        const userRef  = doc(db, "users", user.uid);
        
        // Önce verinin varlığını bir kez kontrol et
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.error("Firestore'da döküman yok! UID:", user.uid);
            showToast("error", "Kullanıcı Bulunamadı", "Veritabanında profiliniz eksik.");
            return;
        }

        // Veriyi al ve global state'e yaz
        currentUserData = { ...userSnap.data(), uid: user.uid };
        console.log("Veri yüklendi:", currentUserData.username);

        // --- SİSTEMLERİ SIRAYLA BAŞLAT ---
        // Dinleyiciyi hemen başlatıyoruz ki değişimleri yakalasın
        initUserListener(user.uid);

        // Arayüzü hazırla
        setupUI();
        setupNavigation();
        setupSearch();
        
        // Diğer verileri çek
        initDataListeners();
        initLeaderboard();

        // Admin Paneli Görünürlüğü (Senin role: "admin" verine göre)
        if (currentUserData.role === "admin") {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            initAdminUsersListener();
        }

        // Yükleniyor durumunu bitir (CSS'te body.loading varsa)
        document.body.classList.remove('loading');

    } catch (err) {
        console.error("Kritik Başlangıç Hatası:", err);
        showToast("error", "Bağlantı Hatası", "Firebase verilerine erişilemiyor.");
    }
});

// ============================================================
// C. GERÇEK ZAMANLI KULLANICI DİNLEYİCİSİ
// ============================================================
function initUserListener(uid) {
    const userRef = doc(db, "users", uid);

    onSnapshot(userRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        currentUserData = { ...currentUserData, ...data, uid };

        // Anlık stat güncelleme
        const pts = data.points ?? 0;

        animateCounter("statPointsVal", pts);
        animateCounter("statStreakVal", data.dailyStreak ?? 0);

        const rankTitle = getRankTitle(pts);

        // Arena Puanı (lobi)
        const arenaPointsEl = document.getElementById("arenaPoints");
        if (arenaPointsEl) arenaPointsEl.textContent = pts;

        // Top bar
        const rankEl = document.getElementById("topRank");
        if (rankEl) { rankEl.textContent = rankTitle; rankEl.style.display = ""; }

        const menuRankEl = document.getElementById("menuRank");
        if (menuRankEl) menuRankEl.textContent = rankTitle;
    }, (err) => {
        console.error("Kullanıcı dinleyici hatası:", err);
    });
}


// ============================================================
// D. ARAYÜZ SETUP
// ============================================================
function setupUI() {
    if (!currentUserData) return;

    const { username, role, points = 0 } = currentUserData;
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=1DB954&color=fff&bold=true`;

    // Kullanıcı adlarını doldur
    ["topUsername", "heroName", "menuUsername"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = username; }
    });

    // Skeleton placeholder'larını temizle
    document.getElementById("skUsernameTop")?.remove();

    // Avatarları güncelle
    document.querySelectorAll("#topAvatar, #menuAvatar").forEach(img => {
        img.src = avatarUrl;
        img.alt = username;
    });

    // Sidebar kullanıcı özeti
    const summary = document.getElementById("sidebarUserSummary");
    if (summary) {
        summary.innerHTML = `
            <img src="${avatarUrl}" style="width:36px;height:36px;border-radius:50%;border:2px solid var(--green-dim);object-fit:cover;" alt="${username}">
            <div class="sidebar-user-info">
                <span style="font-size:0.82rem;font-weight:600;">${username}</span>
                <span style="font-size:0.7rem;color:var(--text-secondary);">${getRankTitle(points)}</span>
            </div>
        `;
    }

    // Admin panelini göster
    if (role === "admin") {
        document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
    }
}


// ============================================================
// E. NAVİGASYON
// ============================================================
function setupNavigation() {
    const allNavBtns  = document.querySelectorAll(".nav-btn[data-target], .sub-btn[data-target], .dock-item[data-target], .admin-users-btn, .hero-cta-btn");
    const allSections = document.querySelectorAll(".page-section");

    const switchSection = (targetId, triggerEl) => {
        if (!targetId) return;
        const targetSection = document.getElementById(targetId);
        if (!targetSection) return;

        // Aktif seksiyonu değiştir
        allSections.forEach(sec => sec.classList.add("hidden"));
        targetSection.classList.remove("hidden");
        // Animasyon için class tekrar tetikle
        targetSection.classList.remove("active");
        void targetSection.offsetWidth; // reflow
        targetSection.classList.add("active");

        // Aktif nav stilini güncelle
        document.querySelectorAll(".nav-btn, .sub-btn, .dock-item").forEach(b => b.classList.remove("active"));
        if (triggerEl) triggerEl.classList.add("active");

        // Eşleşen dock item'ı aktifle
        document.querySelectorAll(`.dock-item[data-target="${targetId}"]`).forEach(d => d.classList.add("active"));

        // Eşleşen sidebar nav-btn'ı aktifle
        document.querySelectorAll(`.nav-btn[data-target="${targetId}"], .sub-btn[data-target="${targetId}"]`).forEach(b => b.classList.add("active"));

        // Menüyü kapat
        document.getElementById("profileMenu")?.classList.add("hidden");

        // Scroll en üste
        document.getElementById("mainWrapper")?.scrollTo({ top: 0, behavior: "smooth" });
    };

    allNavBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const target = btn.getAttribute("data-target");
            switchSection(target, btn);
        });
    });

    // Admin kullanıcı yönetimi butonu
    const adminUsersBtn = document.querySelector(".admin-users-btn");
    if (adminUsersBtn) {
        adminUsersBtn.addEventListener("click", () => switchSection("admin-users-section", null));
    }

    // Dropdown (Öğrenme Odaları)
    const learningToggle = document.getElementById("learningToggle");
    if (learningToggle) {
        learningToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            document.getElementById("learningDropdown")?.classList.toggle("open");
        });
    }

    // Profil menüsü
    const profileTrigger = document.getElementById("profileTrigger");
    const profileMenu    = document.getElementById("profileMenu");
    if (profileTrigger && profileMenu) {
        profileTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle("hidden");
            profileTrigger.querySelector(".profile-arrow")?.style.setProperty(
                "transform",
                profileMenu.classList.contains("hidden") ? "rotate(0)" : "rotate(180deg)"
            );
        });
    }

    // Dışarı tıklanınca kapat
    document.addEventListener("click", () => {
        document.getElementById("profileMenu")?.classList.add("hidden");
    });

    // Çıkış yap
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        signOut(auth).then(() => {
            showToast("info", "Çıkış Yapıldı", "Güvende kal, gezgin.");
        });
    });
}

// Menüyü dışarıdan kapat (HTML onclick kullanımı için)
window.closeSelfMenu = () => {
    document.getElementById("profileMenu")?.classList.add("hidden");
};


// ============================================================
// F. GLOBAL ARAMA
// ============================================================
function setupSearch() {
    const input    = document.getElementById("globalSearch");
    const dropdown = document.getElementById("searchDropdown");
    if (!input || !dropdown) return;

    let debounceTimer;

    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim().toLowerCase();

        if (query.length < 2) {
            dropdown.classList.add("hidden");
            return;
        }

        debounceTimer = setTimeout(() => {
            const results = allPhilosophers.filter(p =>
                p.phiName.toLowerCase().includes(query) ||
                p.phiEra.toLowerCase().includes(query) ||
                (p.phiThought || "").toLowerCase().includes(query)
            ).slice(0, 6);

            if (!results.length) {
                dropdown.innerHTML = `<div class="search-result-item" style="color:var(--text-secondary);">Sonuç bulunamadı.</div>`;
            } else {
                dropdown.innerHTML = results.map(p => `
                    <div class="search-result-item" data-id="${p._id}">
                        <img src="${p.phiImg || 'https://images.unsplash.com/photo-1549813067-14a044b755ee?q=80&w=80'}" alt="${p.phiName}">
                        <div>
                            <div style="font-weight:600;">${p.phiName}</div>
                            <div style="font-size:0.75rem;color:var(--text-secondary);">${p.phiEra}</div>
                        </div>
                    </div>
                `).join("");

                dropdown.querySelectorAll(".search-result-item[data-id]").forEach(item => {
                    item.addEventListener("click", () => {
                        viewPhilosopher(item.dataset.id);
                        dropdown.classList.add("hidden");
                        input.value = "";
                    });
                });
            }

            dropdown.classList.remove("hidden");
        }, 250);
    });

    // Dışarı tıklanınca kapat
    document.addEventListener("click", (e) => {
        if (!input.contains(e.target)) dropdown.classList.add("hidden");
    });
}


// ============================================================
// G. FİLOZOFLAR & ZAMAN AKIŞI (GERÇEKZAMANLı)
// ============================================================
function initDataListeners() {
    const phiQuery = query(collection(db, "philosophers"), orderBy("phiYear", "asc"));

    unsubPhilosophers = onSnapshot(phiQuery, (snapshot) => {
        allPhilosophers = [];
        snapshot.forEach(d => allPhilosophers.push({ ...d.data(), _id: d.id }));

        renderPhilosopherGrid(allPhilosophers);
        renderTimeline(allPhilosophers);

        // Arşiv kart sayısı
        animateCounter("statCardsVal", allPhilosophers.length);

    }, (err) => {
        console.error("Filozof dinleyici hatası:", err);
        showToast("error", "Veri Hatası", "Filozoflar yüklenemedi. İnternet bağlantını kontrol et.");
    });
}


// ── KART GRİDİ ──
function renderPhilosopherGrid(philosophers, filterRarity = "all") {
    const grid = document.getElementById("phiGrid");
    if (!grid) return;

    const filtered = filterRarity === "all"
        ? philosophers
        : philosophers.filter(p => (p.phiRarity || "common") === filterRarity);

    if (!filtered.length) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <i class="fa-solid fa-scroll"></i>
                <h4>Bu kategoride kart yok</h4>
                <p>Yönetici panelinden yeni filozof ekleyebilirsin.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map((phi, i) => {
        const rarity   = phi.phiRarity || "common";
        const imgSrc   = phi.phiImg || "https://images.unsplash.com/photo-1549813067-14a044b755ee?q=80&w=500";
        const isAdmin  = currentUserData?.role === "admin";
        const shortDesc = (phi.phiThought || "").slice(0, 120) + ((phi.phiThought || "").length > 120 ? "…" : "");

        return `
        <div class="phi-card ${rarity} fade-in" style="animation-delay:${i * 0.04}s;" data-id="${phi._id}">
            ${isAdmin ? `
                <button class="delete-btn" onclick="event.stopPropagation(); deletePhilosopher('${phi._id}')" title="Sil">
                    <i class="fa-solid fa-trash"></i>
                </button>
            ` : ""}
            <div class="card-img-box">
                <img src="${imgSrc}" alt="${phi.phiName}" loading="lazy">
            </div>
            <div class="card-info-content">
                <h4>${phi.phiName}</h4>
                <small>${phi.phiEra}</small>
                <p>${shortDesc}</p>
                <span class="rarity-badge badge-${rarity}">${rarity}</span>
            </div>
        </div>
        `;
    }).join("");

    // Kartlara tıklama
    grid.querySelectorAll(".phi-card[data-id]").forEach(card => {
        card.addEventListener("click", () => viewPhilosopher(card.dataset.id));
    });

    // Nadirlik filtresi düğmeleri
    setupRarityFilter();
}

function setupRarityFilter() {
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderPhilosopherGrid(allPhilosophers, btn.dataset.rarity);
        });
    });
}


// ── YATAY TİMELİNE ──
function renderTimeline(philosophers) {
    const wrapper = document.getElementById("timelineWrapper");
    if (!wrapper) return;

    wrapper.innerHTML = philosophers.map((phi, i) => {
        const rarity = phi.phiRarity || "common";
        const imgSrc = phi.phiImg || "https://images.unsplash.com/photo-1549813067-14a044b755ee?q=80&w=100";

        return `
        <div class="timeline-item ${rarity} fade-in" style="animation-delay:${i * 0.035}s;" data-id="${phi._id}">
            <div class="tl-dot"></div>
            <div class="tl-card">
                <img src="${imgSrc}" alt="${phi.phiName}" loading="lazy">
                <span class="tl-era">${phi.phiEra}</span>
                <strong>${phi.phiName}</strong>
                <small style="font-size:0.72rem;color:var(--text-secondary);">${(phi.phiThought || "").slice(0, 45)}…</small>
            </div>
        </div>
        `;
    }).join("");

    // Tıklama
    wrapper.querySelectorAll(".timeline-item[data-id]").forEach(item => {
        item.querySelector(".tl-card")?.addEventListener("click", () => viewPhilosopher(item.dataset.id));
    });

    // Sürükleme ile kaydırma
    enableHorizontalDrag(document.querySelector(".timeline-outer"));
}

function enableHorizontalDrag(el) {
    if (!el) return;
    let isDown = false, startX, scrollLeft;

    el.addEventListener("mousedown", (e) => {
        isDown = true;
        el.style.cursor = "grabbing";
        startX    = e.pageX - el.offsetLeft;
        scrollLeft = el.scrollLeft;
    });
    el.addEventListener("mouseleave", () => { isDown = false; el.style.cursor = "grab"; });
    el.addEventListener("mouseup",    () => { isDown = false; el.style.cursor = "grab"; });
    el.addEventListener("mousemove",  (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x    = e.pageX - el.offsetLeft;
        const walk = (x - startX) * 1.5;
        el.scrollLeft = scrollLeft - walk;
    });
}


// ============================================================
// H. FİLOZOF DETAY MODAL
// ============================================================
window.viewPhilosopher = async (id) => {
    try {
        // Önce yerel cache'e bak
        let phi = allPhilosophers.find(p => p._id === id);
        if (!phi) {
            const snap = await getDoc(doc(db, "philosophers", id));
            if (!snap.exists()) return;
            phi = snap.data();
        }

        const imgSrc = phi.phiImg || "https://images.unsplash.com/photo-1549813067-14a044b755ee?q=80&w=300";
        const rarity = phi.phiRarity || "common";
        const rarityColor = { common: "var(--green)", rare: "var(--blue)", legendary: "var(--yellow)" }[rarity] || "var(--green)";

        document.getElementById("readContent").innerHTML = `
            <div style="text-align:center; margin-bottom:20px;">
                <img src="${imgSrc}" alt="${phi.phiName}"
                     style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid ${rarityColor};margin-bottom:14px;">
                <h2>${phi.phiName}</h2>
                <span class="profile-badge" style="display:inline-block;margin-top:4px;">${phi.phiEra}</span>
                <span class="rarity-badge badge-${rarity}" style="display:inline-block;margin-left:6px;">${rarity}</span>
            </div>
            <hr>
            <p>${phi.phiThought || ""}</p>
            ${phi.phiQuote ? `<blockquote>"${phi.phiQuote}"</blockquote>` : ""}
        `;

        openModal("readModal");
    } catch (e) {
        console.error(e);
        showToast("error", "Yükleme Hatası", "Bilgiler getirilemedi.");
    }
};


// ============================================================
// I. FİLOZOF SİL (ADMIN)
// ============================================================
window.deletePhilosopher = async (id) => {
    if (!confirm("Bu düşünürü silmek istediğine emin misin?")) return;
    try {
        await deleteDoc(doc(db, "philosophers", id));
        showToast("success", "Silindi", "Filozof arşivden kaldırıldı.");
    } catch (e) {
        showToast("error", "Yetki Hatası", "Silme işlemi başarısız.");
    }
};


// ============================================================
// J. YENİ FİLOZOF KAYDET
// ============================================================
const addPhiForm = document.getElementById("addPhiForm");
if (addPhiForm) {
    addPhiForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = addPhiForm.querySelector(".btn-save");
        const origText = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor…`;
        btn.disabled = true;

        const newPhi = {
            phiName:   document.getElementById("phiName").value.trim(),
            phiEra:    document.getElementById("phiEra").value.trim(),
            phiYear:   parseInt(document.getElementById("phiYear").value),
            phiImg:    document.getElementById("phiImg").value.trim() || "https://images.unsplash.com/photo-1549813067-14a044b755ee?q=80&w=500",
            phiThought: document.getElementById("phiThought").value.trim(),
            phiQuote:  document.getElementById("phiQuote").value.trim(),
            phiRarity: document.getElementById("phiRarity").value,
            createdAt: new Date(),
        };

        try {
            await addDoc(collection(db, "philosophers"), newPhi);
            addPhiForm.reset();
            closeModal("adminModal");
            showToast("success", "Filozofu Eklelendi!", `${newPhi.phiName} arşive dahil edildi.`);
        } catch (err) {
            console.error(err);
            showToast("error", "Kayıt Hatası", err.message);
        } finally {
            btn.innerHTML = origText;
            btn.disabled = false;
        }
    });
}


// ============================================================
// K. LİDERLİK TABLOSU (GERÇEKZAMANLı)
// ============================================================
function initLeaderboard() {
    const tbody = document.getElementById("leaderboardBody");
    if (!tbody) return;

    const q = query(collection(db, "users"), orderBy("points", "desc"), limit(10));

    unsubLeaderboard = onSnapshot(q, (snap) => {
        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text-secondary);">Henüz savaşan kimse yok.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        const MEDALS = ["🥇", "🥈", "🥉"];
        let myRank = "-";
        let rank = 1;

        snap.forEach(docSnap => {
            const user    = docSnap.data();
            const isMe    = docSnap.id === auth.currentUser?.uid;
            const uname   = user.username || "Anonim Gezgin";
            const pts     = user.points ?? 0;
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(uname)}&background=${isMe ? "1DB954" : "random"}&color=fff&bold=true`;
            const medal   = MEDALS[rank - 1] || `#${rank}`;

            if (isMe) myRank = rank;

            const tr = document.createElement("tr");
            if (isMe) tr.className = "is-me";

            tr.innerHTML = `
                <td class="rank-cell">${medal}</td>
                <td>
                    <div class="leaderboard-name">
                        <img src="${avatarUrl}" alt="${uname}" loading="lazy">
                        <span>${uname}${isMe ? ' <span style="font-size:0.7rem;color:var(--green);">(Sen)</span>' : ""}</span>
                    </div>
                </td>
                <td style="text-align:right; font-weight:700; color:var(--green); white-space:nowrap;">
                    ${pts.toLocaleString("tr-TR")} <small style="color:var(--text-tertiary);font-weight:400;">XP</small>
                </td>
            `;

            tbody.appendChild(tr);
            rank++;
        });

        // Sıra widget güncelle
        const rankEl = document.getElementById("statRankVal");
        if (rankEl) rankEl.textContent = myRank !== "-" ? `#${myRank}` : "—";

    }, (err) => {
        console.error("Liderlik tablosu hatası:", err);
        document.getElementById("leaderboardBody").innerHTML =
            `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--red);">Tablo yüklenemedi. (Firestore indeks hatası?)</td></tr>`;
    });
}


// ============================================================
// L. ADMİN — KULLANICI YÖNETİMİ
// ============================================================
function initAdminUsersListener() {
    const grid = document.getElementById("adminUsersGrid");
    if (!grid) return;

    const q = query(collection(db, "users"), orderBy("points", "desc"));

    onSnapshot(q, (snap) => {
        if (snap.empty) {
            grid.innerHTML = `<p style="color:var(--text-secondary);">Kayıtlı kullanıcı bulunamadı.</p>`;
            return;
        }

        grid.innerHTML = "";
        snap.forEach(docSnap => {
            const user   = docSnap.data();
            const uid    = docSnap.id;
            const uname  = user.username || "Anonim";
            const pts    = user.points ?? 0;
            const role   = user.role || "user";
            const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(uname)}&background=333&color=fff&bold=true`;

            const row = document.createElement("div");
            row.className = "admin-user-row fade-in";
            row.innerHTML = `
                <img src="${avatar}" alt="${uname}">
                <div class="admin-user-info">
                    <strong>${uname}</strong>
                    <small>UID: ${uid.slice(0, 12)}…</small>
                </div>
                <div class="admin-user-actions">
                    <select class="admin-role-select" data-uid="${uid}">
                        <option value="user"  ${role === "user"  ? "selected" : ""}>👤 Kullanıcı</option>
                        <option value="admin" ${role === "admin" ? "selected" : ""}>🛡 Admin</option>
                    </select>
                </div>
                <div class="admin-user-points">${pts.toLocaleString("tr-TR")} XP</div>
            `;

            // Rol değiştir
            row.querySelector(".admin-role-select").addEventListener("change", async (e) => {
                const newRole = e.target.value;
                try {
                    await updateDoc(doc(db, "users", uid), { role: newRole });
                    showToast("success", "Rol Güncellendi", `${uname} artık "${newRole}".`);
                } catch (err) {
                    showToast("error", "Güncelleme Hatası", err.message);
                    e.target.value = role; // Geri al
                }
            });

            grid.appendChild(row);
        });

    }, (err) => {
        console.error("Admin kullanıcı listesi hatası:", err);
        showToast("error", "Yükleme Hatası", "Kullanıcı listesi alınamadı.");
    });
}


// ============================================================
// M. MODAL YARDIMCILARI
// ============================================================
window.openModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "flex";
};

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "none";
};

// Overlay'e tıklanınca kapat
document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.style.display = "none";
    });
});


// ============================================================
// N. ARENA — ZİHİNSEL DÜELLO (PvP)
// ============================================================
const ARENA_QUESTIONS = [
    { q: "Sokrates'in en ünlü öğrencisi kimdir?",                                 o: ["Aristoteles","Platon","Epikür","Zeno"],               a: "Platon" },
    { q: "'Bildiğim tek şey, hiçbir şey bilmediğimdir' kime aittir?",             o: ["Sokrates","Descartes","Kant","Nietzsche"],             a: "Sokrates" },
    { q: "Modern felsefenin babası sayılan filozof?",                              o: ["Hegel","Spinoza","Descartes","Locke"],                 a: "Descartes" },
    { q: "Aristoteles'e göre 'Erdem' nerede bulunur?",                            o: ["Uç noktalarda","Altın ortada","Sadece fikirlerde","Tanrı katında"], a: "Altın ortada" },
    { q: "Varoluşçuluk akımının en önemli temsilcisi?",                           o: ["Jean-Paul Sartre","Thomas Hobbes","John Locke","Hume"],  a: "Jean-Paul Sartre" },
    { q: "Mağara Alegorisi hangi filozofa aittir?",                               o: ["Aristoteles","Platon","Sokrates","Farabi"],             a: "Platon" },
    { q: "İnsan doğasını 'Tabula Rasa' olarak tanımlayan kimdir?",               o: ["John Locke","Thomas Hobbes","Kant","Descartes"],        a: "John Locke" },
    { q: "Devlet için 'Leviathan' benzetmesini yapan düşünür?",                  o: ["Rousseau","Machiavelli","Thomas Hobbes","Marx"],        a: "Thomas Hobbes" },
    { q: "'Kategorik İmperatif' kavramını ortaya atan philosopher?",             o: ["Nietzsche","Spinoza","Kant","Mill"],                    a: "Kant" },
    { q: "İslam dünyasında 'Muallim-i Sani' (İkinci Öğretmen) kimdir?",         o: ["Gazali","Farabi","İbn-i Sina","İbn-i Rüşd"],           a: "Farabi" },
    { q: "İbn-i Sina'nın ruhun bedenden ayrı olduğunu gösterdiği düşünce deneyi?", o: ["Mağara Deneyi","Uçan Adam","Gemi Deneyi","Kedi Deneyi"], a: "Uçan Adam" },
    { q: "'Varoluş özden önce gelir' diyen varoluşçu?",                          o: ["Albert Camus","Sartre","Heidegger","Kierkegaard"],      a: "Sartre" },
    { q: "Sokrates'in bilgiyi sorularla ortaya çıkarma yönteminin adı?",         o: ["Diyalektik","Maiyutik","Arke","Paradigma"],             a: "Maiyutik" },
    { q: "Bilimin 'Paradigma' değişimleriyle ilerlediğini savunan philosopher?", o: ["Karl Popper","Thomas Kuhn","Newton","Francis Bacon"],   a: "Thomas Kuhn" },
    { q: "'Tanrı ya da Doğa' diyen panteist düşünür?",                           o: ["Spinoza","Descartes","Hegel","Leibniz"],               a: "Spinoza" },
    { q: "Sisifos Söyleni eseriyle absürdizmi anlatan yazar?",                   o: ["Sartre","Nietzsche","Albert Camus","Kafka"],            a: "Albert Camus" },
    { q: "Gazali'nin filozofları eleştirdiği meşhur eserinin adı?",              o: ["El-Kanun","Medinetü'l Fazıla","Tehâfütü'l-Felâsife","İhya"], a: "Tehâfütü'l-Felâsife" },
    { q: "Nietzsche'nin 'Tanrı öldü' sözünün geçtiği eseri?",                   o: ["Böyle Buyurdu Zerdüşt","İyinin ve Kötünün Ötesinde","Şen Bilim","İnsan İnsana"], a: "Şen Bilim" },
    { q: "Platon'un ideal devletinde yönetici sınıf kimlerden oluşur?",         o: ["Askerler","Filozoflar","Tüccarlar","Rahipler"],          a: "Filozoflar" },
    { q: "Stoacılık akımının kurucusu kimdir?",                                  o: ["Epikür","Ksenofon","Zenon of Kition","Sokrates"],       a: "Zenon of Kition" },
];

let pvp = {
    questions: [],
    index: 0,
    score: 0,
    timer: null,
    timeLeft: 15,
};

const $ = id => document.getElementById(id);

function loadPvPQuestions() {
    return [...ARENA_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5);
}

// Düello Başlat
$("findMatchBtn")?.addEventListener("click", startSearch);

async function startSearch() {
    const btn = $("findMatchBtn");
    if (!btn) return;

    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Eşleşme Aranıyor…`;
    btn.disabled  = true;

    await sleep(1400);

    pvp.questions = loadPvPQuestions();
    pvp.index     = 0;
    pvp.score     = 0;

    $("arena-lobby").classList.add("hidden");
    $("arena-battle").classList.remove("hidden");
    $("arena-result").classList.add("hidden");
    $("liveBattleScore").textContent = "0";

    showPvPQuestion();
}

function showPvPQuestion() {
    const battle = $("arena-battle");
    if (!battle) return;

    if (pvp.index >= pvp.questions.length) {
        endBattle();
        return;
    }

    const qData = pvp.questions[pvp.index];
    $("questionText").textContent  = qData.q;
    $("questionCount").textContent = `Soru ${pvp.index + 1}/${pvp.questions.length}`;

    const grid = $("optionsGrid");
    grid.innerHTML = "";
    qData.o.forEach(opt => {
        const btn = document.createElement("button");
        btn.className   = "option-btn";
        btn.textContent = opt;
        btn.onclick     = () => checkPvPAnswer(opt, qData.a, btn);
        grid.appendChild(btn);
    });

    startPvPTimer();
}

function startPvPTimer() {
    pvp.timeLeft = 15;
    clearInterval(pvp.timer);

    const bar  = $("timerProgress");
    const text = $("timeLeft");

    const update = () => {
        pvp.timeLeft--;
        if (text) text.textContent = pvp.timeLeft + "s";
        if (bar) {
            const pct = (pvp.timeLeft / 15) * 100;
            bar.style.width = pct + "%";
            bar.className = pvp.timeLeft > 8 ? "" : pvp.timeLeft > 4 ? "warning" : "danger";
        }
        if (pvp.timeLeft <= 0) { clearInterval(pvp.timer); nextPvPQuestion(); }
    };

    if (bar) { bar.style.width = "100%"; bar.className = ""; }
    pvp.timer = setInterval(update, 1000);
}

function checkPvPAnswer(selected, correct, btn) {
    clearInterval(pvp.timer);
    document.querySelectorAll(".option-btn").forEach(b => b.disabled = true);

    if (selected === correct) {
        btn.classList.add("correct");
        pvp.score += 10 + pvp.timeLeft;
        $("liveBattleScore").textContent = pvp.score;
    } else {
        btn.classList.add("wrong");
        // Doğru şıkkı göster
        document.querySelectorAll(".option-btn").forEach(b => {
            if (b.textContent === correct) b.classList.add("correct");
        });
    }

    setTimeout(nextPvPQuestion, 1200);
}

function nextPvPQuestion() {
    pvp.index++;
    showPvPQuestion();
}

async function endBattle() {
    $("arena-battle").classList.add("hidden");
    $("arena-result").classList.remove("hidden");

    const finalScore = pvp.score;
    $("resultTitle").textContent = finalScore >= 40 ? "Mükemmel Düello!" : finalScore >= 20 ? "İyi Savaş!" : "Deneyim Kazandın!";
    $("resultMsg").textContent   = `5 soruyu tamamladın.`;
    $("resultScoreBadge").textContent = `+${finalScore} XP`;

    // Firebase'e kaydet
    if (auth.currentUser && finalScore > 0) {
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                points: increment(finalScore),
            });
            showToast("success", "Puan Kaydedildi!", `+${finalScore} XP kazandın!`);
        } catch (e) {
            showToast("warning", "Puan Kaydedilemedi", "Bağlantı sorunu olabilir.");
        }
    }
}

window.resetArena = () => {
    clearInterval(pvp.timer);
    $("arena-result")?.classList.add("hidden");
    $("arena-battle")?.classList.add("hidden");
    $("arena-lobby")?.classList.remove("hidden");

    const btn = $("findMatchBtn");
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Düello Ara'; btn.disabled = false; }
};


// ============================================================
// O. ARENA — KİMİN SÖZÜ? (STREAK + COMBO)
// ============================================================
let quote = {
    philosophers: [],
    current: null,
    streak: 0,
    combo: 1,
    timer: null,
    timeLeft: 10,
};

window.startQuoteGame = async () => {
    const lobby     = $("arena-lobby");
    const quoteArena = $("quote-game-arena");
    if (!lobby || !quoteArena) return;

    lobby.classList.add("hidden");
    quoteArena.classList.remove("hidden");
    quoteArena.innerHTML = `<p style="padding:40px;text-align:center;color:var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Filozoflar çağrılıyor…</p>`;

    try {
        // Önce önbelleği kullan
        let candidates = allPhilosophers.filter(p => p.phiQuote);

        // Yetersizse Firestore'dan çek
        if (candidates.length < 4) {
            const snap = await getDocs(collection(db, "philosophers"));
            candidates = [];
            snap.forEach(d => { if (d.data().phiQuote) candidates.push({ ...d.data(), _id: d.id }); });
        }

        if (candidates.length < 4) {
            showToast("warning", "Yeterli Söz Yok", "En az 4 filozofun sözü olmalı.");
            resetQuoteGameScreen();
            return;
        }

        quote.philosophers = candidates;
        quote.streak = 0;
        quote.combo  = 1;

        drawQuoteGameUI();
        renderQuoteRound();

    } catch (err) {
        console.error(err);
        showToast("error", "Yükleme Hatası", "Oyun başlatılamadı.");
        resetQuoteGameScreen();
    }
};

function drawQuoteGameUI() {
    const quoteArena = $("quote-game-arena");
    quoteArena.innerHTML = `
        <div class="quote-header-bar">
            <div class="stat-badge streak-badge">
                <i class="fa-solid fa-fire"></i> Seri: <span id="quoteStreak">0</span>
            </div>
            <div class="stat-badge combo-badge" id="comboBadge">
                <i class="fa-solid fa-xmark"></i> Çarpan: <span id="quoteCombo">x1</span>
            </div>
            <div class="stat-badge timer-badge">
                <i class="fa-solid fa-stopwatch"></i> <span id="quoteTimer">10</span>s
            </div>
        </div>
        <div class="main-quote-card">
            <p id="quoteText" style="font-size:1.3rem;font-style:italic;line-height:1.6;">"Yükleniyor..."</p>
        </div>
        <div id="quoteOptionsGrid" class="options-grid"></div>
        <div style="text-align:center;margin-top:20px;">
            <button class="btn-cancel" onclick="window.resetQuoteGameScreen()">
                <i class="fa-solid fa-arrow-left"></i> Çık
            </button>
        </div>
    `;
}

function renderQuoteRound() {
    // Rastgele bir philosopher seç (tekrar edebilir - oyun için uygundur)
    const random = quote.philosophers[Math.floor(Math.random() * quote.philosophers.length)];
    quote.current = random;

    const quoteEl   = $("quoteText");
    const streakEl  = $("quoteStreak");
    const comboEl   = $("quoteCombo");
    const comboBadge = $("comboBadge");

    if (quoteEl)   quoteEl.textContent    = `"${random.phiQuote}"`;
    if (streakEl)  streakEl.textContent   = quote.streak;
    if (comboEl)   comboEl.textContent    = `x${quote.combo}`;
    if (comboBadge) {
        comboBadge.style.display = quote.combo > 1 ? "inline-flex" : "inline-flex";
        comboBadge.style.opacity = quote.combo > 1 ? "1" : "0.5";
    }

    // Seçenekler: doğru + 3 yanlış
    const others = quote.philosophers.filter(p => p.phiName !== random.phiName);
    others.sort(() => Math.random() - 0.5);
    const options = [random.phiName, others[0]?.phiName, others[1]?.phiName, others[2]?.phiName]
        .filter(Boolean)
        .sort(() => Math.random() - 0.5);

    const grid = $("quoteOptionsGrid");
    if (!grid) return;
    grid.innerHTML = options.map(name => `
        <button class="option-btn" onclick="window.handleQuoteAnswer('${name.replace(/'/g, "\\'")}', this)">${name}</button>
    `).join("");

    resetQuoteTimer();
}

window.handleQuoteAnswer = (selectedName, el) => {
    clearInterval(quote.timer);
    document.querySelectorAll("#quoteOptionsGrid .option-btn").forEach(b => b.disabled = true);

    if (selectedName === quote.current.phiName) {
        el.classList.add("correct");
        quote.streak++;
        // Combo: her 3 doğruda bir artar, max x5
        if (quote.streak % 3 === 0) quote.combo = Math.min(quote.combo + 1, 5);
        setTimeout(renderQuoteRound, 700);
    } else {
        el.classList.add("wrong");
        // Doğru şıkkı göster
        document.querySelectorAll("#quoteOptionsGrid .option-btn").forEach(b => {
            if (b.textContent === quote.current.phiName) b.classList.add("correct");
        });
        setTimeout(() => finishQuoteGame(`Yanlış! Sözün sahibi: <b>${quote.current.phiName}</b>`), 1100);
    }
};

function resetQuoteTimer() {
    clearInterval(quote.timer);
    quote.timeLeft = 10;
    const timerEl = $("quoteTimer");
    if (timerEl) timerEl.textContent = quote.timeLeft;

    quote.timer = setInterval(() => {
        quote.timeLeft--;
        if (timerEl) timerEl.textContent = quote.timeLeft;
        if (quote.timeLeft <= 0) {
            clearInterval(quote.timer);
            finishQuoteGame("Zaman Doldu!");
        }
    }, 1000);
}

async function finishQuoteGame(msg) {
    clearInterval(quote.timer);
    const xp = quote.streak * 5 * quote.combo;

    const quoteArena = $("quote-game-arena");
    if (!quoteArena) return;

    quoteArena.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <i class="fa-solid fa-comment-dots result-icon" style="color:var(--yellow);"></i>
            <h2 style="font-family:var(--font-display);color:var(--yellow);margin-bottom:10px;">Oyun Bitti</h2>
            <p style="color:var(--text-secondary);font-size:1rem;margin-bottom:16px;">${msg}</p>
            <div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-bottom:24px;">
                <div class="stat-badge streak-badge"><i class="fa-solid fa-fire"></i> ${quote.streak} Seri</div>
                <div class="stat-badge combo-badge"><i class="fa-solid fa-bolt"></i> x${quote.combo} Combo</div>
                <div class="stat-badge" style="background:var(--green-subtle);border:1px solid var(--border-green);color:var(--green);">
                    <i class="fa-solid fa-star"></i> +${xp} XP
                </div>
            </div>
            <button class="action-btn" onclick="window.resetQuoteGameScreen()" style="max-width:200px;margin:0 auto;">
                Arenaya Dön
            </button>
        </div>
    `;

    // XP Firebase'e yaz
    if (xp > 0 && auth.currentUser) {
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                points: increment(xp),
            });
            showToast("success", "XP Kazandın!", `+${xp} XP hesabına eklendi. (Seri: ${quote.streak} × Combo: x${quote.combo})`);
        } catch (e) {
            showToast("warning", "XP Kaydedilemedi", "Bağlantı sorunu.");
        }
    }
}

window.resetQuoteGameScreen = () => {
    clearInterval(quote.timer);
    $("quote-game-arena")?.classList.add("hidden");
    $("arena-lobby")?.classList.remove("hidden");
    quote = { ...quote, philosophers: [], current: null, streak: 0, combo: 1, timer: null, timeLeft: 10 };
};


// ============================================================
// P. YARDIMCI FONKSİYONLAR
// ============================================================

/** Sayaç animasyonu (0'dan hedefe) */
function animateCounter(elId, target, duration = 600) {
    const el = document.getElementById(elId);
    if (!el) return;

    const start    = parseInt(el.textContent.replace(/\D/g, "")) || 0;
    const steps    = 30;
    const stepTime = duration / steps;
    const diff     = target - start;

    if (diff === 0) return;

    let step = 0;
    const timer = setInterval(() => {
        step++;
        const val = Math.round(start + (diff * (step / steps)));
        el.textContent = val.toLocaleString("tr-TR");
        if (step >= steps) { clearInterval(timer); el.textContent = target.toLocaleString("tr-TR"); }
    }, stepTime);
}

/** Rütbe etiketi */
function getRankTitle(points) {
    let title = RANK_TITLES[0].label;
    for (const rank of RANK_TITLES) {
        if (points >= rank.min) title = rank.label;
    }
    return title;
}

/** Basit async bekleme */
const sleep = ms => new Promise(r => setTimeout(r, ms));
