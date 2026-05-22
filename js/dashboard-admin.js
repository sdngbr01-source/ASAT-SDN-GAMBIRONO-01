// dashboard-admin.js
// Manajemen dashboard admin

// Ambil data user dari sessionStorage
const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

// Cek login
if (!currentUser || currentUser.role !== 'admin') {
    window.location.href = 'index.html';
}

// Tampilkan nama user
document.addEventListener('DOMContentLoaded', function() {
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = currentUser.nama;
});

// Fungsi Connection Status
function getConnectionStatus() {
    if (window.firebaseConnection) {
        return window.firebaseConnection.getStatus();
    }
    return { isConnected: false, status: 'unknown' };
}

// Fungsi untuk cek koneksi sebelum load data
async function checkConnectionBeforeLoad() {
    const status = getConnectionStatus();
    if (!status.isConnected) {
        alert('⚠️ Tidak terhubung ke Firebase. Silakan cek koneksi Anda.');
        return false;
    }
    return true;
}

// ==================== FUNGSI LOAD SISWA UNTUK KOREKSI ====================
async function loadSiswaForKoreksi() {
    const kelas = document.getElementById('filterKelasKoreksi')?.value;
    const siswaSelect = document.getElementById('filterSiswaKoreksi');
    
    if (!siswaSelect) return;
    
    if (!kelas) {
        siswaSelect.innerHTML = '<option value="">Pilih Kelas Dulu</option>';
        return;
    }
    
    siswaSelect.innerHTML = '<option value="">Loading siswa...</option>';
    
    try {
        // Ambil siswa dari collection users
        const snapshot = await usersRef
            .where('kelas', '==', kelas)
            .where('role', '==', 'siswa')
            .get();
        
        siswaSelect.innerHTML = '<option value="">Pilih Siswa</option>';
        
        if (snapshot.empty) {
            siswaSelect.innerHTML = '<option value="">Tidak ada siswa di kelas ini</option>';
            return;
        }
        
        snapshot.forEach(doc => {
            const siswa = doc.data();
            siswaSelect.innerHTML += `
                <option value="${doc.id}">${siswa.nama || 'Tanpa Nama'} (${siswa.nis || '-'})</option>
            `;
        });
        
        console.log('✅ Load siswa berhasil:', snapshot.size, 'siswa');
        
    } catch (error) {
        console.error('Error loading siswa:', error);
        siswaSelect.innerHTML = '<option value="">Error loading siswa</option>';
    }
}

async function loadNilai() {
    const kelas = document.getElementById('filterKelasNilai')?.value;
    const mapel = document.getElementById('filterMapelNilai')?.value;
    const search = document.getElementById('searchSiswa')?.value.toLowerCase() || '';
    const tbody = document.getElementById('nilaiTableBody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Loading...</td></tr>';
    
    try {
        let query = answersRef;
        
        if (kelas) query = query.where('kelas', '==', kelas);
        if (mapel) query = query.where('mataPelajaran', '==', mapel);
        
        const snapshot = await query.orderBy('waktu', 'desc').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center">Tidak ada data</td></tr>';
            return;
        }
        
        const nilaiMap = new Map();
        
        snapshot.forEach(doc => {
            const nilai = doc.data();
            const key = nilai.siswaId + '_' + nilai.mataPelajaran;
            
            if (!nilaiMap.has(key) || (nilai.waktu?.toDate?.() > nilaiMap.get(key).waktu?.toDate?.())) {
                nilaiMap.set(key, { id: doc.id, ...nilai });
            }
        });
        
        const filteredData = Array.from(nilaiMap.values()).filter(nilai => {
            if (search) return (nilai.siswaNama || '').toLowerCase().includes(search);
            return true;
        });
        
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center">Tidak ada data sesuai filter</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        let no = 1;
        
        for (const nilai of filteredData) {
            const nilaiPG = nilai.nilaiPG || 0;
            const nilaiIsian = nilai.nilaiIsian || 0;
            const nilaiUraian = nilai.nilaiUraian || 0;
            const totalPG = nilai.totalPG || 0;
            const totalIsian = nilai.totalIsian || 0;
            const totalUraian = nilai.totalUraian || 0;
            
            const jumlahSoal = (nilai.jumlahSoal?.pg || 0) + (nilai.jumlahSoal?.isian || 0) + (nilai.jumlahSoal?.uraian || 0);
            
            let nilaiAkhir = 0;
            let totalNilai = 0;
            
            // CEK STATUS: Jika masih pending, jangan hitung nilai uraian
            if (nilai.statusKoreksi === 'pending') {
                // Hanya hitung PG + Isian, uraian belum dihitung
                totalNilai = nilaiPG + nilaiIsian;
                if (jumlahSoal > 0) {
                    nilaiAkhir = (totalNilai * 100) / jumlahSoal;
                    nilaiAkhir = Math.round(nilaiAkhir);
                }
            } else {
                // Sudah selesai dikoreksi, hitung semua termasuk uraian
                totalNilai = nilaiPG + nilaiIsian + nilaiUraian;
                if (jumlahSoal > 0) {
                    nilaiAkhir = (totalNilai * 100) / jumlahSoal;
                    nilaiAkhir = Math.round(nilaiAkhir);
                }
            }
            
            let statusText = '';
            let statusClass = '';
            
            if (nilai.statusKoreksi === 'pending') {
                statusText = 'Menunggu Koreksi Essay';
                statusClass = 'status-pending';
            } else {
                statusText = 'Selesai';
                statusClass = 'status-selesai';
            }
            
            const row = tbody.insertRow();
            row.insertCell(0).textContent = no++;
            row.insertCell(1).textContent = nilai.siswaNama || '-';
            row.insertCell(2).textContent = nilai.kelas || '-';
            row.insertCell(3).textContent = nilai.mataPelajaran || '-';
            row.insertCell(4).textContent = totalPG > 0 ? nilaiPG + ' / ' + totalPG : '-';
            row.insertCell(5).textContent = totalIsian > 0 ? nilaiIsian + ' / ' + totalIsian : '-';
            row.insertCell(6).textContent = totalUraian > 0 ? nilaiUraian + ' / ' + totalUraian : '-';
            row.insertCell(7).innerHTML = '<strong>' + nilaiAkhir + '</strong> / 100';
            row.insertCell(8).innerHTML = '<span class="exam-status ' + statusClass + '">' + statusText + '</span>';
        }
        
    } catch (error) {
        console.error('Error loading nilai:', error);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Error: ' + error.message + '</td></tr>';
    }
}

// ==================== SWITCH TAB ====================
function switchTab(tabName) {
    // Sembunyikan semua tab
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Nonaktifkan semua tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Aktifkan tab yang dipilih
    document.getElementById(`tab-${tabName}`).classList.add('active');
    if (event && event.target) event.target.classList.add('active');
    
    // Load data sesuai tab
    setTimeout(async () => {
        const isConnected = await checkConnectionBeforeLoad();
        if (!isConnected) return;
        
        switch(tabName) {
            case 'user':
                if (typeof loadUsers === 'function') loadUsers();
                break;
            case 'soal':
                if (typeof loadSoal === 'function') loadSoal();
                break;
            case 'kelas': // Tambahkan ini
                if (typeof loadKelas === 'function') loadKelas();
                break;
            case 'nilai':
                loadNilai();
                break;
            case 'koreksi':
                loadSiswaForKoreksi();
                break;
        }
    }, 100);
}

// ==================== LOGOUT ====================
function logout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

// ==================== MODAL FUNCTIONS ====================
function showUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) modal.style.display = 'block';
}

function closeUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) modal.style.display = 'none';
}

function showUploadSoalModal() {
    if (typeof loadKelasToUploadDropdown === 'function') {
        loadKelasToUploadDropdown();
    }
    const modal = document.getElementById('uploadSoalModal');
    if (modal) modal.style.display = 'block';
}

function closeUploadSoalModal() {
    const modal = document.getElementById('uploadSoalModal');
    if (modal) modal.style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const uploadModal = document.getElementById('uploadModal');
    const uploadSoalModal = document.getElementById('uploadSoalModal');
    
    if (event.target === uploadModal) uploadModal.style.display = 'none';
    if (event.target === uploadSoalModal) uploadSoalModal.style.display = 'none';
}

// ==================== LOAD DATA AWAL ====================
document.addEventListener('DOMContentLoaded', function() {
    // Load nilai untuk tab yang aktif
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const onclickAttr = activeTab.getAttribute('onclick');
        if (onclickAttr) {
            const match = onclickAttr.match(/'([^']+)'/);
            if (match && match[1] === 'nilai') {
                setTimeout(loadNilai, 500);
            }
        }
    }
});
// dashboard-admin.js - Tambahkan fungsi showToast global
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        if (type === 'error') alert(message);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: white;
        padding: 12px 20px;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        animation: slideIn 0.3s;
        border-left: 4px solid ${type === 'success' ? '#28a745' : '#dc3545'};
    `;
    
    const icon = type === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

// ==================== STATUS LOGIN SISWA ====================
// Load data status login siswa
async function loadStatusLogin() {
    const tbody = document.getElementById('statusLoginTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Loading data...</td></tr>';
    
    // Ambil filter
    const filterKelas = document.getElementById('statusFilterKelas')?.value || '';
    const filterMapel = document.getElementById('statusFilterMapel')?.value || '';
    const filterSearch = document.getElementById('statusFilterSearch')?.value.toLowerCase() || '';
    const filterStatus = document.getElementById('statusFilterStatus')?.value || '';
    
    try {
        // 1. Ambil semua siswa
        const siswaSnapshot = await usersRef
            .where('role', '==', 'siswa')
            .get();
        
        const semuaSiswa = [];
        siswaSnapshot.forEach(doc => {
            semuaSiswa.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Filter siswa berdasarkan kelas
        let filteredSiswa = semuaSiswa;
        if (filterKelas) {
            filteredSiswa = filteredSiswa.filter(s => s.kelas === filterKelas);
        }
        if (filterSearch) {
            filteredSiswa = filteredSiswa.filter(s => 
                (s.nama || '').toLowerCase().includes(filterSearch) ||
                (s.nis || '').toLowerCase().includes(filterSearch)
            );
        }
        
        // 2. Ambil semua ujian aktif
        const examsSnapshot = await examsRef
            .where('aktif', '==', true)
            .get();
        
        const semuaExam = [];
        examsSnapshot.forEach(doc => {
            semuaExam.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Filter exam berdasarkan mapel
        let filteredExam = semuaExam;
        if (filterMapel) {
            filteredExam = filteredExam.filter(e => e.mataPelajaran === filterMapel);
        }
        
        // 3. Ambil semua blokir
        const blocksSnapshot = await firebase.firestore().collection('student_blocks').get();
        const blocksMap = new Map();
        blocksSnapshot.forEach(doc => {
            const data = doc.data();
            const key = `${data.siswaId}_${data.examId}`;
            blocksMap.set(key, data);
        });
        
        // 4. 🔥 PERBAIKAN: Ambil SEMUA jawaban (termasuk status pending)
//    Karena jika sudah ada data answers, berarti siswa sudah mengumpulkan ujian
const answersSnapshot = await answersRef.get();  // Hapus filter where

const completedMap = new Map();
const pendingMap = new Map(); // Untuk menyimpan status pending

answersSnapshot.forEach(doc => {
    const data = doc.data();
    const key = `${data.siswaId}_${data.examId}`;
    
    // Apapun statusnya, tetap dianggap SELESAI karena sudah mengumpulkan
    completedMap.set(key, true);
    
    // Catat jika statusnya pending (untuk ditampilkan di tooltip)
    if (data.statusKoreksi === 'pending' || data.statusSubmit === 'pending') {
        pendingMap.set(key, true);
    }
});
        
        // 5. Ambil log pelanggaran untuk hitung kesempatan
        const logsSnapshot = await firebase.firestore().collection('safe_exam_logs')
            .where('isMaxViolation', '==', true)
            .get();
        
        const restartCountMap = new Map();
        logsSnapshot.forEach(doc => {
            const data = doc.data();
            const key = `${data.siswaId}_${data.examId}`;
            const current = restartCountMap.get(key) || 0;
            restartCountMap.set(key, current + 1);
        });
        
        // 6. Bangun data tabel
        let tableData = [];
        
        for (const siswa of filteredSiswa) {
            for (const exam of filteredExam) {
                // Hanya tampilkan exam yang sesuai kelas siswa
                if (exam.kelas !== siswa.kelas) continue;
                
                const key = `${siswa.id}_${exam.id}`;
                const isBlocked = blocksMap.has(key) && 
                                  blocksMap.get(key).status === 'blocked' && 
                                  !blocksMap.get(key).reseted;
                const isCompleted = completedMap.has(key);
                const restartCount = restartCountMap.get(key) || 0;
                const remainingChances = Math.max(0, 3 - restartCount);
                const blockData = blocksMap.get(key);
                
                let status = 'login';
                let statusText = '✅ Login / Aktif';
                let statusClass = 'status-login';
                
                if (isCompleted) {
                    status = 'selesai';
                    statusText = '📗 Selesai';
                    statusClass = 'status-selesai';
                } else if (isBlocked) {
                    status = 'blocked';
                    statusText = '🔒 Diblokir';
                    statusClass = 'status-blocked';
                }
                
                // Filter berdasarkan status
                if (filterStatus && status !== filterStatus) continue;
                
                tableData.push({
                    siswaId: siswa.id,
                    siswaNama: siswa.nama || '-',
                    nis: siswa.nis || '-',
                    kelas: siswa.kelas || '-',
                    examId: exam.id,
                    mataPelajaran: exam.mataPelajaran,
                    status: status,
                    statusText: statusText,
                    statusClass: statusClass,
                    remainingChances: remainingChances,
                    lastUpdate: blockData?.waktu?.toDate() || new Date(),
                    isBlocked: isBlocked,
                    isCompleted: isCompleted
                });
            }
        }
        
        // Update statistik
        updateStatusStatistics(tableData);
        
        // Render tabel
        renderStatusTable(tableData);
        
        // Load dropdown kelas jika perlu
        if (document.getElementById('statusFilterKelas')?.options.length <= 1) {
            await loadKelasToStatusFilter();
        }
        
    } catch (error) {
        console.error('Error loading status login:', error);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
    }
}

// Update statistik status login
function updateStatusStatistics(tableData) {
    const loginCount = tableData.filter(d => d.status === 'login').length;
    const blockedCount = tableData.filter(d => d.status === 'blocked').length;
    const completedCount = tableData.filter(d => d.status === 'selesai').length;
    const totalCount = tableData.length;
    
    const statLogin = document.getElementById('statLoginCount');
    const statBlocked = document.getElementById('statBlockedCount');
    const statCompleted = document.getElementById('statCompletedCount');
    const statTotal = document.getElementById('statTotalCount');
    
    if (statLogin) statLogin.textContent = loginCount;
    if (statBlocked) statBlocked.textContent = blockedCount;
    if (statCompleted) statCompleted.textContent = completedCount;
    if (statTotal) statTotal.textContent = totalCount;
}

// Render tabel status login
function renderStatusTable(data) {
    const tbody = document.getElementById('statusLoginTableBody');
    
    if (!tbody) return;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">📭 Tidak ada data sesuai filter</td></tr>';
        return;
    }
    
    let html = '';
    data.forEach((item, index) => {
        const lastUpdateStr = item.lastUpdate ? 
            new Date(item.lastUpdate).toLocaleString('id-ID') : 
            '-';
        
        // 🔥 PERBAIKAN: Tombol reset hanya aktif untuk status 'blocked'
        const isResetDisabled = item.status !== 'blocked';
        
        html += `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td><strong>${escapeHtml(item.siswaNama)}</strong></td>
                <td>${escapeHtml(item.nis)}</td>
                <td>Kelas ${escapeHtml(item.kelas)}</td>
                <td>${escapeHtml(item.mataPelajaran)}</td>
                <td>
                    <span class="status-badge ${item.statusClass}">
                        ${item.statusText}
                    </span>
                </td>
                <td style="text-align: center;">
                    ${item.status === 'login' ? `🎫 ${item.remainingChances} x` : '-'}
                </td>
                <td style="font-size: 11px;">${lastUpdateStr}</td>
                <td style="text-align: center;">
                    <button class="btn-reset" 
                        style="cursor: ${isResetDisabled ? 'not-allowed' : 'pointer'}; opacity: ${isResetDisabled ? '0.5' : '1'};"
                        onclick="${isResetDisabled ? '' : `openResetStatusModal('${item.siswaId}', '${escapeHtml(item.siswaNama)}', '${item.examId}', '${escapeHtml(item.mataPelajaran)}')`}"
                        ${isResetDisabled ? 'disabled' : ''}>
                        🔓 Reset
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}
// Load kelas ke filter dropdown
async function loadKelasToStatusFilter() {
    const kelasSelect = document.getElementById('statusFilterKelas');
    if (!kelasSelect) return;
    
    try {
        const snapshot = await usersRef
            .where('role', '==', 'siswa')
            .get();
        
        const kelasSet = new Set();
        snapshot.forEach(doc => {
            const kelas = doc.data().kelas;
            if (kelas) kelasSet.add(kelas);
        });
        
        const sortedKelas = Array.from(kelasSet).sort();
        
        // Hanya tambahkan jika belum ada opsi
        if (kelasSelect.options.length <= 1) {
            sortedKelas.forEach(kelas => {
                kelasSelect.innerHTML += `<option value="${kelas}">${kelas}</option>`;
            });
        }
        
    } catch (error) {
        console.error('Error loading kelas filter:', error);
    }
}

// Reset filter status login
function resetStatusFilter() {
    const kelasSelect = document.getElementById('statusFilterKelas');
    const mapelSelect = document.getElementById('statusFilterMapel');
    const searchInput = document.getElementById('statusFilterSearch');
    const statusSelect = document.getElementById('statusFilterStatus');
    
    if (kelasSelect) kelasSelect.value = '';
    if (mapelSelect) mapelSelect.value = '';
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = '';
    
    loadStatusLogin();
}

let selectedResetData = null;

// Open modal reset status
function openResetStatusModal(siswaId, siswaNama, examId, mataPelajaran) {
    console.log("Open reset modal:", siswaId, siswaNama, examId, mataPelajaran);
    
    selectedResetData = {
        siswaId: siswaId,
        siswaNama: siswaNama,
        examId: examId,
        mataPelajaran: mataPelajaran
    };
    
    // Gunakan confirm biasa dulu untuk testing
    if (confirm(`Apakah Anda yakin ingin mereset blokir untuk:\n\n${siswaNama}\nMapel: ${mataPelajaran}\n\nSetelah direset, siswa dapat mengerjakan ujian dari awal dengan 3 kesempatan baru.`)) {
        confirmResetStatus();
    }
}

// Close modal
function closeResetStatusModal() {
    const modal = document.getElementById('resetStatusModal');
    if (modal) modal.style.display = 'none';
    selectedResetData = null;
}

// Confirm reset status
async function confirmResetStatus() {
    if (!selectedResetData) return;
    
    const { siswaId, siswaNama, examId, mataPelajaran } = selectedResetData;
    
    try {
        showToast(`🔄 Mereset blokir untuk ${siswaNama}...`, 'info');
        
        // 1. Update student_blocks (set reseted = true)
        const blockRef = firebase.firestore().collection('student_blocks');
        const docId = `${siswaId}_${examId}`;
        
        await blockRef.doc(docId).update({
            reseted: true,
            resetBy: currentUser?.nama || 'Admin',
            resetTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 2. Catat log reset
        await firebase.firestore().collection('reset_logs').add({
            siswaId: siswaId,
            siswaNama: siswaNama,
            examId: examId,
            mataPelajaran: mataPelajaran,
            action: 'reset',
            resetBy: currentUser?.nama || 'Admin',
            waktu: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 3. Hapus data pelanggaran (safe_exam_logs) untuk ujian ini
        const logsSnapshot = await firebase.firestore().collection('safe_exam_logs')
            .where('siswaId', '==', siswaId)
            .where('examId', '==', examId)
            .get();
        
        const batch = firebase.firestore().batch();
        logsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        showToast(`✅ Berhasil mereset blokir untuk ${siswaNama} (${mataPelajaran})`, 'success');
        
        // Refresh tabel
        await loadStatusLogin();
        
        // Reset selected data
        selectedResetData = null;
        
    } catch (error) {
        console.error('Error resetting status:', error);
        showToast(`❌ Gagal reset: ${error.message}`, 'error');
    }
}

// Perbaiki fungsi close modal jika ada
function closeResetStatusModal() {
    selectedResetData = null;
    const modal = document.getElementById('resetStatusModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Escape HTML helper
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load status login saat tab diaktifkan
// Override switchTab untuk menambahkan statuslogin
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabName) {
    if (originalSwitchTab) {
        originalSwitchTab(tabName);
    } else {
        // Sembunyikan semua tab
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`tab-${tabName}`).classList.add('active');
        if (event && event.target) event.target.classList.add('active');
    }
    
    // Load data khusus untuk tab statuslogin
    if (tabName === 'statuslogin') {
        setTimeout(() => {
            loadKelasToStatusFilter();
            loadStatusLogin();
        }, 100);
    }
};

// Tambahkan CSS untuk status badge
const style = document.createElement('style');
style.textContent = `
    .status-badge {
        display: inline-block;
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
    }
    .status-login {
        background: #d4edda;
        color: #155724;
    }
    .status-blocked {
        background: #f8d7da;
        color: #721c24;
    }
    .status-selesai {
        background: #d1ecf1;
        color: #0c5460;
    }
    .btn-reset {
        background: #ffc107;
        color: #333;
        border: none;
        padding: 6px 12px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.3s;
    }
    .btn-reset:hover:not(:disabled) {
        background: #e0a800;
    }
    .btn-reset:disabled {
        background: #ccc;
        cursor: not-allowed;
    }
`;
document.head.appendChild(style);


