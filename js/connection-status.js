// connection-status.js
// Simple Firebase Connection Status Checker

class FirebaseConnectionChecker {
    constructor() {
        this.checkInterval = null;
        this.isConnected = false;
        this.init();
    }
    
    init() {
        // Cek koneksi saat pertama kali load
        this.checkConnection();
        
        // Cek koneksi setiap 30 detik
        this.checkInterval = setInterval(() => {
            this.checkConnection();
        }, 30000);
        
        // Tambahkan event listener untuk klik manual
        const statusElement = document.getElementById('firebaseStatus');
        if (statusElement) {
            statusElement.addEventListener('click', () => {
                this.checkConnection(true);
            });
        }
    }
    
    async checkConnection(showToast = false) {
        this.updateStatus('checking', 'Mengecek koneksi...');
        
        try {
            // Cek apakah Firebase sudah diinisialisasi
            if (!firebase.apps.length) {
                throw new Error('Firebase belum diinisialisasi');
            }
            
            // Coba akses Firestore dengan timeout
            const db = firebase.firestore();
            
            // Set timeout untuk mencegah hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), 5000);
            });
            
            // Coba baca dokumen test
            const testPromise = db.collection('connection_test').doc('test').get();
            
            await Promise.race([testPromise, timeoutPromise]);
            
            // Jika berhasil
            this.isConnected = true;
            this.updateStatus('connected', 'Firebase: Terhubung');
            
            if (showToast) {
                this.showToast('success', 'Koneksi Firebase berhasil');
            }
            
        } catch (error) {
            // Jika gagal
            this.isConnected = false;
            let errorMessage = 'Firebase: Terputus';
            
            if (error.message === 'Timeout') {
                errorMessage = 'Firebase: Timeout';
            } else if (error.code === 'permission-denied') {
                errorMessage = 'Firebase: Izin ditolak';
            } else if (error.code === 'unavailable') {
                errorMessage = 'Firebase: Tidak tersedia';
            }
            
            this.updateStatus('disconnected', errorMessage);
            
            if (showToast) {
                this.showToast('error', 'Gagal terhubung ke Firebase');
            }
            
            console.error('Firebase connection error:', error);
        }
    }
    
    updateStatus(status, message) {
        const statusElement = document.getElementById('firebaseStatus');
        const dotElement = document.getElementById('statusDot');
        const textElement = document.getElementById('statusText');
        
        if (!statusElement || !textElement) return;
        
        // Hapus semua class status
        statusElement.classList.remove('status-connected', 'status-disconnected', 'status-checking');
        
        // Tambah class sesuai status
        statusElement.classList.add(`status-${status}`);
        
        // Update teks
        textElement.textContent = message;
        
        // Update dot (optional - dot sudah diatur di CSS)
        if (dotElement) {
            dotElement.style.backgroundColor = 
                status === 'connected' ? '#28a745' :
                status === 'disconnected' ? '#dc3545' : '#ffc107';
        }
    }
    
    showToast(type, message) {
        // Cek apakah sudah ada container toast
        let toastContainer = document.querySelector('.toast-container');
        
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
            `;
            document.body.appendChild(toastContainer);
        }
        
        // Buat toast
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            padding: 12px 20px;
            border-radius: 5px;
            margin-bottom: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s;
            border-left: 4px solid ${type === 'success' ? '#28a745' : '#dc3545'};
        `;
        
        toast.innerHTML = `
            <span>${type === 'success' ? '✅' : '❌'}</span>
            <span>${message}</span>
            <span style="margin-left: auto; cursor: pointer;" onclick="this.parentElement.remove()">✕</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Hapus setelah 3 detik
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 3000);
    }
    
    // Method untuk mendapatkan status
    getStatus() {
        return {
            isConnected: this.isConnected,
            status: this.isConnected ? 'connected' : 'disconnected'
        };
    }
}

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    window.firebaseConnection = new FirebaseConnectionChecker();
});

// Fungsi global untuk cek koneksi manual
function checkFirebaseConnection() {
    if (window.firebaseConnection) {
        window.firebaseConnection.checkConnection(true);
    }
}