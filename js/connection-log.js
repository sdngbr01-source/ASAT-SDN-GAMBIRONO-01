// connection-log.js
// Sistem logging untuk koneksi Firebase dan aktivitas admin

class ConnectionLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
        this.connectionCheckInterval = null;
        this.unreadCount = 0;
        this.isConnected = false;
        this.init();
    }
    
    init() {
        // Load logs dari localStorage
        this.loadLogs();
        
        // Cek koneksi awal
        this.checkFirebaseConnection();
        
        // Set interval untuk cek koneksi setiap 30 detik
        this.connectionCheckInterval = setInterval(() => {
            this.checkFirebaseConnection();
        }, 30000);
        
        // Listen untuk perubahan koneksi Firebase
        if (firebase.firestore) {
            firebase.firestore().enableNetwork().then(() => {
                this.addLog('Firestore network enabled', 'info', 'firebase');
            }).catch(error => {
                this.addLog(`Firestore network error: ${error.message}`, 'error', 'firebase');
            });
        }
        
        // Tambah log awal
        this.addLog('Sistem logging diinisialisasi', 'info', 'system');
        this.addLog(`User Agent: ${navigator.userAgent}`, 'info', 'system');
        this.addLog(`Waktu: ${new Date().toLocaleString('id-ID')}`, 'info', 'system');
    }
    
    checkFirebaseConnection() {
        const statusElement = document.getElementById('firebaseStatus');
        const statusText = document.getElementById('statusText');
        
        if (!firebase.apps.length) {
            this.updateConnectionStatus(false, 'Firebase tidak terinisialisasi');
            return;
        }
        
        // Cek koneksi dengan mencoba read dari Firestore
        const db = firebase.firestore();
        
        // Gunakan timeout untuk mencegah hanging
        const timeout = setTimeout(() => {
            this.updateConnectionStatus(false, 'Connection Timeout');
            this.addLog('Firebase connection timeout', 'error', 'firebase');
        }, 5000);
        
        db.collection('connection_test').doc('test').get()
            .then(() => {
                clearTimeout(timeout);
                if (!this.isConnected) {
                    this.updateConnectionStatus(true, 'Connected');
                    this.addLog('Firebase Connected Successfully', 'success', 'firebase');
                    this.showToast('Firebase Connected', 'Koneksi ke database berhasil', 'success');
                }
            })
            .catch((error) => {
                clearTimeout(timeout);
                this.updateConnectionStatus(false, 'Disconnected');
                this.addLog(`Firebase Connection Error: ${error.message}`, 'error', 'firebase');
                this.showToast('Firebase Disconnected', 'Koneksi ke database terputus', 'error');
            });
    }
    
    updateConnectionStatus(isConnected, status) {
        this.isConnected = isConnected;
        const statusElement = document.getElementById('firebaseStatus');
        const statusText = document.getElementById('statusText');
        
        if (statusElement && statusText) {
            statusElement.className = 'connection-status';
            if (isConnected) {
                statusElement.classList.add('status-connected');
                statusText.textContent = 'Firebase: Connected';
            } else {
                statusElement.classList.add('status-disconnected');
                statusText.textContent = `Firebase: ${status}`;
            }
        }
    }
    
    addLog(message, type = 'info', source = 'system') {
        const log = {
            id: Date.now() + Math.random(),
            timestamp: new Date(),
            timeString: new Date().toLocaleTimeString('id-ID', { hour12: false }),
            message: message,
            type: type,
            source: source
        };
        
        this.logs.unshift(log); // Tambah di awal
        
        // Batasi jumlah log
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
        
        // Simpan ke localStorage
        this.saveLogs();
        
        // Update badge
        this.unreadCount++;
        this.updateBadge();
        
        // Render log
        this.renderLog(log);
        
        return log;
    }
    
    renderLog(log) {
        const container = document.getElementById('logContainer');
        if (!container) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.id = `log-${log.id}`;
        
        const typeClass = `log-type-${log.type}`;
        
        logEntry.innerHTML = `
            <span class="log-time">${log.timeString}</span>
            <span class="log-type ${typeClass}">${log.source.toUpperCase()}</span>
            <span class="log-message">${log.message}</span>
        `;
        
        container.insertBefore(logEntry, container.firstChild);
    }
    
    renderAllLogs() {
        const container = document.getElementById('logContainer');
        if (!container) return;
        
        container.innerHTML = '';
        this.logs.forEach(log => this.renderLog(log));
        this.unreadCount = 0;
        this.updateBadge();
    }
    
    saveLogs() {
        try {
            const logsToSave = this.logs.map(log => ({
                ...log,
                timestamp: log.timestamp.toISOString()
            }));
            localStorage.setItem('firebase_logs', JSON.stringify(logsToSave));
        } catch (error) {
            console.error('Gagal menyimpan logs:', error);
        }
    }
    
    loadLogs() {
        try {
            const saved = localStorage.getItem('firebase_logs');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.logs = parsed.map(log => ({
                    ...log,
                    timestamp: new Date(log.timestamp)
                }));
            }
        } catch (error) {
            console.error('Gagal memuat logs:', error);
        }
    }
    
    updateBadge() {
        const badge = document.getElementById('logBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.style.display = 'inline';
                badge.textContent = this.unreadCount;
            } else {
                badge.style.display = 'none';
            }
        }
    }
    
    clearLogs() {
        this.logs = [];
        this.unreadCount = 0;
        this.updateBadge();
        localStorage.removeItem('firebase_logs');
        
        const container = document.getElementById('logContainer');
        if (container) {
            container.innerHTML = '';
        }
        
        this.addLog('Logs cleared', 'warning', 'system');
    }
    
    showToast(title, message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || '📋'}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <div class="toast-close" onclick="this.parentElement.remove()">✕</div>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }
    
    logAction(action, details, status = 'success') {
        const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        const message = `${user.nama || 'Unknown'} - ${action}: ${JSON.stringify(details)}`;
        this.addLog(message, status, 'action');
        
        // Simpan ke Firestore jika connected
        if (this.isConnected && firebase.firestore) {
            try {
                const db = firebase.firestore();
                db.collection('activity_logs').add({
                    adminId: user.id || 'unknown',
                    adminName: user.nama || 'Unknown',
                    action: action,
                    details: details,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    status: status
                }).catch(error => {
                    console.error('Gagal menyimpan log ke Firestore:', error);
                });
            } catch (error) {
                console.error('Error saving to Firestore:', error);
            }
        }
    }
}

// Inisialisasi logger
const logger = new ConnectionLogger();

// Fungsi untuk toggle log panel
function toggleLogPanel() {
    const panel = document.getElementById('logPanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        logger.renderAllLogs(); // Render ulang saat dibuka
        logger.addLog('Log panel opened', 'info', 'system');
    } else {
        panel.style.display = 'none';
        logger.unreadCount = 0;
        logger.updateBadge();
    }
}

// Fungsi clear logs
function clearLogs() {
    if (confirm('Hapus semua logs?')) {
        logger.clearLogs();
    }
}

// Log untuk berbagai aktivitas
function logUserAction(action, details, status = 'success') {
    logger.logAction(action, details, status);
}

// Override fungsi-fungsi utama untuk logging
document.addEventListener('DOMContentLoaded', function() {
    // Log saat halaman dimuat
    setTimeout(() => {
        logger.addLog('Dashboard Admin dimuat', 'info', 'system');
    }, 1000);
    
    // Override fetch untuk log error
    const originalFetch = window.fetch;
    window.fetch = function() {
        return originalFetch.apply(this, arguments)
            .catch(error => {
                logger.addLog(`Fetch error: ${error.message}`, 'error', 'network');
                throw error;
            });
    };
    
    // Log unhandled errors
    window.addEventListener('error', function(event) {
        logger.addLog(`Unhandled error: ${event.message} at ${event.filename}:${event.lineno}`, 'error', 'system');
    });
    
    window.addEventListener('unhandledrejection', function(event) {
        logger.addLog(`Unhandled promise rejection: ${event.reason}`, 'error', 'system');
    });
});