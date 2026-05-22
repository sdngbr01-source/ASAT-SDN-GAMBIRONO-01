// management-user.js
// Manajemen user (siswa) dengan cache

let userCache = null;
let lastUserFetch = 0;
const USER_CACHE_DURATION = 30000; // 30 detik

async function loadUsers(forceRefresh = false) {
    const kelas = document.getElementById('filterKelasUser')?.value;
    const tbody = document.getElementById('userTableBody');
    
    if (!tbody) return;
    
    const now = Date.now();
    const cacheKey = `users_${kelas || 'all'}`;
    
    // Gunakan cache jika masih valid dan tidak force refresh
    if (!forceRefresh && userCache && userCache.key === cacheKey && (now - lastUserFetch) < USER_CACHE_DURATION) {
        console.log('📦 Menggunakan cache users');
        renderUserTable(userCache.data, tbody);
        return;
    }
    
    tbody.innerHTML = '专栏<td colspan="5" style="text-align: center;">Loading...<专栏/tr>';
    
    try {
        let query = usersRef.where('role', '==', 'siswa');
        
        if (kelas) {
            query = query.where('kelas', '==', kelas);
        }
        
        const snapshot = await query.get();
        
        const users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        
        // Simpan ke cache
        userCache = {
            key: cacheKey,
            data: users
        };
        lastUserFetch = now;
        
        renderUserTable(users, tbody);
        
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = '专栏<td colspan="5" style="text-align: center; color: red;">Error: ' + error.message + '<专栏/tr>';
    }
}

function renderUserTable(users, tbody) {
    if (!users || users.length === 0) {
        tbody.innerHTML = '专栏<td colspan="5" style="text-align: center;">Tidak ada data siswa<专栏/tr>';
        return;
    }
    
    tbody.innerHTML = '';
    let no = 1;
    
    users.forEach(user => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = no++;
        row.insertCell(1).textContent = user.nis || '-';
        row.insertCell(2).textContent = user.nama || '-';
        row.insertCell(3).textContent = user.kelas || '-';
        row.insertCell(4).innerHTML = `
            <button class="btn-reset" onclick="resetPassword('${user.id}', '${user.nama}')" style="background:#ffc107; border:none; padding:4px 8px; border-radius:4px; margin-right:5px; cursor:pointer;">🔑 Reset</button>
            <button class="btn-delete" onclick="deleteUser('${user.id}', '${user.nama}')" style="background:#dc3545; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑 Hapus</button>
        `;
    });
}

async function resetPassword(userId, nama) {
    if (!confirm(`Reset password untuk ${nama}? Password akan direset ke "123456"`)) return;
    
    try {
        await usersRef.doc(userId).update({ password: '123456' });
        showToast(`✅ Password ${nama} berhasil direset ke 123456`, 'success');
    } catch (error) {
        console.error('Error reset password:', error);
        showToast('❌ Gagal reset password', 'error');
    }
}

async function deleteUser(userId, nama) {
    if (!confirm(`Hapus siswa ${nama}?`)) return;
    
    try {
        await usersRef.doc(userId).delete();
        showToast(`✅ Siswa ${nama} berhasil dihapus`, 'success');
        // Force refresh cache
        loadUsers(true);
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('❌ Gagal menghapus siswa', 'error');
    }
}

function downloadTemplate() {
    const data = [
        ['NIS', 'Nama', 'Kelas', 'Password'],
        ['12345', 'Budi Santoso', '6A', '123456'],
        ['12346', 'Ani Susanti', '6A', '123456']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
    XLSX.writeFile(wb, 'template_siswa.xlsx');
    
    showToast('📥 Template berhasil diunduh', 'success');
}

async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    showToast('📤 Memproses file...', 'info');
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            let success = 0;
            let error = 0;
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0] || !row[1]) continue;
                
                try {
                    await usersRef.add({
                        nis: row[0].toString(),
                        nama: row[1].toString(),
                        kelas: row[2] ? row[2].toString() : '',
                        password: row[3] ? row[3].toString() : '123456',
                        role: 'siswa',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    success++;
                } catch (err) {
                    error++;
                    console.error('Error adding user:', err);
                }
            }
            
            showToast(`✅ ${success} siswa berhasil ditambahkan${error > 0 ? `, ${error} gagal` : ''}`, 'success');
            closeUploadModal();
            loadUsers(true); // Force refresh
        } catch (error) {
            console.error('Error reading file:', error);
            showToast('❌ Gagal membaca file', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Event listener
document.addEventListener('DOMContentLoaded', function() {
    const filterKelas = document.getElementById('filterKelasUser');
    if (filterKelas) {
        filterKelas.addEventListener('change', () => loadUsers(true));
    }
});