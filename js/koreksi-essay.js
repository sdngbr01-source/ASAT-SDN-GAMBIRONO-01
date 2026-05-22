// koreksi-essay.js
// Manajemen koreksi jawaban essay dan isian

// Fungsi escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cache untuk menyimpan data exam (nilaiPerSoal)
if (typeof window.examCache === 'undefined') {
    window.examCache = new Map();
}

// Cache untuk menyimpan kunci jawaban soal
if (typeof window.kunciCache === 'undefined') {
    window.kunciCache = new Map();
}

// Cache untuk menyimpan data soal lengkap
if (typeof window.soalCache === 'undefined') {
    window.soalCache = new Map();
}

// Ambil data exam berdasarkan examId
async function getExamData(examId) {
    if (!examId) return null;
    
    if (window.examCache.has(examId)) {
        return window.examCache.get(examId);
    }
    
    try {
        if (typeof examsRef === 'undefined') {
            console.error('examsRef tidak terdefinisi');
            return null;
        }
        
        const examDoc = await examsRef.doc(examId).get();
        if (examDoc.exists) {
            const data = examDoc.data();
            window.examCache.set(examId, data);
            return data;
        }
    } catch (error) {
        console.error('Error ambil data exam:', error);
    }
    return null;
}

// Ambil data soal lengkap berdasarkan questionId
async function getSoalData(questionId) {
    if (!questionId) return null;
    
    if (window.soalCache.has(questionId)) {
        return window.soalCache.get(questionId);
    }
    
    try {
        if (typeof questionsRef === 'undefined') {
            console.error('questionsRef tidak terdefinisi');
            return null;
        }
        
        const soalDoc = await questionsRef.doc(questionId).get();
        if (soalDoc.exists) {
            const data = soalDoc.data();
            window.soalCache.set(questionId, data);
            return data;
        }
    } catch (error) {
        console.error('Error ambil data soal untuk', questionId, error);
    }
    return null;
}

// Ambil kunci jawaban dari collection soal berdasarkan questionId
async function getKunciJawaban(questionId) {
    if (window.kunciCache.has(questionId)) {
        return window.kunciCache.get(questionId);
    }
    
    try {
        const soalData = await getSoalData(questionId);
        if (soalData) {
            let kunci = '';
            if (soalData.tipe === 'pg') {
                kunci = soalData.kunci || '';
            } else if (soalData.tipe === 'isian') {
                kunci = soalData.kunci || '';
            } else if (soalData.tipe === 'uraian') {
                kunci = soalData.kunci || soalData.kunciJawaban || '';
            } else {
                kunci = soalData.kunci || soalData.kunciJawaban || '';
            }
            window.kunciCache.set(questionId, kunci);
            return kunci;
        }
    } catch (error) {
        console.error('Error ambil kunci jawaban untuk', questionId, error);
    }
    return '';
}

// 🔥 UPDATE: Load siswa untuk filter koreksi (dengan filter kelas dan mapel)
async function loadSiswaForKoreksi() {
    const kelas = document.getElementById('filterKelasKoreksi')?.value;
    const mapel = document.getElementById('filterMapelKoreksi')?.value;
    const siswaSelect = document.getElementById('filterSiswaKoreksi');
    
    if (!siswaSelect) return;
    
    if (!kelas || !mapel) {
        siswaSelect.innerHTML = '<option value="">Pilih Kelas dan Mapel Dulu</option>';
        return;
    }
    
    siswaSelect.innerHTML = '<option value="">Loading siswa...</option>';
    
    try {
        if (typeof usersRef === 'undefined') {
            console.error('usersRef tidak terdefinisi');
            siswaSelect.innerHTML = '<option value="">Error: usersRef tidak terdefinisi</option>';
            return;
        }
        
        // Ambil siswa yang memiliki jawaban pending berdasarkan kelas dan mapel
        const answersSnapshot = await answersRef
            .where('kelas', '==', kelas)
            .where('mataPelajaran', '==', mapel)
            .where('statusKoreksi', '==', 'pending')
            .get();
        
        const siswaMap = new Map();
        answersSnapshot.forEach(doc => {
            const data = doc.data();
            if (!siswaMap.has(data.siswaId)) {
                siswaMap.set(data.siswaId, {
                    id: data.siswaId,
                    nama: data.siswaNama || 'Tanpa Nama',
                    nis: data.nis || '-'
                });
            }
        });
        
        siswaSelect.innerHTML = '<option value="">Pilih Siswa</option>';
        
        if (siswaMap.size === 0) {
            siswaSelect.innerHTML = '<option value="">Tidak ada siswa perlu koreksi</option>';
            return;
        }
        
        for (const [id, siswa] of siswaMap) {
            siswaSelect.innerHTML += `
                <option value="${id}">${escapeHtml(siswa.nama)} (${escapeHtml(siswa.nis)})</option>
            `;
        }
        
        console.log('✅ Load siswa berhasil:', siswaMap.size, 'siswa');
        
    } catch (error) {
        console.error('Error loading siswa:', error);
        siswaSelect.innerHTML = '<option value="">Error loading siswa</option>';
    }
}

// 🔥 UPDATE: Load jawaban untuk dikoreksi (dengan filter kelas, mapel, siswa) - VERSI DIPERBAIKI
async function loadJawabanKoreksi() {
    const kelas = document.getElementById('filterKelasKoreksi')?.value;
    const mapel = document.getElementById('filterMapelKoreksi')?.value;
    const siswaId = document.getElementById('filterSiswaKoreksi')?.value;
    const jawabanList = document.getElementById('jawabanList');
    
    console.log('🔍 loadJawabanKoreksi dipanggil dengan:');
    console.log('Kelas:', kelas);
    console.log('Mapel:', mapel);
    console.log('SiswaId:', siswaId);
    
    if (!jawabanList) {
        console.error('Element jawabanList tidak ditemukan');
        return;
    }
    
    if (!kelas || !mapel || !siswaId) {
        jawabanList.innerHTML = '<p style="padding: 20px; text-align: center;">Pilih Kelas, Mapel, dan Siswa terlebih dahulu</p>';
        return;
    }
    
    jawabanList.innerHTML = '<p style="padding: 20px; text-align: center;">Loading jawaban...</p>';
    
    try {
        if (typeof answersRef === 'undefined') {
            console.error('answersRef tidak terdefinisi');
            jawabanList.innerHTML = '<p style="padding: 20px; text-align: center; color: red;">Error: answersRef tidak terdefinisi</p>';
            return;
        }
        
        // QUERY: Ambil data dengan status pending
        const snapshot = await answersRef
            .where('kelas', '==', kelas)
            .where('mataPelajaran', '==', mapel)
            .where('siswaId', '==', siswaId)
            .where('statusKoreksi', '==', 'pending')
            .get();
        
        console.log('📊 Hasil query snapshot:', snapshot.size, 'data ditemukan');
        
        // DEBUG: Tampilkan semua data yang ditemukan
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log('- ID:', doc.id);
            console.log('  status:', data.statusKoreksi);
            console.log('  ada jawabanIsian?', Object.keys(data.jawabanIsian || {}).length);
            console.log('  ada jawabanUraian?', Object.keys(data.jawabanUraian || {}).length);
        });
        
        if (snapshot.empty) {
            jawabanList.innerHTML = '<p style="padding: 20px; text-align: center;">Tidak ada jawaban yang perlu dikoreksi</p>';
            return;
        }
        
        let html = '';
        let no = 1;
        
        for (const doc of snapshot.docs) {
            const jawaban = doc.data();
            const examId = jawaban.examId;
            const jawabanIsian = jawaban.jawabanIsian || {};
            const jawabanUraian = jawaban.jawabanUraian || {};
            
            console.log(`📝 Memproses dokumen ${no}:`, doc.id);
            console.log('  Jumlah isian:', Object.keys(jawabanIsian).length);
            console.log('  Jumlah essay:', Object.keys(jawabanUraian).length);
            
            if (Object.keys(jawabanIsian).length === 0 && Object.keys(jawabanUraian).length === 0) {
                console.log('  ⚠️ Tidak ada isian atau essay, skip');
                continue;
            }
            
            const hasIsian = Object.keys(jawabanIsian).length > 0;
            const hasEssay = Object.keys(jawabanUraian).length > 0;
            
            // Ambil data exam untuk nilai maksimal
            const examData = await getExamData(examId);
            const nilaiMaksIsian = examData?.nilaiPerSoal?.isian || 5;
            const nilaiMaksUraian = examData?.nilaiPerSoal?.uraian || 10;
            
            console.log('  Nilai maks isian:', nilaiMaksIsian);
            console.log('  Nilai maks uraian:', nilaiMaksUraian);
            
            // Update nilai maksimal dan ambil kunci jawaban untuk isian
            for (const [qId, data] of Object.entries(jawabanIsian)) {
                data.nilaiMaksimal = nilaiMaksIsian;
                const kunci = await getKunciJawaban(qId);
                data.kunciJawaban = kunci;
            }
            
            // Update nilai maksimal dan ambil kunci jawaban untuk essay
            for (const [qId, data] of Object.entries(jawabanUraian)) {
                data.nilaiMaksimal = nilaiMaksUraian;
                const kunci = await getKunciJawaban(qId);
                data.kunciJawaban = kunci;
            }
            
            html += `
                <div class="jawaban-card" data-jawaban-id="${doc.id}" style="margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; padding: 15px; background: white;">
                    <div class="jawaban-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                        <h3 style="margin: 0;">${no++}. ${escapeHtml(jawaban.mataPelajaran || 'Mata Pelajaran')}</h3>
                        <span class="badge" style="background: #ffc107; color: #000; padding: 5px 10px; border-radius: 20px;">Menunggu Koreksi</span>
                    </div>
                    <div class="jawaban-info" style="margin: 10px 0; color: #666;">
                        <p><strong>Siswa:</strong> ${escapeHtml(jawaban.siswaNama || '-')}</p>
                        <p><strong>NIS:</strong> ${escapeHtml(jawaban.nis || '-')}</p>
                        <p><strong>Kelas:</strong> ${escapeHtml(jawaban.kelas || '-')}</p>
                        <p><strong>Waktu:</strong> ${jawaban.waktu ? new Date(jawaban.waktu.toDate()).toLocaleString() : '-'}</p>
                        <p><strong>Nilai PG:</strong> ${jawaban.nilaiPG || 0} / ${jawaban.totalPG || 0}</p>
                    </div>
            `;
            
            // Form koreksi
            html += `
                    <div class="koreksi-form" style="margin-top: 15px; border-top: 2px solid #eee; padding-top: 15px;">
                        <h4 style="margin-bottom: 15px;">✏️ Form Koreksi</h4>
            `;
            
            if (hasIsian) {
                html += `
                    <div class="koreksi-isian-section" style="margin-bottom: 20px;">
                        <h5 style="color: #17a2b8; margin-bottom: 10px;">📝 Koreksi Isian</h5>
                        ${renderKoreksiFieldsIsian(jawabanIsian, doc.id)}
                    </div>
                `;
            }
            
            if (hasEssay) {
                html += `
                    <div class="koreksi-essay-section">
                        <h5 style="color: #007bff; margin-bottom: 10px;">✏️ Koreksi Essay</h5>
                        ${renderKoreksiFieldsEssay(jawabanUraian, doc.id)}
                    </div>
                `;
            }
            
            html += `
                        <button class="btn btn-primary" onclick="simpanKoreksi('${doc.id}')" style="margin-top: 15px; background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                            💾 Simpan Koreksi
                        </button>
                    </div>
                </div>
            `;
        }
        
        if (html === '') {
            jawabanList.innerHTML = '<p style="padding: 20px; text-align: center;">Tidak ada jawaban yang perlu dikoreksi (semua sudah diproses)</p>';
        } else {
            jawabanList.innerHTML = html;
            console.log('✅ HTML berhasil dirender');
        }
        
    } catch (error) {
        console.error('❌ Error loading jawaban:', error);
        jawabanList.innerHTML = `<p style="padding: 20px; text-align: center; color: red;">Error: ${error.message}</p>`;
    }
}
// Render field koreksi untuk isian dengan tabel
function renderKoreksiFieldsIsian(jawabanIsian, jawabanId) {
    if (!jawabanIsian || Object.keys(jawabanIsian).length === 0) {
        return '';
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
                <tr style="background: #17a2b8; color: white;">
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 5%;">No</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left; width: 35%;">Soal</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left; width: 15%;">Kunci Jawaban</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left; width: 20%;">Jawaban Siswa</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 6%;">Nilai</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 6%;">Nilai Maks</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left; width: 8%;">Catatan</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let no = 1;
    
    const sortedIsian = Object.entries(jawabanIsian).sort((a, b) => {
        return (a[1].nomor || 0) - (b[1].nomor || 0);
    });
    
    for (const [questionId, data] of sortedIsian) {
        const nilaiMaksimal = data.nilaiMaksimal || 5;
        const kunciJawaban = data.kunciJawaban || '';
        const jawaban = data.jawaban || '';
        const soal = data.soal || '';
        
        html += `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${no++}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(soal)}</td>
                <td style="padding: 10px; border: 1px solid #ddd; background: #e8f5e9;">
                    <strong>${escapeHtml(String(kunciJawaban)) || '-'}</strong>
                </td>
                <td style="padding: 10px; border: 1px solid #ddd; background: #f0f8ff;">
                    ${escapeHtml(jawaban) || '-'}
                </td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                    <input type="number" 
                           id="nilaiIsian-${jawabanId}-${questionId}" 
                           min="0" 
                           max="${nilaiMaksimal}" 
                           step="1"
                           value="0"
                           style="width: 60px; padding: 5px; text-align: center; border: 1px solid #ddd; border-radius: 4px;">
                </td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${nilaiMaksimal}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">
                    <textarea id="catatanIsian-${jawabanId}-${questionId}" 
                              placeholder="..."
                              rows="1"
                              style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;"></textarea>
                </td>
            </tr>
        `;
    }
    
    html += `
            </tbody>
        </table>
    `;
    
    return html;
}

// Render field koreksi untuk essay dengan tabel
function renderKoreksiFieldsEssay(jawabanUraian, jawabanId) {
    if (!jawabanUraian || Object.keys(jawabanUraian).length === 0) {
        return '';
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
                <tr style="background: #007bff; color: white;">
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 5%;">No</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left; width: 35%;">Soal</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left; width: 15%;">Kunci Jawaban</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left; width: 20%;">Jawaban Siswa</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 6%;">Nilai</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 6%;">Nilai Maks</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left; width: 8%;">Catatan</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let no = 1;
    
    const sortedEssays = Object.entries(jawabanUraian).sort((a, b) => {
        return (a[1].nomor || 0) - (b[1].nomor || 0);
    });
    
    for (const [questionId, data] of sortedEssays) {
        const nilaiMaksimal = data.nilaiMaksimal || 10;
        const kunciJawaban = data.kunciJawaban || '';
        const jawaban = data.jawaban || '';
        const soal = data.soal || '';
        
        html += `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${no++}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(soal)}</td>
                <td style="padding: 10px; border: 1px solid #ddd; background: #e8f5e9;">
                    <strong>${escapeHtml(String(kunciJawaban)) || '-'}</strong>
                </td>
                <td style="padding: 10px; border: 1px solid #ddd; background: #f0f8ff;">
                    ${escapeHtml(jawaban) || '-'}
                </td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                    <input type="number" 
                           id="nilaiEssay-${jawabanId}-${questionId}" 
                           min="0" 
                           max="${nilaiMaksimal}" 
                           step="1"
                           value="0"
                           style="width: 60px; padding: 5px; text-align: center; border: 1px solid #ddd; border-radius: 4px;">
                </td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${nilaiMaksimal}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">
                    <textarea id="catatanEssay-${jawabanId}-${questionId}" 
                              placeholder="..."
                              rows="1"
                              style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;"></textarea>
                </td>
            </tr>
        `;
    }
    
    html += `
            </tbody>
        </table>
    `;
    
    return html;
}

// Fungsi simpanKoreksi (tetap sama seperti sebelumnya)
async function simpanKoreksi(jawabanId) {
    if (!confirm('Apakah Anda yakin ingin menyimpan koreksi ini?')) {
        return;
    }
    
    try {
        if (typeof answersRef === 'undefined') {
            alert('Error: answersRef tidak terdefinisi');
            return;
        }
        
        const jawabanDoc = await answersRef.doc(jawabanId).get();
        
        if (!jawabanDoc.exists) {
            alert('Data jawaban tidak ditemukan');
            return;
        }
        
        const jawaban = jawabanDoc.data();
        const jawabanIsian = jawaban.jawabanIsian || {};
        const jawabanUraian = jawaban.jawabanUraian || {};
        const examId = jawaban.examId;
        
        let nilaiIsianTotal = 0;
        let totalIsian = 0;
        let nilaiUraianTotal = 0;
        let totalUraian = 0;
        
        const koreksiDetail = {
            isian: {},
            uraian: {}
        };
        
        const examData = await getExamData(examId);
        const nilaiMaksIsian = examData?.nilaiPerSoal?.isian || 5;
        const nilaiMaksUraian = examData?.nilaiPerSoal?.uraian || 10;
        
        totalIsian = Object.keys(jawabanIsian).length * nilaiMaksIsian;
        totalUraian = Object.keys(jawabanUraian).length * nilaiMaksUraian;
        
        for (const [questionId, data] of Object.entries(jawabanIsian)) {
            const nilaiInput = document.getElementById(`nilaiIsian-${jawabanId}-${questionId}`);
            
            if (nilaiInput) {
                let nilai = parseInt(nilaiInput.value) || 0;
                if (nilai > nilaiMaksIsian) nilai = nilaiMaksIsian;
                if (nilai < 0) nilai = 0;
                
                nilaiIsianTotal += nilai;
                
                const kunciJawaban = await getKunciJawaban(questionId);
                
                koreksiDetail.isian[questionId] = {
                    nilai: nilai,
                    nilaiMaksimal: nilaiMaksIsian,
                    catatan: document.getElementById(`catatanIsian-${jawabanId}-${questionId}`)?.value || '',
                    jawaban: data.jawaban,
                    soal: data.soal,
                    kunciJawaban: kunciJawaban
                };
            }
        }
        
        for (const [questionId, data] of Object.entries(jawabanUraian)) {
            const nilaiInput = document.getElementById(`nilaiEssay-${jawabanId}-${questionId}`);
            
            if (nilaiInput) {
                let nilai = parseInt(nilaiInput.value) || 0;
                if (nilai > nilaiMaksUraian) nilai = nilaiMaksUraian;
                if (nilai < 0) nilai = 0;
                
                nilaiUraianTotal += nilai;
                
                const kunciJawaban = await getKunciJawaban(questionId);
                
                koreksiDetail.uraian[questionId] = {
                    nilai: nilai,
                    nilaiMaksimal: nilaiMaksUraian,
                    catatan: document.getElementById(`catatanEssay-${jawabanId}-${questionId}`)?.value || '',
                    jawaban: data.jawaban,
                    soal: data.soal,
                    kunciJawaban: kunciJawaban
                };
            }
        }
        
        const nilaiPG = jawaban.nilaiPG || 0;
        const totalPG = jawaban.totalPG || 0;
        
        const jumlahNilaiDiperoleh = nilaiPG + nilaiIsianTotal + nilaiUraianTotal;
        const jumlahNilaiMaksimal = totalPG + totalIsian + totalUraian;
        
        let nilaiAkhir = 0;
        if (jumlahNilaiMaksimal > 0) {
            nilaiAkhir = (jumlahNilaiDiperoleh / jumlahNilaiMaksimal) * 100;
            nilaiAkhir = Math.round(nilaiAkhir);
        }
        
        await answersRef.doc(jawabanId).update({
            nilaiIsian: nilaiIsianTotal,
            nilaiUraian: nilaiUraianTotal,
            totalIsian: totalIsian,
            totalUraian: totalUraian,
            koreksiDetail: koreksiDetail,
            statusKoreksi: 'selesai',
            dikoreksiOleh: (() => {
                try {
                    return JSON.parse(sessionStorage.getItem('currentUser'))?.nama || 'admin';
                } catch(e) {
                    return 'admin';
                }
            })(),
            waktuKoreksi: firebase.firestore.FieldValue.serverTimestamp(),
            nilaiAkhir: nilaiAkhir
        });
        
        let message = '✅ Koreksi berhasil disimpan!\n\n';
        message += `📝 Nilai Isian: ${nilaiIsianTotal} / ${totalIsian}\n`;
        message += `✏️ Nilai Essay: ${nilaiUraianTotal} / ${totalUraian}\n`;
        message += `📊 Total Nilai: ${jumlahNilaiDiperoleh} / ${jumlahNilaiMaksimal}\n`;
        message += `🎯 Nilai Akhir: ${nilaiAkhir}`;
        
        alert(message);
        
        loadJawabanKoreksi();
        if (typeof loadNilai === 'function') loadNilai();
        
    } catch (error) {
        console.error('Error saving koreksi:', error);
        alert('Gagal menyimpan koreksi: ' + error.message);
    }
}

// 🔥 UPDATE: Event listener (dengan filter mapel)
document.addEventListener('DOMContentLoaded', function() {
    const filterKelas = document.getElementById('filterKelasKoreksi');
    const filterMapel = document.getElementById('filterMapelKoreksi');
    const filterSiswa = document.getElementById('filterSiswaKoreksi');
    
    if (filterKelas) {
        filterKelas.addEventListener('change', function() {
            if (filterMapel && filterMapel.value) {
                loadSiswaForKoreksi();
            }
        });
    }
    
    if (filterMapel) {
        filterMapel.addEventListener('change', function() {
            if (filterKelas && filterKelas.value) {
                loadSiswaForKoreksi();
            }
        });
    }
    
    if (filterSiswa) {
        filterSiswa.addEventListener('change', function() {
            if (filterKelas && filterKelas.value && filterMapel && filterMapel.value) {
                loadJawabanKoreksi();
            }
        });
    }
});
