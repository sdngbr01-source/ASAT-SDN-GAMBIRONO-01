// pdf-setting.js
// Manajemen setting PDF dengan upload gambar lokal

// Key untuk localStorage
const PDF_SETTING_KEY = 'pdf_header_setting';

// Fungsi untuk mendapatkan elemen dengan aman
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element dengan id "${id}" tidak ditemukan`);
    }
    return element;
}

// Kompres gambar sebelum diupload ke Firestore
async function compressImage(file, maxWidth = 200, maxHeight = 200, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    } else {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                const sizeInBytes = Math.round((compressedDataUrl.length * 3) / 4);
                console.log(`Ukuran gambar setelah kompresi: ${(sizeInBytes / 1024).toFixed(2)} KB`);
                
                if (sizeInBytes > 800000) {
                    const moreCompressed = canvas.toDataURL('image/jpeg', 0.5);
                    resolve(moreCompressed);
                } else {
                    resolve(compressedDataUrl);
                }
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// Handle upload logo dengan kompresi
async function handleLogoUpload(position, input) {
    const file = input.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        showToast('Hanya file gambar yang diperbolehkan!', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file maksimal 5MB!', 'error');
        return;
    }
    
    showToast('📸 Memproses gambar...', 'info');
    
    try {
        const compressedBase64 = await compressImage(file, 150, 150, 0.7);
        const sizeInBytes = Math.round((compressedBase64.length * 3) / 4);
        
        if (sizeInBytes > 900000) {
            showToast('Gambar masih terlalu besar setelah kompresi', 'error');
            return;
        }
        
        if (position === 'kiri') {
            const dataInput = getElement('logoKiriData');
            if (dataInput) dataInput.value = compressedBase64;
            const img = getElement('logoKiriImg');
            if (img) {
                img.src = compressedBase64;
                img.style.display = 'block';
            }
        } else {
            const dataInput = getElement('logoKananData');
            if (dataInput) dataInput.value = compressedBase64;
            const img = getElement('logoKananImg');
            if (img) {
                img.src = compressedBase64;
                img.style.display = 'block';
            }
        }
        
        updatePdfPreview();
        showToast(`Logo ${position === 'kiri' ? 'kiri' : 'kanan'} berhasil diupload`, 'success');
        
    } catch (error) {
        console.error('Error compressing image:', error);
        showToast('Gagal memproses gambar', 'error');
    }
}

// Update preview header
function updatePdfPreview() {
    const previewDiv = getElement('pdfPreview');
    if (!previewDiv) return;
    
    const sekolahNama = getElement('sekolahNama')?.value || 'Nama Sekolah';
    const sekolahAlamat = getElement('sekolahAlamat')?.value || 'Alamat Sekolah';
    const sekolahKota = getElement('sekolahKota')?.value || '';
    const sekolahTelp = getElement('sekolahTelp')?.value || '';
    const sekolahEmail = getElement('sekolahEmail')?.value || '';
    const sekolahMotto = getElement('sekolahMotto')?.value || '';
    const headerWarna = getElement('headerWarna')?.value || '#2c3e50';
    const logoWidth = getElement('logoWidth')?.value || 40;
    const logoHeight = getElement('logoHeight')?.value || 40;
    const logoKiriData = getElement('logoKiriData')?.value || '';
    const logoKananData = getElement('logoKananData')?.value || '';
    
    previewDiv.innerHTML = `
        <div style="background: ${headerWarna}; color: white; padding: 15px; border-radius: 5px; text-align: center;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px;">
                ${logoKiriData ? `<img src="${logoKiriData}" style="width: ${logoWidth}px; height: ${logoHeight}px; object-fit: contain;">` : '<div style="width: 40px;"></div>'}
                <div style="flex: 1;">
                    <div style="font-size: 16px; font-weight: bold; white-space: pre-line;">${escapeHtml(sekolahNama)}</div>
                    <div style="font-size: 12px; white-space: pre-line;">${escapeHtml(sekolahAlamat)}</div>
                    ${sekolahKota ? `<div style="font-size: 11px;">${escapeHtml(sekolahKota)}</div>` : ''}
                    <div style="font-size: 10px; margin-top: 5px;">
                        ${sekolahTelp ? `Telp: ${escapeHtml(sekolahTelp)} | ` : ''}
                        ${sekolahEmail ? `Email: ${escapeHtml(sekolahEmail)}` : ''}
                    </div>
                    ${sekolahMotto ? `<div style="font-size: 11px; font-style: italic; margin-top: 5px; white-space: pre-line;">${escapeHtml(sekolahMotto)}</div>` : ''}
                </div>
                ${logoKananData ? `<img src="${logoKananData}" style="width: ${logoWidth}px; height: ${logoHeight}px; object-fit: contain;">` : '<div style="width: 40px;"></div>'}
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Simpan setting PDF
const pdfSettingForm = getElement('pdfSettingForm');
if (pdfSettingForm) {
    pdfSettingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const setting = {
            sekolahNama: getElement('sekolahNama')?.value || '',
            sekolahAlamat: getElement('sekolahAlamat')?.value || '',
            sekolahKota: getElement('sekolahKota')?.value || '',
            sekolahTelp: getElement('sekolahTelp')?.value || '',
            sekolahEmail: getElement('sekolahEmail')?.value || '',
            sekolahMotto: getElement('sekolahMotto')?.value || '',
            headerWarna: getElement('headerWarna')?.value || '#2c3e50',
            logoWidth: getElement('logoWidth')?.value || 40,
            logoHeight: getElement('logoHeight')?.value || 40,
            logoKiriData: getElement('logoKiriData')?.value || '',
            logoKananData: getElement('logoKananData')?.value || '',
            updatedAt: new Date().toISOString()
        };
        
        try {
            localStorage.setItem(PDF_SETTING_KEY, JSON.stringify(setting));
            
            if (typeof db !== 'undefined' && db) {
                const settingWithoutLogo = {
                    sekolahNama: setting.sekolahNama,
                    sekolahAlamat: setting.sekolahAlamat,
                    sekolahKota: setting.sekolahKota,
                    sekolahTelp: setting.sekolahTelp,
                    sekolahEmail: setting.sekolahEmail,
                    sekolahMotto: setting.sekolahMotto,
                    headerWarna: setting.headerWarna,
                    logoWidth: setting.logoWidth,
                    logoHeight: setting.logoHeight,
                    hasLogoKiri: !!setting.logoKiriData,
                    hasLogoKanan: !!setting.logoKananData,
                    updatedAt: setting.updatedAt
                };
                await db.collection('settings').doc('pdfHeader').set(settingWithoutLogo, { merge: true });
            }
            
            showToast('✅ Setting PDF berhasil disimpan!', 'success');
        } catch (error) {
            console.error('Error saving PDF setting:', error);
            showToast('❌ Gagal menyimpan setting PDF', 'error');
        }
    });
}

// Load setting PDF
async function loadPdfSetting() {
    try {
        let setting = null;
        const localSetting = localStorage.getItem(PDF_SETTING_KEY);
        if (localSetting) {
            setting = JSON.parse(localSetting);
        }
        
        if (typeof db !== 'undefined' && db) {
            try {
                const doc = await db.collection('settings').doc('pdfHeader').get();
                if (doc.exists) {
                    const firestoreData = doc.data();
                    setting = setting ? { ...setting, ...firestoreData } : firestoreData;
                }
            } catch (err) {
                console.warn('Gagal load dari Firestore:', err);
            }
        }
        
        if (setting) {
            const sekolahNama = getElement('sekolahNama');
            if (sekolahNama) sekolahNama.value = setting.sekolahNama || '';
            
            const sekolahAlamat = getElement('sekolahAlamat');
            if (sekolahAlamat) sekolahAlamat.value = setting.sekolahAlamat || '';
            
            const sekolahKota = getElement('sekolahKota');
            if (sekolahKota) sekolahKota.value = setting.sekolahKota || '';
            
            const sekolahTelp = getElement('sekolahTelp');
            if (sekolahTelp) sekolahTelp.value = setting.sekolahTelp || '';
            
            const sekolahEmail = getElement('sekolahEmail');
            if (sekolahEmail) sekolahEmail.value = setting.sekolahEmail || '';
            
            const sekolahMotto = getElement('sekolahMotto');
            if (sekolahMotto) sekolahMotto.value = setting.sekolahMotto || '';
            
            const headerWarna = getElement('headerWarna');
            if (headerWarna) headerWarna.value = setting.headerWarna || '#2c3e50';
            
            const logoWidth = getElement('logoWidth');
            if (logoWidth) logoWidth.value = setting.logoWidth || 40;
            
            const logoHeight = getElement('logoHeight');
            if (logoHeight) logoHeight.value = setting.logoHeight || 40;
            
            if (setting.logoKiriData) {
                const logoKiriData = getElement('logoKiriData');
                if (logoKiriData) logoKiriData.value = setting.logoKiriData;
                const img = getElement('logoKiriImg');
                if (img) {
                    img.src = setting.logoKiriData;
                    img.style.display = 'block';
                }
            }
            
            if (setting.logoKananData) {
                const logoKananData = getElement('logoKananData');
                if (logoKananData) logoKananData.value = setting.logoKananData;
                const img = getElement('logoKananImg');
                if (img) {
                    img.src = setting.logoKananData;
                    img.style.display = 'block';
                }
            }
            
            updatePdfPreview();
        } else {
            resetPdfSetting();
        }
    } catch (error) {
        console.error('Error loading PDF setting:', error);
        resetPdfSetting();
    }
}

function resetPdfSetting() {
    const sekolahNama = getElement('sekolahNama');
    if (sekolahNama) sekolahNama.value = 'SD NEGERI 01 JAKARTA\nTERAKREDITASI A';
    
    const sekolahAlamat = getElement('sekolahAlamat');
    if (sekolahAlamat) sekolahAlamat.value = 'Jl. Pendidikan No. 123\nKel. Menteng, Kec. Menteng';
    
    const sekolahKota = getElement('sekolahKota');
    if (sekolahKota) sekolahKota.value = 'Jakarta Pusat';
    
    const sekolahTelp = getElement('sekolahTelp');
    if (sekolahTelp) sekolahTelp.value = '(021) 12345678';
    
    const sekolahEmail = getElement('sekolahEmail');
    if (sekolahEmail) sekolahEmail.value = 'info@sekolah.sch.id';
    
    const sekolahMotto = getElement('sekolahMotto');
    if (sekolahMotto) sekolahMotto.value = 'Berilmu, Beriman, Berakhlak Mulia\nMembangun Generasi Unggul';
    
    const headerWarna = getElement('headerWarna');
    if (headerWarna) headerWarna.value = '#2c3e50';
    
    const logoWidth = getElement('logoWidth');
    if (logoWidth) logoWidth.value = '40';
    
    const logoHeight = getElement('logoHeight');
    if (logoHeight) logoHeight.value = '40';
    
    const logoKiriData = getElement('logoKiriData');
    if (logoKiriData) logoKiriData.value = '';
    
    const logoKananData = getElement('logoKananData');
    if (logoKananData) logoKananData.value = '';
    
    const logoKiriImg = getElement('logoKiriImg');
    if (logoKiriImg) logoKiriImg.style.display = 'none';
    
    const logoKananImg = getElement('logoKananImg');
    if (logoKananImg) logoKananImg.style.display = 'none';
    
    updatePdfPreview();
    showToast('Setting direset ke default', 'info');
}

// ============ FUNGSI GET PDF SETTING ============
function getPdfSetting() {
    try {
        // Coba ambil dari localStorage dulu
        let setting = localStorage.getItem(PDF_SETTING_KEY);
        if (setting) {
            setting = JSON.parse(setting);
            console.log('✅ Setting PDF dari localStorage:', setting.sekolahNama);
            return setting;
        }
        
        // Jika tidak ada, return default
        return {
            sekolahNama: 'SD NEGERI 01 JAKARTA\nTERAKREDITASI A',
            sekolahAlamat: 'Jl. Pendidikan No. 123\nKel. Menteng, Kec. Menteng',
            sekolahKota: 'Jakarta Pusat',
            sekolahTelp: '(021) 12345678',
            sekolahEmail: 'info@sekolah.sch.id',
            sekolahMotto: 'Berilmu, Beriman, Berakhlak Mulia',
            headerWarna: '#2c3e50',
            logoWidth: 40,
            logoHeight: 40,
            logoKiriData: '',
            logoKananData: ''
        };
    } catch (error) {
        console.error('Error getPdfSetting:', error);
        return {};
    }
}
// ============ GENERATE PDF (SEMUA SISWA DALAM 1 FILE) ============
async function generateLembarJawaban() {
    const kelas = getElement('generateKelas')?.value;
    const mapel = getElement('generateMapel')?.value;
    
    if (!kelas || !mapel) {
        showToast('Pilih kelas dan mata pelajaran!', 'error');
        return;
    }
    
    const setting = getPdfSetting();
    
    if (typeof usersRef === 'undefined') {
        showToast('Data siswa tidak tersedia', 'error');
        return;
    }
    
    try {
        showToast('📄 Mengambil data siswa...', 'info');
        
        const siswaSnapshot = await usersRef
            .where('kelas', '==', kelas)
            .where('role', '==', 'siswa')
            .get();
        
        if (siswaSnapshot.empty) {
            showToast('Tidak ada siswa di kelas ini', 'error');
            return;
        }
        
        // Ambil semua examId dari jawaban untuk mendapatkan soal
        let soalMap = new Map();
        const semuaJawabanSnapshot = await answersRef
            .where('kelas', '==', kelas)
            .where('mataPelajaran', '==', mapel)
            .get();
        
        const examIds = new Set();
        semuaJawabanSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.examId) {
                examIds.add(data.examId);
            }
        });
        
        // Ambil soal berdasarkan setiap examId
        if (examIds.size > 0 && typeof soalRef !== 'undefined') {
            for (const examId of examIds) {
                const soalSnapshot = await soalRef
                    .where('examId', '==', examId)
                    .get();
                
                soalSnapshot.forEach(doc => {
                    const soal = doc.data();
                    const key = `${examId}_${soal.nomor}`;
                    soalMap.set(key, {
                        nomor: soal.nomor,
                        soal: soal.soal || '',
                        kunci: soal.kunci || '',
                        jenis: soal.jenis || 'pg'
                    });
                });
            }
        }
        
        // Kumpulkan data semua siswa beserta jawabannya
        const siswaList = [];
        for (const doc of siswaSnapshot.docs) {
            const siswa = { id: doc.id, ...doc.data() };
            
            let jawabanData = null;
            if (typeof answersRef !== 'undefined') {
                const jawabanSnapshot = await answersRef
                    .where('siswaId', '==', siswa.id)
                    .where('mataPelajaran', '==', mapel)
                    .orderBy('waktu', 'desc')
                    .limit(1)
                    .get();
                
                if (!jawabanSnapshot.empty) {
                    jawabanData = jawabanSnapshot.docs[0].data();
                }
            }
            
            siswaList.push({
                ...siswa,
                jawabanData: jawabanData
            });
        }
        
        showToast(`📄 Membuat 1 file PDF untuk ${siswaList.length} siswa...`, 'info');
        
        // Generate satu PDF untuk semua siswa
        await generateAllStudentsPDF(siswaList, kelas, mapel, setting, soalMap);
        
        showToast(`✅ Berhasil generate PDF untuk ${siswaList.length} siswa`, 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('❌ Gagal generate PDF: ' + error.message, 'error');
    }
}

// Fungsi untuk membuat satu PDF berisi semua siswa
async function generateAllStudentsPDF(siswaList, kelas, mapel, setting, soalMap) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    let isFirstPage = true;
    
    for (let idx = 0; idx < siswaList.length; idx++) {
        const siswa = siswaList[idx];
        const jawabanData = siswa.jawabanData;
        
        // Jika bukan halaman pertama, tambah halaman baru
        if (!isFirstPage) {
            doc.addPage();
        }
        isFirstPage = false;
        
        // ============ HEADER ============
        const headerHeight = 35;
        const headerWarna = setting.headerWarna || '#2c3e50';
        
        doc.setFillColor(parseInt(headerWarna.slice(1,3), 16),
                         parseInt(headerWarna.slice(3,5), 16),
                         parseInt(headerWarna.slice(5,7), 16));
        doc.rect(0, 0, 210, headerHeight, 'F');
        
        const logoWidth = (parseInt(setting.logoWidth) || 25) / 1.5;
        const logoHeight = (parseInt(setting.logoHeight) || 25) / 1.5;
        const logoY = (headerHeight - logoHeight) / 2;
        
        if (setting.logoKiriData && setting.logoKiriData.startsWith('data:image')) {
            try {
                doc.addImage(setting.logoKiriData, 'JPEG', 8, logoY, logoWidth, logoHeight);
            } catch (e) {}
        }
        
        if (setting.logoKananData && setting.logoKananData.startsWith('data:image')) {
            try {
                doc.addImage(setting.logoKananData, 'JPEG', 210 - 8 - logoWidth, logoY, logoWidth, logoHeight);
            } catch (e) {}
        }
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        
        const sekolahNama = setting.sekolahNama?.split('\n') || ['SEKOLAH'];
        let textY = 8;
        sekolahNama.forEach(line => {
            doc.text(line, 105, textY, { align: 'center' });
            textY += 4.5;
        });
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        
        const sekolahAlamat = setting.sekolahAlamat?.split('\n') || [];
        sekolahAlamat.forEach(line => {
            doc.text(line, 105, textY, { align: 'center' });
            textY += 3.5;
        });
        
        if (setting.sekolahKota) {
            doc.text(setting.sekolahKota, 105, textY, { align: 'center' });
            textY += 3;
        }
        
        if (setting.sekolahTelp || setting.sekolahEmail) {
            doc.text(`Telp: ${setting.sekolahTelp || '-'} | Email: ${setting.sekolahEmail || '-'}`, 105, textY, { align: 'center' });
            textY += 3.5;
        }
        
        doc.setFontSize(6);
        doc.setFont('helvetica', 'italic');
        const mottoLines = (setting.sekolahMotto || '').split('\n');
        for (const line of mottoLines) {
            if (line.trim()) {
                doc.text(line.trim(), 105, textY, { align: 'center' });
                textY += 3;
            }
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.line(10, headerHeight - 1, 200, headerHeight - 1);
        
        // ============ INFORMASI SISWA ============
        const infoStartY = headerHeight + 6;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('LEMBAR JAWABAN SISWA', 105, infoStartY, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        let currentY = infoStartY + 7;
        
        // Tambahkan nomor urut siswa
        doc.text(`No. Urut: ${idx + 1} / ${siswaList.length}`, 20, currentY);
        currentY += 6;
        doc.text(`Nama: ${siswa.nama || '-'}`, 20, currentY);
        currentY += 5;
        doc.text(`NIS: ${siswa.nis || '-'}`, 20, currentY);
        currentY += 5;
        doc.text(`Kelas: ${kelas}`, 20, currentY);
        currentY += 5;
        doc.text(`Mata Pelajaran: ${mapel}`, 20, currentY);
        currentY += 5;
        doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 20, currentY);
        
        // ============ RINGKASAN NILAI ============
        if (jawabanData) {
            const nilaiPG = jawabanData.nilaiPG || 0;
            const nilaiIsian = jawabanData.nilaiIsian || 0;
            const nilaiUraian = jawabanData.nilaiUraian || 0;
            const totalPG = jawabanData.totalPG || 0;
            const totalIsian = jawabanData.totalIsian || 0;
            const totalUraian = jawabanData.totalUraian || 0;
            
            const jumlahDiperoleh = nilaiPG + nilaiIsian + nilaiUraian;
            const jumlahMaksimal = totalPG + totalIsian + totalUraian;
            
            let nilaiAkhir = 0;
            if (jumlahMaksimal > 0) {
                nilaiAkhir = Math.round((jumlahDiperoleh / jumlahMaksimal) * 100);
            }
            
            doc.setFont('helvetica', 'bold');
            doc.text('RINGKASAN NILAI:', 140, currentY - 5);
            doc.setFont('helvetica', 'normal');
            doc.text(`PG: ${nilaiPG}`, 140, currentY);
            doc.text(`Isian: ${nilaiIsian}`, 140, currentY + 5);
            doc.text(`Uraian: ${nilaiUraian}`, 140, currentY + 10);
            doc.setFont('helvetica', 'bold');
            doc.text(`Total: ${nilaiAkhir}`, 140, currentY + 15);
            doc.setFont('helvetica', 'normal');
            currentY += 20;
        } else {
            currentY += 10;
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(150, 150, 150);
            doc.text('* Belum ada data nilai *', 140, currentY);
            doc.setTextColor(0, 0, 0);
            currentY += 15;
        }
        
        // ============ KUMPULKAN JAWABAN ============
        let allJawaban = [];
        
        if (jawabanData) {
            const examId = jawabanData.examId;
            const nilaiMaksPG = (jawabanData.totalPG || 0) / (jawabanData.jumlahSoal?.pg || 1);
            const nilaiMaksIsian = (jawabanData.totalIsian || 0) / (jawabanData.jumlahSoal?.isian || 1);
            
            // Jawaban PG
            if (jawabanData.jawabanPG) {
                Object.values(jawabanData.jawabanPG).forEach(item => {
                    const nomor = parseInt(item.nomor);
                    const key = `${examId}_${nomor}`;
                    
                    let soalText = item.soal || '';
                    let kunciJawaban = item.kunci || '-';
                    
                    if (soalMap.has(key)) {
                        const soal = soalMap.get(key);
                        soalText = soal.soal;
                        kunciJawaban = soal.kunci;
                    }
                    
                    const jawabanSiswa = item.jawaban || '-';
                    const isBenar = jawabanSiswa === kunciJawaban;
                    
                    allJawaban.push({
                        nomor: nomor,
                        jenis: 'PG',
                        soal: soalText,
                        jawaban: jawabanSiswa,
                        kunci: kunciJawaban,
                        benar: isBenar,
                        nilai: isBenar ? nilaiMaksPG : 0,
                        nilaiMaks: nilaiMaksPG
                    });
                });
            }
            
            // Jawaban Isian & Uraian
            if (jawabanData.koreksiDetail) {
                if (jawabanData.koreksiDetail.isian) {
                    Object.values(jawabanData.koreksiDetail.isian).forEach(item => {
                        const nomor = parseInt(item.nomor);
                        const key = `${examId}_${nomor}`;
                        
                        let soalText = item.soal || '';
                        let kunciJawaban = item.kunciJawaban || '-';
                        
                        if (soalMap.has(key)) {
                            const soal = soalMap.get(key);
                            soalText = soal.soal;
                            kunciJawaban = soal.kunci;
                        }
                        
                        allJawaban.push({
                            nomor: nomor,
                            jenis: 'Isian',
                            soal: soalText,
                            jawaban: item.jawaban || '-',
                            kunci: kunciJawaban,
                            benar: (item.nilai || 0) > 0,
                            nilai: item.nilai || 0,
                            nilaiMaks: nilaiMaksIsian
                        });
                    });
                }
                
                if (jawabanData.koreksiDetail.uraian) {
                    Object.values(jawabanData.koreksiDetail.uraian).forEach(item => {
                        const nomor = parseInt(item.nomor);
                        const key = `${examId}_${nomor}`;
                        
                        let soalText = item.soal || '';
                        let kunciJawaban = item.kunciJawaban || '-';
                        let nilaiMaksimal = item.nilaiMaksimal || 10;
                        
                        if (soalMap.has(key)) {
                            const soal = soalMap.get(key);
                            soalText = soal.soal;
                            kunciJawaban = soal.kunci;
                        }
                        
                        allJawaban.push({
                            nomor: nomor,
                            jenis: 'Uraian',
                            soal: soalText,
                            jawaban: item.jawaban || '-',
                            kunci: kunciJawaban,
                            benar: (item.nilai || 0) > 0,
                            nilai: item.nilai || 0,
                            nilaiMaks: nilaiMaksimal
                        });
                    });
                }
            }
            
            allJawaban.sort((a, b) => a.nomor - b.nomor);
        }
        
        // ============ TABEL JAWABAN ============
        const tableStartY = currentY + 10;
        const tableData = [];
        let urutanNomor = 1;
        
        for (const item of allJawaban) {
            let statusText = '';
            if (item.benar === true) statusText = 'B';
            else if (item.benar === false) statusText = 'S';
            else statusText = '-';
            
            tableData.push([
                urutanNomor++,
                item.jenis,
                item.soal || '',
                item.jawaban || '-',
                item.kunci || '-',
                statusText,
                item.nilai
            ]);
        }
        
        if (tableData.length === 0) {
            tableData.push(['-', '-', 'Belum ada data jawaban', '-', '-', '-', '-']);
        }
        
        doc.autoTable({
            startY: tableStartY,
            head: [['No', 'Jenis', 'Soal', 'Jawaban', 'Kunci', 'B/S', 'Nilai']],
            body: tableData,
            theme: 'grid',
            headStyles: { 
                fillColor: [52, 73, 94],
                textColor: [255, 255, 255], 
                fontStyle: 'bold', 
                halign: 'center', 
                fontSize: 8,
                valign: 'middle'
            },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center', valign: 'middle' },
                1: { cellWidth: 12, halign: 'center', valign: 'middle' },
                2: { cellWidth: 'auto', halign: 'left', valign: 'middle' },
                3: { cellWidth: 25, halign: 'left', valign: 'middle' },
                4: { cellWidth: 15, halign: 'center', valign: 'middle' },
                5: { cellWidth: 8, halign: 'center', valign: 'middle' },
                6: { cellWidth: 10, halign: 'center', valign: 'middle' }
            },
            styles: { 
                fontSize: 7, 
                cellPadding: 2, 
                lineColor: [180, 180, 180], 
                overflow: 'linebreak',
                valign: 'middle'
            },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 10, right: 10 },
            rowHeight: 'auto',
            tableWidth: 'auto'
        });
        
        // ============ KESIMPULAN NILAI ============
        const finalY = doc.lastAutoTable.finalY + 5;
        
        if (jawabanData) {
            const nilaiPG = jawabanData.nilaiPG || 0;
            const nilaiIsian = jawabanData.nilaiIsian || 0;
            const nilaiUraian = jawabanData.nilaiUraian || 0;
            const totalPG = jawabanData.totalPG || 0;
            const totalIsian = jawabanData.totalIsian || 0;
            const totalUraian = jawabanData.totalUraian || 0;
            
            const jumlahDiperoleh = nilaiPG + nilaiIsian + nilaiUraian;
            const jumlahMaksimal = totalPG + totalIsian + totalUraian;
            
            let persentase = 0;
            if (jumlahMaksimal > 0) {
                persentase = Math.round((jumlahDiperoleh / jumlahMaksimal) * 100);
            }
            
            let predikat = '', predikatWarna = '#000';
            if (persentase >= 90) { predikat = 'A (Sangat Baik)'; predikatWarna = '#28a745'; }
            else if (persentase >= 80) { predikat = 'B (Baik)'; predikatWarna = '#17a2b8'; }
            else if (persentase >= 70) { predikat = 'C (Cukup)'; predikatWarna = '#ffc107'; }
            else if (persentase >= 60) { predikat = 'D (Kurang)'; predikatWarna = '#fd7e14'; }
            else { predikat = 'E (Sangat Kurang)'; predikatWarna = '#dc3545'; }
            
            doc.setDrawColor(100, 100, 100);
            doc.setLineWidth(0.3);
            doc.line(15, finalY - 2, 195, finalY - 2);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('KESIMPULAN NILAI:', 15, finalY);
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`Nilai Akhir: ${persentase}`, 15, finalY + 5);
            doc.text(`Persentase: ${persentase}%`, 15, finalY + 10);
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(parseInt(predikatWarna.slice(1,3), 16),
                             parseInt(predikatWarna.slice(3,5), 16),
                             parseInt(predikatWarna.slice(5,7), 16));
            doc.text(`Predikat: ${predikat}`, 15, finalY + 15);
            doc.setTextColor(0, 0, 0);
            
            doc.setFont('helvetica', 'normal');
            doc.text(`Status: ${jawabanData.statusKoreksi === 'selesai' ? 'Sudah Dikoreksi' : 'Menunggu Koreksi'}`, 15, finalY + 20);
            if (jawabanData.statusKoreksi === 'selesai') {
                doc.text(`Dikoreksi oleh: ${jawabanData.dikoreksiOleh || '-'}`, 15, finalY + 25);
            }
            
            // Tanda tangan (hanya di halaman terakhir atau setiap halaman? opsional)
            if (idx === siswaList.length - 1) {
                doc.setFontSize(7);
                doc.text('Mengetahui,', 140, finalY + 5);
                doc.text('Guru Mata Pelajaran', 140, finalY + 10);
                doc.text('_________________________', 140, finalY + 16);
                doc.text(`(${mapel})`, 140, finalY + 21);
                doc.text('Orang Tua/Wali,', 140, finalY + 30);
                doc.text('_________________________', 140, finalY + 36);
            }
        } else {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(128, 128, 128);
            doc.text('* Belum ada data nilai untuk ujian ini *', 105, finalY + 10, { align: 'center' });
        }
    }
    
    // ============ FOOTER (nomor halaman) ============
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(128, 128, 128);
        doc.text(`Halaman ${i} dari ${pageCount}`, 105, 287, { align: 'center' });
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(10, 285, 200, 285);
    }
    
    // Simpan PDF dengan nama file yang mencerminkan kelas dan mapel
    doc.save(`Lembar_Jawaban_Kelas_${kelas}_${mapel}_${new Date().toISOString().slice(0,10)}.pdf`);
}


function showToast(message, type = 'success') {
    const toastContainer = getElement('toastContainer');
    if (!toastContainer) {
        if (type === 'error') alert(message);
        else console.log(message);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Inisialisasi
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => loadPdfSetting(), 500);
});

// Export
if (typeof window !== 'undefined') {
    window.handleLogoUpload = handleLogoUpload;
    window.loadPdfSetting = loadPdfSetting;
    window.resetPdfSetting = resetPdfSetting;
    window.generateLembarJawaban = generateLembarJawaban;
    window.downloadLaporanKelas = downloadLaporanKelas;
}


// ============ FUNGSI SIMPAN SETTING KE LOCALSTORAGE ============
function savePdfSettingToLocal() {
    const setting = {
        sekolahNama: getElement('sekolahNama')?.value || '',
        sekolahAlamat: getElement('sekolahAlamat')?.value || '',
        sekolahKota: getElement('sekolahKota')?.value || '',
        sekolahTelp: getElement('sekolahTelp')?.value || '',
        sekolahEmail: getElement('sekolahEmail')?.value || '',
        sekolahMotto: getElement('sekolahMotto')?.value || '',
        headerWarna: getElement('headerWarna')?.value || '#2c3e50',
        logoWidth: getElement('logoWidth')?.value || 40,
        logoHeight: getElement('logoHeight')?.value || 40,
        logoKiriData: getElement('logoKiriData')?.value || '',
        logoKananData: getElement('logoKananData')?.value || '',
        updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem(PDF_SETTING_KEY, JSON.stringify(setting));
    console.log('✅ Setting PDF disimpan ke localStorage');
    return setting;
}
