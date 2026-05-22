// ==================== DOWNLOAD LAPORAN EXCEL ====================

// laporan-nilai.js
// Download laporan per kelas (Excel)

async function downloadLaporanKelas() {
    const kelas = document.getElementById('laporanKelas').value;
    const mapel = document.getElementById('laporanMapel').value;
    
    if (!kelas || !mapel) {
        alert('Pilih kelas dan mata pelajaran!');
        return;
    }
    
    try {
        // Ambil data jawaban
        const snapshot = await answersRef
            .where('kelas', '==', kelas)
            .where('mataPelajaran', '==', mapel)
            .get();
        
        if (snapshot.empty) {
            alert('Tidak ada data untuk kelas dan mapel ini');
            return;
        }
        
        // Group by siswa (ambil data terbaru)
        const nilaiMap = new Map();
        snapshot.forEach(doc => {
            const nilai = doc.data();
            const key = nilai.siswaId;
            
            if (!nilaiMap.has(key) || (nilai.waktu && nilai.waktu.toDate && nilai.waktu.toDate() > nilaiMap.get(key).waktu.toDate())) {
                nilaiMap.set(key, nilai);
            }
        });
        
        // Siapkan data untuk Excel
        const excelData = [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Mata Pelajaran', 'Nilai PG', 'Nilai Isian', 'Nilai Uraian', 'Total Nilai', 'Status']];
        let no = 1;
        
        for (const [siswaId, nilai] of nilaiMap) {
            // Ambil nilai per tipe
            let nilaiPG = nilai.nilaiPG || 0;
            let nilaiIsian = nilai.nilaiIsian || 0;
            let nilaiUraian = nilai.nilaiUraian || 0;
            
            // Ambil total maksimal dari data
            let totalPG = nilai.totalPG || 0;
            let totalIsian = nilai.totalIsian || 0;
            let totalUraian = nilai.totalUraian || 0;
            
            // Jika total maksimal masih 0, hitung dari jumlah soal
            if (totalPG === 0 && nilai.jumlahSoal) {
                const jmlPG = nilai.jumlahSoal.pg || 0;
                const jmlIsian = nilai.jumlahSoal.isian || 0;
                const jmlUraian = nilai.jumlahSoal.uraian || 0;
                
                // Cari nilai per soal dari data ujian
                try {
                    const examDoc = await examsRef.doc(nilai.examId).get();
                    if (examDoc.exists) {
                        const examData = examDoc.data();
                        const nilaiPerSoalPG = examData.nilaiPerSoal?.pg || 5;
                        const nilaiPerSoalIsian = examData.nilaiPerSoal?.isian || 5;
                        const nilaiPerSoalUraian = examData.nilaiPerSoal?.uraian || 5;
                        
                        totalPG = jmlPG * nilaiPerSoalPG;
                        totalIsian = jmlIsian * nilaiPerSoalIsian;
                        totalUraian = jmlUraian * nilaiPerSoalUraian;
                    } else {
                        // Default jika tidak ada data exam
                        totalPG = jmlPG * 5;
                        totalIsian = jmlIsian * 5;
                        totalUraian = jmlUraian * 5;
                    }
                } catch (e) {
                    console.warn('Gagal ambil data exam:', e);
                    totalPG = jmlPG * 5;
                    totalIsian = jmlIsian * 5;
                    totalUraian = jmlUraian * 5;
                }
            }
            
            // Hitung jumlah nilai diperoleh
            const jumlahDiperoleh = nilaiPG + nilaiIsian + nilaiUraian;
            
            // Hitung jumlah nilai maksimal
            const jumlahMaksimal = totalPG + totalIsian + totalUraian;
            
            // HITUNG TOTAL NILAI AKHIR (0-100)
            let totalNilai = 0;
            if (jumlahMaksimal > 0) {
                totalNilai = (jumlahDiperoleh / jumlahMaksimal) * 100;
                totalNilai = Math.round(totalNilai);
            }
            
            let statusText = '';
            if (nilai.statusKoreksi === 'pending') {
                statusText = 'Menunggu Koreksi';
            } else {
                statusText = 'Selesai';
            }
            
            excelData.push([
                no++,
                nilai.nis || '-',
                nilai.siswaNama || '-',
                nilai.kelas || '-',
                nilai.mataPelajaran || '-',
                nilaiPG,
                nilaiIsian,
                nilaiUraian,
                totalNilai,  // Tampilkan nilai 0-100
                statusText
            ]);
        }
        
        // Buat Excel file
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Atur lebar kolom
        ws['!cols'] = [
            { wch: 5 },   // No
            { wch: 12 },  // NIS
            { wch: 25 },  // Nama Siswa
            { wch: 10 },  // Kelas
            { wch: 20 },  // Mata Pelajaran
            { wch: 12 },  // Nilai PG
            { wch: 12 },  // Nilai Isian
            { wch: 12 },  // Nilai Uraian
            { wch: 12 },  // Total Nilai
            { wch: 18 }   // Status
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Laporan Nilai');
        XLSX.writeFile(wb, `Laporan_Nilai_${kelas}_${mapel}_${new Date().toISOString().slice(0,10)}.xlsx`);
        
        alert('Laporan berhasil didownload!\nTotal data: ' + (no-1) + ' siswa');
        
    } catch (error) {
        console.error('Error downloading laporan:', error);
        alert('Gagal mendownload laporan: ' + error.message);
    }
}

async function generatePDFSiswa(siswa, jawaban, mapel) {
    return new Promise(async (resolve, reject) => {
        try {
            const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
            if (!JsPDF) {
                reject(new Error('jsPDF library not loaded'));
                return;
            }
            
            const headerSetting = getPdfSetting();
            const doc = new JsPDF();
            let yPos = 15;
            
            // Header dengan logo
            if (headerSetting.logoKiriUrl) {
                try {
                    doc.addImage(headerSetting.logoKiriUrl, 'JPEG', 15, yPos, 25, 25);
                } catch (e) {}
            }
            
            if (headerSetting.logoKananUrl) {
                try {
                    doc.addImage(headerSetting.logoKananUrl, 'JPEG', 170, yPos, 25, 25);
                } catch (e) {}
            }
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(headerSetting.headerWarna || '#2c3e50');
            
            const namaSekolahLines = (headerSetting.sekolahNama || '').split('\n');
            let currentY = yPos + 8;
            for (const line of namaSekolahLines) {
                if (line.trim()) {
                    doc.text(line.trim(), 105, currentY, { align: 'center' });
                    currentY += 5;
                }
            }
            
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            const alamatLines = (headerSetting.sekolahAlamat || '').split('\n');
            for (const line of alamatLines) {
                if (line.trim()) {
                    doc.text(line.trim(), 105, currentY, { align: 'center' });
                    currentY += 4;
                }
            }
            
            doc.text('Telp: ' + (headerSetting.sekolahTelp || '-') + ' | Email: ' + (headerSetting.sekolahEmail || '-'), 105, currentY, { align: 'center' });
            currentY += 4;
            doc.text(headerSetting.sekolahKota || '', 105, currentY, { align: 'center' });
            currentY += 5;
            
            doc.setFontSize(7);
            doc.setFont(undefined, 'italic');
            const mottoLines = (headerSetting.sekolahMotto || '').split('\n');
            for (const line of mottoLines) {
                if (line.trim()) {
                    doc.text(line.trim(), 105, currentY, { align: 'center' });
                    currentY += 4;
                }
            }
            
            doc.setDrawColor(200, 200, 200);
            doc.line(15, currentY + 3, 195, currentY + 3);
            
            yPos = currentY + 12;
            
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('LEMBAR JAWABAN SISWA', 105, yPos, { align: 'center' });
            yPos += 12;
            
            // Info Siswa
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text('Nama          : ' + (siswa.nama || '-'), 20, yPos);
            yPos += 6;
            doc.text('Kelas         : ' + (siswa.kelas || '-'), 20, yPos);
            yPos += 6;
            doc.text('NIS           : ' + (siswa.nis || '-'), 20, yPos);
            yPos += 6;
            doc.text('Mata Pelajaran: ' + mapel, 20, yPos);
            yPos += 6;
            doc.text('Tanggal       : ' + new Date().toLocaleDateString('id-ID'), 20, yPos);
            yPos += 15;
            
            // Hitung ulang total nilai
            const nilaiPG = jawaban.nilaiPG || 0;
            const nilaiIsian = jawaban.nilaiIsian || 0;
            const nilaiUraian = jawaban.nilaiUraian || 0;
            const totalPG = jawaban.totalPG || 0;
            const totalIsian = jawaban.totalIsian || 0;
            const totalUraian = jawaban.totalUraian || 0;
            const total = nilaiPG + nilaiIsian + nilaiUraian;
            const totalMaks = totalPG + totalIsian + totalUraian;
            
            let nilaiAkhir = 0;
            if (totalMaks > 0) {
                nilaiAkhir = (total / totalMaks) * 100;
                nilaiAkhir = Math.round(nilaiAkhir);
            }
            
            // Ringkasan Nilai
            doc.setFont(undefined, 'bold');
            doc.text('RINGKASAN NILAI:', 20, yPos);
            yPos += 8;
            
            doc.setFont(undefined, 'normal');
            doc.text('   Pilihan Ganda : ' + nilaiPG, 20, yPos);
            yPos += 6;
            doc.text('   Isian         : ' + nilaiIsian, 20, yPos);
            yPos += 6;
            doc.text('   Uraian        : ' + nilaiUraian, 20, yPos);
            yPos += 8;
            
            doc.setFont(undefined, 'bold');
            doc.text('   TOTAL NILAI   : ' + nilaiAkhir, 20, yPos);
            yPos += 20;
            
            // Detail Jawaban
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('DETAIL JAWABAN:', 20, yPos);
            yPos += 10;
            
            const questionsSnapshot = await firebase.firestore()
                .collection('questions')
                .where('examId', '==', jawaban.examId)
                .get();
            
            const questions = [];
            questionsSnapshot.forEach(doc => {
                questions.push({ id: doc.id, ...doc.data() });
            });
            questions.sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
            
            const jawabanPG = jawaban.jawabanPG || {};
            const jawabanIsian = jawaban.jawabanIsian || {};
            const jawabanUraian = jawaban.jawabanUraian || {};
            
            let noSoal = 1;
            for (const question of questions) {
                if (yPos > 260) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0, 0, 0);
                
                let jenisSoal = '';
                if (question.tipe === 'pg') jenisSoal = 'PILIHAN GANDA';
                else if (question.tipe === 'isian') jenisSoal = 'ISIAN SINGKAT';
                else if (question.tipe === 'uraian') jenisSoal = 'URAIAN';
                
                doc.text(noSoal++ + '. [' + jenisSoal + ']', 20, yPos);
                yPos += 6;
                
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                const soalSplit = doc.splitTextToSize(question.soal || '', 170);
                doc.text(soalSplit, 25, yPos);
                yPos += soalSplit.length * 5 + 3;
                
                if (question.tipe === 'pg') {
                    const jawabanBenar = question.kunci;
                    const jawabanData = jawabanPG[question.id];
                    const jawabanSiswa = jawabanData?.jawaban || '';
                    const isCorrect = jawabanSiswa && jawabanSiswa.toUpperCase() === String(jawabanBenar).toUpperCase();
                    
                    doc.setTextColor(0, 0, 0);
                    doc.text('   Jawaban : ' + (jawabanSiswa || '(tidak dijawab)'), 25, yPos);
                    yPos += 5;
                    
                    if (isCorrect) {
                        doc.setTextColor(0, 128, 0);
                        doc.text('   Status  : BENAR', 25, yPos);
                    } else {
                        doc.setTextColor(255, 0, 0);
                        doc.text('   Status  : SALAH', 25, yPos);
                        yPos += 5;
                        doc.setTextColor(0, 128, 0);
                        doc.text('   Seharusnya : ' + jawabanBenar, 25, yPos);
                    }
                    doc.setTextColor(0, 0, 0);
                    yPos += 8;
                    
                } else if (question.tipe === 'isian') {
                    const jawabanBenar = question.kunci;
                    const jawabanData = jawabanIsian[question.id];
                    const jawabanSiswa = jawabanData?.jawaban || '';
                    const isCorrect = jawabanSiswa && jawabanSiswa.toLowerCase().trim() === String(jawabanBenar).toLowerCase().trim();
                    
                    doc.setTextColor(0, 0, 0);
                    doc.text('   Jawaban : ' + (jawabanSiswa || '(tidak dijawab)'), 25, yPos);
                    yPos += 5;
                    
                    if (isCorrect) {
                        doc.setTextColor(0, 128, 0);
                        doc.text('   Status  : BENAR', 25, yPos);
                    } else {
                        doc.setTextColor(255, 0, 0);
                        doc.text('   Status  : SALAH', 25, yPos);
                        yPos += 5;
                        doc.setTextColor(0, 128, 0);
                        doc.text('   Seharusnya : ' + jawabanBenar, 25, yPos);
                    }
                    doc.setTextColor(0, 0, 0);
                    yPos += 8;
                    
                } else if (question.tipe === 'uraian') {
                    const jawabanData = jawabanUraian[question.id];
                    const jawabanSiswa = jawabanData?.jawaban || '';
                    const nilaiMaksimal = jawabanData?.nilaiMaksimal || 0;
                    
                    let nilai = 0;
                    if (jawaban.koreksiDetail && jawaban.koreksiDetail[question.id]) {
                        nilai = jawaban.koreksiDetail[question.id].nilai || 0;
                    }
                    
                    doc.setTextColor(0, 0, 0);
                    doc.text('   Jawaban :', 25, yPos);
                    yPos += 5;
                    
                    const jawabanSplit = doc.splitTextToSize(jawabanSiswa || '(tidak dijawab)', 165);
                    doc.text(jawabanSplit, 30, yPos);
                    yPos += jawabanSplit.length * 5 + 3;
                    
                    if (nilai === nilaiMaksimal) {
                        doc.setTextColor(0, 128, 0);
                    } else if (nilai > 0) {
                        doc.setTextColor(255, 165, 0);
                    } else {
                        doc.setTextColor(255, 0, 0);
                    }
                    doc.text('   Nilai : ' + nilai, 25, yPos);  // Hanya tampilkan nilai perolehan
                    doc.setTextColor(0, 0, 0);
                    yPos += 8;
                    
                    if (nilai < nilaiMaksimal && jawaban.koreksiDetail && jawaban.koreksiDetail[question.id]?.catatan) {
                        doc.setTextColor(100, 100, 100);
                        doc.text('   Catatan : ' + jawaban.koreksiDetail[question.id].catatan, 25, yPos);
                        doc.setTextColor(0, 0, 0);
                        yPos += 6;
                    }
                    
                    if (question.kunci && question.kunci.trim() !== '') {
                        doc.setTextColor(0, 128, 0);
                        doc.text('   Kunci Jawaban : ' + question.kunci, 25, yPos);
                        doc.setTextColor(0, 0, 0);
                        yPos += 6;
                    }
                    yPos += 5;
                }
                yPos += 5;
            }
            
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.setFont(undefined, 'italic');
            doc.text('Dicetak pada: ' + new Date().toLocaleString('id-ID'), 105, 285, { align: 'center' });
            
            doc.save('Lembar_Jawaban_' + (siswa.nama || 'siswa') + '_' + mapel + '.pdf');
            resolve();
            
        } catch (error) {
            console.error('Error in generatePDFSiswa:', error);
            reject(error);
        }
    });
}
