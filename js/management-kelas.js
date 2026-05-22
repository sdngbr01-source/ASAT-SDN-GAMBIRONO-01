// management-kelas.js
// Manajemen kelas dinamis untuk SD

// Referensi collection kelas
const kelasRef = db.collection('kelas');

// Cache untuk dropdown kelas
let kelasCache = null;
let lastKelasFetch = 0;
const KELAS_CACHE_DURATION = 60000; // 60 detik

// Load daftar kelas untuk semua dropdown (dengan cache)
async function loadAllKelasDropdowns(forceRefresh = false) {
    const now = Date.now();
    
    if (!forceRefresh && kelasCache && (now - lastKelasFetch) < KELAS_CACHE_DURATION) {
        console.log('📦 Menggunakan cache kelas untuk dropdown');
        updateDropdownsFromCache();
        return;
    }
    
    try {
        const snapshot = await kelasRef.where('status', '==', 'aktif').orderBy('tingkatan', 'asc').orderBy('namaKelas', 'asc').get();
        
        kelasCache = [];
        snapshot.forEach(doc => {
            kelasCache.push(doc.data());
        });
        lastKelasFetch = now;
        
        updateDropdownsFromCache();
        console.log('✅ Dropdown kelas berhasil diupdate');
        
    } catch (error) {
        console.error('Error loading kelas dropdowns:', error);
        if (kelasCache) updateDropdownsFromCache();
    }
}

function updateDropdownsFromCache() {
    if (!kelasCache) return;
    
    const kelasOptions = '<option value="">Pilih Kelas</option>' + 
        kelasCache.map(kelas => `<option value="${kelas.namaKelas}">${kelas.namaKelas}</option>`).join('');
    
    const kelasOptionsAll = '<option value="">Semua Kelas</option>' + 
        kelasCache.map(kelas => `<option value="${kelas.namaKelas}">${kelas.namaKelas}</option>`).join('');
    
    const dropdowns = [
        'filterKelasUser', 'filterKelasSoal', 'settingKelas', 
        'filterKelasNilai', 'filterKelasKoreksi', 'laporanKelas', 'generateKelas', 'uploadKelas'
    ];
    
    dropdowns.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'filterKelasUser' || id === 'filterKelasNilai') {
                element.innerHTML = kelasOptionsAll;
            } else {
                element.innerHTML = kelasOptions;
            }
        }
    });
}

// Load dan tampilkan daftar kelas di tabel
async function loadKelas() {
    const tbody = document.getElementById('kelasTableBody');
    const filterStatus = document.getElementById('filterStatusKelas')?.value || '';
    
    if (!tbody) return;
    
    tbody.innerHTML = '发展<td colspan="7" style="text-align: center;">Loading...发展</tr>';
    
    try {
        let query = kelasRef;
        
        if (filterStatus) {
            query = query.where('status', '==', filterStatus);
        }
        
        const snapshot = await query.orderBy('tingkatan', 'asc').orderBy('namaKelas', 'asc').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '发展<td colspan="7" style="text-align: center;">Belum ada kelas. Silakan tambah kelas baru.</tr>';
            return;
        }
        
        tbody.innerHTML = '';
        let no = 1;
        
        for (const doc of snapshot.docs) {
            const kelas = doc.data();
            
            let jumlahSiswa = 0;
            try {
                const siswaSnapshot = await usersRef
                    .where('kelas', '==', kelas.namaKelas)
                    .where('role', '==', 'siswa')
                    .get();
                jumlahSiswa = siswaSnapshot.size;
            } catch (error) {}
            
            const row = tbody.insertRow();
            row.insertCell(0).textContent = no++;
            row.insertCell(1).innerHTML = `<strong>${kelas.namaKelas}</strong>`;
            row.insertCell(2).textContent = `Kelas ${kelas.tingkatan} SD`;
            row.insertCell(3).textContent = kelas.waliKelas || '-';
            row.insertCell(4).textContent = jumlahSiswa;
            row.insertCell(5).innerHTML = kelas.status === 'aktif' 
                ? '<span style="color:#28a745;">✅ Aktif</span>' 
                : '<span style="color:#dc3545;">⭕ Nonaktif</span>';
            
            row.insertCell(6).innerHTML = `
                <button onclick="editKelas('${doc.id}', '${kelas.namaKelas}', '${kelas.tingkatan}', '${kelas.waliKelas || ''}', '${kelas.status}')" style="background:#ffc107; border:none; padding:4px 8px; border-radius:4px; margin-right:5px; cursor:pointer;">✏️ Edit</button>
                <button onclick="deleteKelas('${doc.id}', '${kelas.namaKelas}')" style="background:#dc3545; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑 Hapus</button>
            `;
        }
        
    } catch (error) {
        console.error('Error loading kelas:', error);
        tbody.innerHTML = `发展<td colspan="7" style="text-align: center; color: red;">Error: ${error.message}</tr>`;
    }
}

// Tambah kelas baru
async function tambahKelas(event) {
    event.preventDefault();
    
    const namaKelas = document.getElementById('namaKelas').value.trim();
    const tingkatan = document.getElementById('tingkatanKelas').value;
    const waliKelas = document.getElementById('waliKelas').value.trim();
    const status = document.getElementById('statusKelas').value;
    
    if (!namaKelas || !tingkatan) {
        showToast('Mohon lengkapi data kelas', 'error');
        return;
    }
    
    const kelasRegex = /^[1-6][A-Z]$/;
    if (!kelasRegex.test(namaKelas)) {
        showToast('Format nama kelas salah. Contoh: 1A, 2B, 3C, 4A, 5B, 6C', 'error');
        return;
    }
    
    try {
        const existing = await kelasRef.where('namaKelas', '==', namaKelas).get();
        if (!existing.empty) {
            showToast(`Kelas ${namaKelas} sudah terdaftar!`, 'error');
            return;
        }
        
        await kelasRef.add({
            namaKelas: namaKelas,
            tingkatan: parseInt(tingkatan),
            waliKelas: waliKelas || null,
            status: status,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast(`✅ Kelas ${namaKelas} berhasil ditambahkan`, 'success');
        document.getElementById('tambahKelasForm').reset();
        
        await loadKelas();
        await loadAllKelasDropdowns(true);
        
        if (typeof loadUsers === 'function') loadUsers(true);
        if (typeof loadSoal === 'function') loadSoal(true);
        
    } catch (error) {
        console.error('Error adding kelas:', error);
        showToast('Gagal menambahkan kelas: ' + error.message, 'error');
    }
}

// Edit kelas
function editKelas(id, namaKelas, tingkatan, waliKelas, status) {
    const newNama = prompt('Edit nama kelas (contoh: 1A, 2B, 3C):', namaKelas);
    if (!newNama) return;
    
    const newWaliKelas = prompt('Edit wali kelas:', waliKelas || '');
    const newStatus = confirm('Ubah status menjadi nonaktif?') ? 'nonaktif' : 'aktif';
    
    updateKelas(id, newNama, tingkatan, newWaliKelas, newStatus);
}

// Update kelas
async function updateKelas(id, namaKelas, tingkatan, waliKelas, status) {
    try {
        const kelasRegex = /^[1-6][A-Z]$/;
        if (!kelasRegex.test(namaKelas)) {
            showToast('Format nama kelas salah. Contoh: 1A, 2B, 3C, 4A, 5B, 6C', 'error');
            return;
        }
        
        const existing = await kelasRef.where('namaKelas', '==', namaKelas).get();
        if (!existing.empty && existing.docs[0].id !== id) {
            showToast(`Kelas ${namaKelas} sudah ada!`, 'error');
            return;
        }
        
        await kelasRef.doc(id).update({
            namaKelas: namaKelas,
            waliKelas: waliKelas || null,
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast(`✅ Kelas berhasil diupdate`, 'success');
        
        await loadKelas();
        await loadAllKelasDropdowns(true);
        
        if (typeof loadUsers === 'function') loadUsers(true);
        if (typeof loadSoal === 'function') loadSoal(true);
        
    } catch (error) {
        console.error('Error updating kelas:', error);
        showToast('Gagal update kelas: ' + error.message, 'error');
    }
}

// Hapus kelas
async function deleteKelas(id, namaKelas) {
    if (!confirm(`⚠️ Hapus kelas ${namaKelas}?`)) return;
    
    try {
        const siswaSnapshot = await usersRef
            .where('kelas', '==', namaKelas)
            .where('role', '==', 'siswa')
            .get();
        
        if (!siswaSnapshot.empty) {
            if (!confirm(`Kelas ${namaKelas} memiliki ${siswaSnapshot.size} siswa. Lanjutkan?`)) return;
            
            const batch = db.batch();
            siswaSnapshot.forEach(doc => {
                batch.update(doc.ref, { kelas: null });
            });
            await batch.commit();
        }
        
        await kelasRef.doc(id).delete();
        
        showToast(`✅ Kelas ${namaKelas} berhasil dihapus`, 'success');
        
        await loadKelas();
        await loadAllKelasDropdowns(true);
        
        if (typeof loadUsers === 'function') loadUsers(true);
        if (typeof loadSoal === 'function') loadSoal(true);
        
    } catch (error) {
        console.error('Error deleting kelas:', error);
        showToast('Gagal menghapus kelas: ' + error.message, 'error');
    }
}

// Export kelas ke Excel
function exportKelasToExcel() {
    const table = document.getElementById('kelasTable');
    if (!table) return;
    
    const rows = table.querySelectorAll('tr');
    const data = [];
    
    rows.forEach(row => {
        const rowData = [];
        row.querySelectorAll('th, td').forEach(cell => {
            if (cell.cellIndex !== 6 || row.rowIndex === 0) {
                rowData.push(cell.innerText);
            }
        });
        if (rowData.length > 0) data.push(rowData);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daftar Kelas');
    XLSX.writeFile(wb, `daftar_kelas_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showToast('📊 Export Excel berhasil', 'success');
}

// Fungsi showToast jika belum ada
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        if (type === 'error') alert(message);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Load data saat DOM ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadAllKelasDropdowns();
        if (document.getElementById('kelasTableBody')) loadKelas();
    }, 500);
});