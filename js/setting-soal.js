// setting-soal.js
// Setting soal & nilai ujian

// JANGAN DEKLARASIKAN ULANG examsRef
// Gunakan yang sudah ada dari firebase-config.js atau file lain
// Hapus baris: const examsRef = db.collection('exams');

let examCache = null;
let lastExamFetch = 0;
const EXAM_CACHE_DURATION = 30000; // 30 detik

// Load daftar ujian
async function loadExamList(forceRefresh = false) {
    const tbody = document.getElementById('examListBody');
    if (!tbody) return;
    
    const now = Date.now();
    
    // Cek apakah examsRef tersedia
    if (typeof examsRef === 'undefined') {
        console.error('examsRef tidak terdefinisi');
        tbody.innerHTML = '发展<td colspan="8" style="text-align: center; color: red;">Error: examsRef tidak terdefinisi</td></tr>';
        return;
    }
    
    if (!forceRefresh && examCache && (now - lastExamFetch) < EXAM_CACHE_DURATION) {
        console.log('📦 Menggunakan cache exam list');
        renderExamTable(examCache, tbody);
        return;
    }
    
    tbody.innerHTML = '发展<td colspan="8" style="text-align: center;">Loading...发展</tr>';
    
    try {
        const snapshot = await examsRef.where('aktif', '==', true).orderBy('createdAt', 'desc').get();
        
        const exams = [];
        snapshot.forEach(doc => {
            exams.push({ id: doc.id, ...doc.data() });
        });
        
        examCache = exams;
        lastExamFetch = now;
        
        renderExamTable(exams, tbody);
        
    } catch (error) {
        console.error('Error loading exam list:', error);
        tbody.innerHTML = `发展<td colspan="8" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
    }
}

function renderExamTable(exams, tbody) {
    if (!exams || exams.length === 0) {
        tbody.innerHTML = '发展<td colspan="8" style="text-align: center;">Tidak ada ujian aktif</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    let no = 1;
    
    exams.forEach(exam => {
        const totalSoal = (exam.jumlahSoal?.pg || 0) + (exam.jumlahSoal?.isian || 0) + (exam.jumlahSoal?.uraian || 0);
        const totalNilai = exam.totalNilaiMaksimal?.keseluruhan || 0;
        
        const row = tbody.insertRow();
        row.insertCell(0).textContent = no++;
        row.insertCell(1).textContent = exam.kelas || '-';
        row.insertCell(2).textContent = exam.mataPelajaran || '-';
        row.insertCell(3).textContent = `${totalSoal} soal (PG:${exam.jumlahSoal?.pg||0}, Isian:${exam.jumlahSoal?.isian||0}, Uraian:${exam.jumlahSoal?.uraian||0})`;
        row.insertCell(4).textContent = totalNilai;
        row.insertCell(5).textContent = `${exam.durasi || 60} menit`;
        row.insertCell(6).innerHTML = '<span style="background:#28a745; color:white; padding:2px 8px; border-radius:12px;">✅ Aktif</span>';
        row.insertCell(7).innerHTML = `
            <button onclick="deactivateExam('${exam.id}')" style="background:#dc3545; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🔴 Nonaktifkan</button>
        `;
    });
}

// Nonaktifkan ujian
async function deactivateExam(examId) {
    if (!confirm('Nonaktifkan ujian ini? Siswa tidak akan bisa mengerjakan ujian ini lagi.')) return;
    
    // Cek apakah examsRef tersedia
    if (typeof examsRef === 'undefined') {
        showToast('Error: examsRef tidak terdefinisi', 'error');
        return;
    }
    
    try {
        await examsRef.doc(examId).update({
            aktif: false,
            deactivatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('✅ Ujian dinonaktifkan', 'success');
        loadExamList(true);
    } catch (error) {
        console.error('Error deactivating exam:', error);
        showToast('❌ Gagal menonaktifkan ujian', 'error');
    }
}

// Handle form setting ujian
const examSettingForm = document.getElementById('examSettingForm');
if (examSettingForm) {
    examSettingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Cek apakah examsRef tersedia
        if (typeof examsRef === 'undefined') {
            showToast('Error: examsRef tidak terdefinisi', 'error');
            return;
        }
        
        const kelas = document.getElementById('settingKelas').value;
        const mapel = document.getElementById('settingMapel').value;
        const jmlPG = parseInt(document.getElementById('jmlPG').value) || 0;
        const jmlIsian = parseInt(document.getElementById('jmlIsian').value) || 0;
        const jmlUraian = parseInt(document.getElementById('jmlUraian').value) || 0;
        const nilaiPG = parseInt(document.getElementById('nilaiPG').value) || 1;
        const nilaiIsian = parseInt(document.getElementById('nilaiIsian').value) || 2;
        const nilaiUraian = parseInt(document.getElementById('nilaiUraian').value) || 3;
        const durasi = parseInt(document.getElementById('durasi').value) || 60;
        
        if (!kelas || !mapel) {
            showToast('Pilih kelas dan mata pelajaran!', 'error');
            return;
        }
        
        if (jmlPG === 0 && jmlIsian === 0 && jmlUraian === 0) {
            showToast('Minimal harus ada 1 soal!', 'error');
            return;
        }
        
        try {
            const examQuery = await examsRef
                .where('kelas', '==', kelas)
                .where('mataPelajaran', '==', mapel)
                .get();
            
            const totalNilaiPG = jmlPG * nilaiPG;
            const totalNilaiIsian = jmlIsian * nilaiIsian;
            const totalNilaiUraian = jmlUraian * nilaiUraian;
            
            const examData = {
                kelas: kelas,
                mataPelajaran: mapel,
                jumlahSoal: { pg: jmlPG, isian: jmlIsian, uraian: jmlUraian },
                nilaiPerSoal: { pg: nilaiPG, isian: nilaiIsian, uraian: nilaiUraian },
                totalNilaiMaksimal: {
                    pg: totalNilaiPG,
                    isian: totalNilaiIsian,
                    uraian: totalNilaiUraian,
                    keseluruhan: totalNilaiPG + totalNilaiIsian + totalNilaiUraian
                },
                durasi: durasi,
                aktif: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (!examQuery.empty) {
                await examsRef.doc(examQuery.docs[0].id).update(examData);
                showToast('✅ Setting ujian berhasil diupdate!', 'success');
            } else {
                examData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await examsRef.add(examData);
                showToast('✅ Setting ujian berhasil disimpan!', 'success');
            }
            
            examSettingForm.reset();
            loadExamList(true);
            
        } catch (error) {
            console.error('Error saving exam setting:', error);
            showToast('❌ Gagal menyimpan setting ujian: ' + error.message, 'error');
        }
    });
}

// Load exam list saat halaman dimuat
if (document.getElementById('examListBody')) {
    setTimeout(() => loadExamList(), 500);
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