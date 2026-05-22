// management-soal.js
// Manajemen soal dengan cache

let soalCache = null;
let lastSoalFetch = 0;
const SOAL_CACHE_DURATION = 30000; // 30 detik

async function loadSoal(forceRefresh = false) {
    const kelas = document.getElementById('filterKelasSoal')?.value;
    const mapel = document.getElementById('filterMapelSoal')?.value;
    const tbody = document.getElementById('soalTableBody');
    
    if (!tbody) return;
    
    const now = Date.now();
    const cacheKey = `soal_${kelas || 'all'}_${mapel || 'all'}`;
    
    // Gunakan cache jika masih valid
    if (!forceRefresh && soalCache && soalCache.key === cacheKey && (now - lastSoalFetch) < SOAL_CACHE_DURATION) {
        console.log('📦 Menggunakan cache soal');
        renderSoalTable(soalCache.data, tbody);
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading...</td></tr>';
    
    try {
        let query = questionsRef;
        
        if (kelas) {
            query = query.where('kelas', '==', kelas);
        }
        if (mapel) {
            query = query.where('mataPelajaran', '==', mapel);
        }
        
        // HAPUS orderBy sementara karena index masih building
        // query = query.orderBy('nomor', 'asc');
        
        const snapshot = await query.get();
        
        const soals = [];
        snapshot.forEach(doc => {
            soals.push({ id: doc.id, ...doc.data() });
        });
        
        // Urutkan di JavaScript (sementara)
        soals.sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
        
        // Simpan ke cache
        soalCache = {
            key: cacheKey,
            data: soals
        };
        lastSoalFetch = now;
        
        renderSoalTable(soals, tbody);
        
    } catch (error) {
        console.error('Error loading soal:', error);
        
        if (error.message && error.message.includes('index')) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: orange;">⏳ Index sedang dibangun. Tunggu 5-10 menit lalu refresh halaman.您</tr>';
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error: ' + error.message + '您</tr>';
        }
    }
}

function renderSoalTable(soals, tbody) {
    if (!soals || soals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Tidak ada data soal</tr>';
        return;
    }
    
    tbody.innerHTML = '';
    let no = 1;
    
    soals.forEach(soal => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = no++;
        row.insertCell(1).textContent = soal.kelas || '-';
        row.insertCell(2).textContent = soal.mataPelajaran || '-';
        row.insertCell(3).innerHTML = getTipeBadge(soal.tipe);
        
        let soalText = soal.soal || '-';
        if (soalText.length > 50) soalText = soalText.substring(0, 50) + '...';
        row.insertCell(4).innerHTML = `<div style="max-width: 300px; white-space: normal;">${escapeHtml(soalText)}</div>`;
        
        let gambarHtml = '-';
        if (soal.gambar && soal.gambar !== '') {
            gambarHtml = `<a href="${soal.gambar}" target="_blank" style="color: #007bff;">🔍 Lihat</a>`;
        }
        row.insertCell(5).innerHTML = gambarHtml;
        
        row.insertCell(6).innerHTML = `
            <button class="btn-delete" onclick="deleteSoal('${soal.id}')" style="background:#dc3545; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑 Hapus</button>
        `;
    });
}

function getTipeBadge(tipe) {
    if (tipe === 'pg') {
        return '<span style="background: #007bff; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">📝 PG</span>';
    } else if (tipe === 'isian') {
        return '<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">✏️ Isian</span>';
    } else if (tipe === 'uraian') {
        return '<span style="background: #fd7e14; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">📄 Uraian</span>';
    }
    return tipe || '-';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function deleteSoal(soalId) {
    if (!confirm('Apakah Anda yakin ingin menghapus soal ini?')) return;
    
    try {
        await questionsRef.doc(soalId).delete();
        showToast('✅ Soal berhasil dihapus', 'success');
        loadSoal(true); // Force refresh
    } catch (error) {
        console.error('Error deleting soal:', error);
        showToast('❌ Gagal menghapus soal', 'error');
    }
}

function downloadTemplateSoal() {
    const templateData = [
        { Tipe: 'pg', Soal: 'Contoh soal PG', Pilihan_A: 'A', Pilihan_B: 'B', Pilihan_C: 'C', Pilihan_D: 'D', Kunci: 'A', Gambar: '' },
        { Tipe: 'isian', Soal: 'Contoh soal isian', Pilihan_A: '', Pilihan_B: '', Pilihan_C: '', Pilihan_D: '', Kunci: 'jawaban', Gambar: '' },
        { Tipe: 'uraian', Soal: 'Contoh soal uraian', Pilihan_A: '', Pilihan_B: '', Pilihan_C: '', Pilihan_D: '', Kunci: '', Gambar: '' }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{wch:10}, {wch:60}, {wch:20}, {wch:20}, {wch:20}, {wch:20}, {wch:15}, {wch:40}];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Soal');
    XLSX.writeFile(wb, 'template_soal.xlsx');
    
    showToast('📥 Template soal berhasil diunduh', 'success');
}

// management-soal.js - Perbaiki fungsi handleSoalUpload

// management-soal.js - REPLACE THIS ENTIRE FUNCTION

async function handleSoalUpload(inputElement) {
    console.log('handleSoalUpload dipanggil', inputElement);
    
    // 🔥 AMBIL FILE dengan cara yang benar
    let file = null;
    
    // Cek berbagai kemungkinan parameter yang masuk
    if (inputElement && inputElement.target) {
        // Jika dipanggil dari event (onchange)
        file = inputElement.target.files[0];
        inputElement = inputElement.target; // Simpan referensi element
    } else if (inputElement && inputElement.files) {
        // Jika dipanggil langsung dengan element
        file = inputElement.files[0];
    } else if (inputElement && inputElement.currentTarget) {
        // Jika dari event
        file = inputElement.currentTarget.files[0];
        inputElement = inputElement.currentTarget;
    }
    
    // 🔥 DEBUG: Lihat apa yang diterima
    console.log('File yang diterima:', file);
    console.log('Input element:', inputElement);
    
    // 🔥 CEK apakah file ada
    if (!file) {
        showToast('Pilih file terlebih dahulu!', 'error');
        if (inputElement) inputElement.value = '';
        return;
    }
    
    // 🔥 CEK apakah file adalah Blob/File
    if (!(file instanceof File) && !(file instanceof Blob)) {
        console.error('File bukan instance File/Blob:', file);
        showToast('File tidak valid, coba lagi!', 'error');
        if (inputElement) inputElement.value = '';
        return;
    }
    
    const kelas = document.getElementById('uploadKelas')?.value;
    const mapel = document.getElementById('uploadMapel')?.value;
    
    if (!kelas || !mapel) {
        showToast('Pilih kelas dan mata pelajaran terlebih dahulu!', 'error');
        if (inputElement) inputElement.value = '';
        return;
    }
    
    // 🔥 CEK ekstensi file
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValid) {
        showToast('File harus berupa Excel (.xlsx, .xls, .csv)', 'error');
        if (inputElement) inputElement.value = '';
        return;
    }
    
    showToast('📤 Memproses file...', 'info');
    
    // 🔥 BUAT FileReader BARU
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            if (!e.target || !e.target.result) {
                throw new Error('Gagal membaca file');
            }
            
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new Error('File Excel tidak memiliki sheet');
            }
            
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);
            
            if (!jsonData || jsonData.length === 0) {
                throw new Error('Tidak ada data di file Excel');
            }
            
            let success = 0;
            let failed = 0;
            
            // Cari nomor terakhir
            const existingQuery = await questionsRef
                .where('kelas', '==', kelas)
                .where('mataPelajaran', '==', mapel)
                .get();
            
            let lastNomor = 0;
            existingQuery.forEach(doc => {
                const data = doc.data();
                if (data.nomor && data.nomor > lastNomor) {
                    lastNomor = data.nomor;
                }
            });
            
            for (const row of jsonData) {
                if (!row.Tipe || !row.Soal) {
                    failed++;
                    continue;
                }
                
                try {
                    lastNomor++;
                    
                    // Kumpulkan gambar pilihan untuk PG
                    let gambarPilihan = {};
                    if (row.Tipe && row.Tipe.toLowerCase() === 'pg') {
                        if (row.Gambar_A) gambarPilihan.A = row.Gambar_A;
                        if (row.Gambar_B) gambarPilihan.B = row.Gambar_B;
                        if (row.Gambar_C) gambarPilihan.C = row.Gambar_C;
                        if (row.Gambar_D) gambarPilihan.D = row.Gambar_D;
                    }
                    
                    await questionsRef.add({
                        kelas: kelas,
                        mataPelajaran: mapel,
                        tipe: row.Tipe.toLowerCase(),
                        soal: row.Soal,
                        pilihan: row.Tipe === 'pg' ? [row.Pilihan_A || '', row.Pilihan_B || '', row.Pilihan_C || '', row.Pilihan_D || ''] : [],
                        gambarPilihan: gambarPilihan,
                        kunci: row.Kunci || '',
                        gambar: row.Gambar || '',
                        nomor: lastNomor,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    success++;
                } catch (err) {
                    failed++;
                    console.error('Error adding soal:', err);
                }
            }
            
            showToast(`✅ ${success} soal berhasil ditambahkan${failed > 0 ? `, ${failed} gagal` : ''}`, 'success');
            closeUploadSoalModal();
            loadSoal(true);
            
        } catch (error) {
            console.error('Error processing file:', error);
            showToast('❌ ' + error.message, 'error');
        }
        
        // Reset input file
        if (inputElement) inputElement.value = '';
    };
    
    reader.onerror = function(error) {
        console.error('FileReader error:', error);
        showToast('Gagal membaca file', 'error');
        if (inputElement) inputElement.value = '';
    };
    
    // 🔥 BACA FILE sebagai ArrayBuffer
    try {
        reader.readAsArrayBuffer(file);
    } catch (err) {
        console.error('Error calling readAsArrayBuffer:', err);
        showToast('Gagal membaca file: ' + err.message, 'error');
        if (inputElement) inputElement.value = '';
    }
}

function showUploadSoalModal() {
    const modal = document.getElementById('uploadSoalModal');
    if (modal) modal.style.display = 'block';
}

function closeUploadSoalModal() {
    const modal = document.getElementById('uploadSoalModal');
    if (modal) modal.style.display = 'none';
}

// Event listener
document.addEventListener('DOMContentLoaded', function() {
    const filterKelas = document.getElementById('filterKelasSoal');
    const filterMapel = document.getElementById('filterMapelSoal');
    
    if (filterKelas) filterKelas.addEventListener('change', () => loadSoal(true));
    if (filterMapel) filterMapel.addEventListener('change', () => loadSoal(true));
});
