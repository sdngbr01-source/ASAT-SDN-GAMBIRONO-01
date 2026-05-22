// management-nilai.js

async function loadNilai() {
    const kelas = document.getElementById('filterKelasNilai')?.value;
    const mapel = document.getElementById('filterMapelNilai')?.value;
    const search = document.getElementById('searchSiswa')?.value.toLowerCase() || '';
    const tbody = document.getElementById('nilaiTableBody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Loading...</td></tr>';
    
    try {
        if (typeof answersRef === 'undefined') {
            console.error('answersRef tidak terdefinisi');
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: red;">Error: answersRef tidak terdefinisi</td></tr>';
            return;
        }
        
        let query = answersRef;
        
        if (kelas) query = query.where('kelas', '==', kelas);
        if (mapel) query = query.where('mataPelajaran', '==', mapel);
        
        const snapshot = await query.orderBy('waktu', 'desc').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center">Tidak ada data</td></tr>';
            return;
        }
        
        const nilaiMap = new Map();
        
        snapshot.forEach(doc => {
            const nilai = doc.data();
            const key = nilai.siswaId + '_' + nilai.mataPelajaran;
            
            if (!nilaiMap.has(key) || (nilai.waktu && nilai.waktu.toDate && nilai.waktu.toDate() > nilaiMap.get(key).waktu.toDate())) {
                nilaiMap.set(key, { id: doc.id, ...nilai });
            }
        });
        
        const filteredData = Array.from(nilaiMap.values()).filter(nilai => {
            if (search) return (nilai.siswaNama || '').toLowerCase().includes(search);
            return true;
        });
        
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center">Tidak ada data sesuai filter</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        let no = 1;
        
        for (const nilai of filteredData) {
            // Ambil nilai dari berbagai sumber
            let nilaiPG = 0;
            let nilaiIsian = 0;
            let nilaiUraian = 0;
            let totalPG = nilai.totalPG || 0;
            let totalIsian = 0;
            let totalUraian = 0;
            
            // Cek dari koreksiDetail terlebih dahulu (sumber paling akurat)
            if (nilai.koreksiDetail) {
                // Hitung nilai isian dari koreksiDetail
                if (nilai.koreksiDetail.isian) {
                    for (const [qId, detail] of Object.entries(nilai.koreksiDetail.isian)) {
                        nilaiIsian += detail.nilai || 0;
                        totalIsian += detail.nilaiMaksimal || 5;
                    }
                }
                
                // Hitung nilai uraian dari koreksiDetail
                if (nilai.koreksiDetail.uraian) {
                    for (const [qId, detail] of Object.entries(nilai.koreksiDetail.uraian)) {
                        nilaiUraian += detail.nilai || 0;
                        totalUraian += detail.nilaiMaksimal || 10;
                    }
                }
            }
            
            // Jika tidak ada koreksiDetail, gunakan field langsung
            if (nilaiIsian === 0 && nilai.nilaiIsian !== undefined) {
                nilaiIsian = nilai.nilaiIsian || 0;
            }
            if (nilaiUraian === 0 && nilai.nilaiUraian !== undefined) {
                nilaiUraian = nilai.nilaiUraian || 0;
            }
            
            // Jika masih 0, coba hitung dari jawabanIsian dan jawabanUraian
            if (nilaiIsian === 0 && nilai.jawabanIsian) {
                for (const [qId, data] of Object.entries(nilai.jawabanIsian)) {
                    if (data.nilai !== undefined) {
                        nilaiIsian += data.nilai || 0;
                    }
                    totalIsian += data.nilaiMaksimal || 5;
                }
            }
            
            if (nilaiUraian === 0 && nilai.jawabanUraian) {
                for (const [qId, data] of Object.entries(nilai.jawabanUraian)) {
                    if (data.nilai !== undefined) {
                        nilaiUraian += data.nilai || 0;
                    }
                    totalUraian += data.nilaiMaksimal || 10;
                }
            }
            
            // Ambil nilai PG
            nilaiPG = nilai.nilaiPG || 0;
            
            // Jika total masih 0, gunakan dari examData atau default
            if (totalIsian === 0 && nilai.jawabanIsian) {
                totalIsian = Object.keys(nilai.jawabanIsian).length * 5;
            }
            if (totalUraian === 0 && nilai.jawabanUraian) {
                totalUraian = Object.keys(nilai.jawabanUraian).length * 10;
            }
            
            // ========== PERBAIKAN RUMUS PERHITUNGAN NILAI ==========
            const jumlahNilaiDiperoleh = nilaiPG + nilaiIsian + nilaiUraian;
            const jumlahNilaiMaksimal = totalPG + totalIsian + totalUraian;
            
            let nilaiAkhir = 0;
            if (nilai.statusKoreksi === 'pending') {
                nilaiAkhir = 0;
            } else {
                if (jumlahNilaiMaksimal > 0) {
                    nilaiAkhir = (jumlahNilaiDiperoleh / jumlahNilaiMaksimal) * 100;
                    nilaiAkhir = Math.round(nilaiAkhir);
                }
            }
            
            let statusText = '';
            let statusClass = '';
            
            if (nilai.statusKoreksi === 'pending') {
                statusText = 'Menunggu Koreksi';
                statusClass = 'status-pending';
            } else {
                statusText = 'Selesai';
                statusClass = 'status-selesai';
            }
            
            const row = tbody.insertRow();
            row.insertCell(0).textContent = no++;
            row.insertCell(1).textContent = nilai.siswaNama || '-';
            row.insertCell(2).textContent = nilai.kelas || '-';
            row.insertCell(3).textContent = nilai.mataPelajaran || '-';
            
            // Tampilkan hanya angka (tanpa /total)
            row.insertCell(4).textContent = nilaiPG;
            row.insertCell(5).textContent = nilaiIsian;
            row.insertCell(6).textContent = nilaiUraian;
            row.insertCell(7).innerHTML = '<strong>' + nilaiAkhir + '</strong>';
            row.insertCell(8).innerHTML = '<span class="exam-status ' + statusClass + '">' + statusText + '</span>';
            
            // ========== KOLOM AKSI (Batalkan Koreksi) ==========
            const actionCell = row.insertCell(9);
            
            // Tombol Batalkan Koreksi untuk data yang sudah selesai dikoreksi
            if (nilai.statusKoreksi === 'selesai') {
                actionCell.innerHTML = `
                    <button class="btn-batal-koreksi" 
                            onclick="batalKoreksi('${nilai.id}', '${escapeHtml(nilai.siswaNama)}', '${escapeHtml(nilai.mataPelajaran)}')" 
                            title="Batalkan Koreksi">
                        🔄 Batalkan Koreksi
                    </button>
                `;
            } else {
                // Untuk data yang masih pending, tampilkan teks saja
                actionCell.innerHTML = '<span style="color: #999; font-size: 12px;">Menunggu Koreksi</span>';
            }
        }
        
    } catch (error) {
        console.error('Error loading nilai:', error);
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: red;">Error: ' + error.message + '</td></tr>';
    }
}

// ========== FUNGSI BATALKAN KOREKSI (TIDAK MENGHAPUS JAWABAN) ==========
async function batalKoreksi(docId, siswaNama, mataPelajaran) {
    // Konfirmasi pembatalan
    const confirmed = confirm(`⚠️ BATALKAN KOREKSI\n\nApakah Anda yakin ingin membatalkan koreksi untuk:\n\n📌 Siswa: ${siswaNama}\n📖 Mapel: ${mataPelajaran}\n\n⚠️ PERINGATAN: Hanya nilai koreksi yang akan dihapus, JAWABAN SISWA TETAP ADA.\n\nData akan kembali ke status "Menunggu Koreksi" dan muncul di halaman Koreksi Essay.`);
    
    if (!confirmed) return;
    
    try {
        if (typeof answersRef === 'undefined') {
            throw new Error('answersRef tidak terdefinisi');
        }
        
        // HANYA HAPUS DATA KOREKSI, JANGAN HAPUS JAWABAN SISWA!
        await answersRef.doc(docId).update({
            statusKoreksi: 'pending',
            dikoreksiOleh: null,
            waktuKoreksi: null,
            koreksiDetail: firebase.firestore.FieldValue.delete(), // Hanya hapus koreksiDetail
            nilaiIsian: 0,
            nilaiUraian: 0,
            nilaiAkhir: 0
            // ⚠️ TIDAK menghapus jawabanIsian dan jawabanUraian!
        });
        
        console.log(`✅ Berhasil batalkan koreksi: ${docId}`);
        alert(`✅ Berhasil membatalkan koreksi ${siswaNama} - ${mataPelajaran}\n\nJawaban siswa tetap tersimpan.`);
        
        // Reload tabel nilai
        await loadNilai();
        
        // Refresh halaman koreksi jika sedang aktif
        const koreksiTab = document.getElementById('tab-koreksi');
        if (koreksiTab && koreksiTab.classList.contains('active')) {
            if (typeof loadSiswaForKoreksi === 'function') await loadSiswaForKoreksi();
            if (typeof loadJawabanKoreksi === 'function') await loadJawabanKoreksi();
        }
        
    } catch (error) {
        console.error('Error membatalkan koreksi:', error);
        alert('❌ Gagal membatalkan koreksi: ' + error.message);
    }
}

// ========== FUNGSI HELPER ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== TAMBAHKAN CSS (CEK APAKAH SUDAH ADA) ==========
if (!document.getElementById('management-nilai-style')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'management-nilai-style';
    styleTag.textContent = `
        /* Tombol Batalkan Koreksi */
        .btn-batal-koreksi {
            background: #ffc107;
            color: #333;
            border: none;
            padding: 6px 12px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.3s ease;
            white-space: nowrap;
        }
        
        .btn-batal-koreksi:hover {
            background: #e0a800;
            transform: scale(1.02);
        }
        
        .btn-batal-koreksi:active {
            transform: scale(0.98);
        }
        
        /* Status Badge */
        .status-pending {
            background: #ffc107;
            color: #333;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            display: inline-block;
        }
        
        .status-selesai {
            background: #28a745;
            color: white;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            display: inline-block;
        }
    `;
    document.head.appendChild(styleTag);
}
