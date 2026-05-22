// Ambil role dari URL
const urlParams = new URLSearchParams(window.location.search);
const role = urlParams.get('role');

// Set judul berdasarkan role
if (role === 'siswa') {
    document.getElementById('role-title').textContent = 'Login Siswa';
    document.getElementById('kelasSelect').style.display = 'block';
} else if (role === 'admin') {
    document.getElementById('role-title').textContent = 'Login Admin';
    document.getElementById('kelasSelect').style.display = 'none';
}

// Fungsi untuk cek jam akses siswa (07.00 - 11.00 WIB)
function isSchoolHourWIB() {
    const now = new Date();
    // Konversi ke WIB (UTC+7) jika browser pakai UTC
    // Browser sudah menggunakan waktu lokal sistem, asumsikan WIB
    let hour = now.getHours();
    let minute = now.getMinutes();
    
    // Jam 07:00 sampai 10:59 (sebelum 11:00)
    if (hour >= 7 && hour < 12) {
        return true;
    }
    // Bisa juga sampai jam 11:00 tepat
    // if ((hour === 7 || hour === 8 || hour === 9 || hour === 10) || 
    //     (hour === 11 && minute === 0)) {
    //     return true;
    // }
    return false;
}

// Handle login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const kelas = document.getElementById('kelas')?.value;
    
    try {
        if (role === 'siswa') {
            // CEK JAM AKSES DULU
            if (!isSchoolHourWIB()) {
                alert('Akses hanya diperbolehkan pada jam SEKOLAH!');
                return;
            }
            
            // Cari siswa di Firestore
            const siswaQuery = await usersRef
                .where('nis', '==', username)
                .where('kelas', '==', kelas)
                .where('role', '==', 'siswa')
                .get();
            
            if (siswaQuery.empty) {
                alert('NIS atau kelas tidak ditemukan!');
                return;
            }
            
            const siswaData = siswaQuery.docs[0].data();
            
            // Simpan data ke sessionStorage
            sessionStorage.setItem('currentUser', JSON.stringify({
                id: siswaQuery.docs[0].id,
                ...siswaData
            }));
            
            // Redirect ke dashboard siswa
            window.location.href = 'dashboard-siswa.html';
            
        } else if (role === 'admin') {
            // Login admin (TANPA batasan jam)
            if (username === 'admin' && password === '20524756') {
                sessionStorage.setItem('currentUser', JSON.stringify({
                    id: 'admin1',
                    nama: 'Administrator',
                    role: 'admin'
                }));
                window.location.href = 'dashboard-admin.html';
            } else {
                alert('Username atau password admin salah!');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Terjadi kesalahan saat login');
    }
});
