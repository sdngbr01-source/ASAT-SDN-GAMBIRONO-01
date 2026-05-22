// dashboard-siswa.js - VERSI EXAM BRO (Silent Save, tanpa notifikasi)

// Ambil data user dari sessionStorage
const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
let currentExam = null;
let currentQuestions = [];
let currentAnswers = {};
let currentQuestionIndex = 0;
let timerInterval = null;
let currentAnswerDocId = null;

// Counter untuk tracking jumlah jawaban yang berubah
let answersChangedCount = 0;
let isSaving = false;
let pendingSaveTimeout = null;

// Cek login
if (!currentUser || currentUser.role !== 'siswa') {
    window.location.href = 'index.html';
}

// Tampilkan nama user
document.addEventListener('DOMContentLoaded', function() {
    const userNameEl = document.getElementById('userName');
    const kelasSiswaEl = document.getElementById('kelasSiswa');
    
    if (userNameEl) userNameEl.textContent = currentUser.nama || 'Siswa';
    if (kelasSiswaEl) kelasSiswaEl.textContent = currentUser.kelas || '-';
    
    loadSubjects();
});

// Load mata pelajaran yang tersedia
async function loadSubjects() {
    const subjectList = document.getElementById('subjectList');
    if (!subjectList) return;
    
    subjectList.innerHTML = '<div class="loading-spinner">📚 Loading ujian...</div>';
    
    try {
        const examsSnapshot = await examsRef
            .where('kelas', '==', currentUser.kelas)
            .where('aktif', '==', true)
            .get();
        
        subjectList.innerHTML = '';
        
        if (examsSnapshot.empty) {
            subjectList.innerHTML = '<div class="empty-state">📭 Tidak ada ujian tersedia</div>';
            return;
        }
        
        for (const doc of examsSnapshot.docs) {
            const exam = doc.data();
            const totalSoal = (exam.jumlahSoal?.pg || 0) + (exam.jumlahSoal?.isian || 0) + (exam.jumlahSoal?.uraian || 0);
            
            const existingAnswer = await answersRef
                .where('examId', '==', doc.id)
                .where('siswaId', '==', currentUser.id)
                .limit(1)
                .get();
            
            let statusHtml = '';
            let onclickHandler = `startExam('${doc.id}', '${exam.mataPelajaran || 'Ujian'}')`;
            let cardClass = 'card';
            
            if (!existingAnswer.empty) {
                const answerData = existingAnswer.docs[0].data();
                if (answerData.statusKoreksi === 'selesai') {
                    statusHtml = '<span class="badge badge-success">✓ Selesai</span>';
                    cardClass = 'card completed';
                    onclickHandler = `alert('Anda sudah menyelesaikan ujian ini! Nilai: ${answerData.nilaiSementara || 0}')`;
                } else if (answerData.statusKoreksi === 'in_progress' || answerData.progressStatus === 'in_progress') {
                    statusHtml = '<span class="badge badge-warning">⏳ Lanjutkan</span>';
                    onclickHandler = `resumeExam('${doc.id}', '${exam.mataPelajaran || 'Ujian'}', '${existingAnswer.docs[0].id}')`;
                }
            }
            
            subjectList.innerHTML += `
                <div class="${cardClass}" onclick="${onclickHandler}">
                    <div class="card-icon">📚</div>
                    <h3>${escapeHtml(exam.mataPelajaran || 'Mata Pelajaran')}</h3>
                    <p>${totalSoal} Soal</p>
                    <p>⏱️ ${exam.durasi || 60} menit</p>
                    ${statusHtml}
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading subjects:', error);
        subjectList.innerHTML = '<div class="error-state">❌ Gagal memuat data. Coba lagi nanti.</div>';
    }
}

// ==================== FUNGSI SAVE PROGRESS (SILENT, SETIAP 5 JAWABAN) ====================

async function saveProgressToFirestore(isFinalSubmit = false) {
    if (isSaving) return;
    if (!currentExam || currentQuestions.length === 0) return;
    
    isSaving = true;
    
    try {
        const nilaiPerSoal = currentExam.nilaiPerSoal || { pg: 5, isian: 5, uraian: 5 };
        let nilaiPG = 0, nilaiIsian = 0;
        let jmlPG = 0, jmlIsian = 0, jmlUraian = 0;
        const jawabanPG = {};
        const jawabanIsian = {};
        const jawabanUraian = {};
        
        for (const question of currentQuestions) {
            const jawabanSiswa = currentAnswers[question.id];
            const kunci = question.kunci;
            const tipe = question.tipe;
            
            if (tipe === 'pg') {
                jmlPG++;
                jawabanPG[question.id] = {
                    jawaban: jawabanSiswa || '',
                    kunci: kunci || '',
                    nomor: question.nomor || jmlPG,
                    soal: question.soal || '',
                    pilihan: question.pilihan || []
                };
                if (jawabanSiswa && kunci && 
                    String(jawabanSiswa).trim().toUpperCase() === String(kunci).trim().toUpperCase()) {
                    nilaiPG += nilaiPerSoal.pg;
                }
            } 
            else if (tipe === 'isian') {
                jmlIsian++;
                jawabanIsian[question.id] = {
                    jawaban: jawabanSiswa || '',
                    kunci: kunci || '',
                    nomor: question.nomor || jmlIsian,
                    soal: question.soal || ''
                };
                if (jawabanSiswa && kunci && 
                    String(jawabanSiswa).toLowerCase().trim() === String(kunci).toLowerCase().trim()) {
                    nilaiIsian += nilaiPerSoal.isian;
                }
            }
            else if (tipe === 'uraian') {
                jmlUraian++;
                jawabanUraian[question.id] = {
                    jawaban: jawabanSiswa || '',
                    soal: question.soal || '',
                    nilaiMaksimal: nilaiPerSoal.uraian,
                    nilaiDiperoleh: 0,
                    nomor: question.nomor || jmlUraian
                };
            }
        }
        
        const totalPG = jmlPG * nilaiPerSoal.pg;
        const totalIsian = jmlIsian * nilaiPerSoal.isian;
        const totalUraian = jmlUraian * nilaiPerSoal.uraian;
        const totalMaksimal = totalPG + totalIsian + totalUraian;
        let nilaiSementara = 0;
        if (totalMaksimal > 0) {
            nilaiSementara = Math.round(((nilaiPG + nilaiIsian) / totalMaksimal) * 100);
        }
        
        const progressData = {
            examId: currentExam.id,
            siswaId: currentUser.id,
            siswaNama: currentUser.nama,
            nis: currentUser.nis || '',
            kelas: currentUser.kelas,
            mataPelajaran: currentExam.mataPelajaran,
            jawabanPG: jawabanPG,
            jawabanIsian: jawabanIsian,
            jawabanUraian: jawabanUraian,
            nilaiPG: nilaiPG,
            nilaiIsian: nilaiIsian,
            nilaiUraian: 0,
            totalPG: totalPG,
            totalIsian: totalIsian,
            totalUraian: totalUraian,
            jumlahSoal: { pg: jmlPG, isian: jmlIsian, uraian: jmlUraian },
            nilaiSementara: nilaiSementara,
            progressStatus: isFinalSubmit ? 'completed' : 'in_progress',
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (isFinalSubmit) {
            progressData.statusKoreksi = jmlUraian > 0 ? 'pending' : 'selesai';
            if (jmlUraian === 0) {
                progressData.nilaiAkhir = nilaiSementara;
            }
            progressData.waktuSubmit = firebase.firestore.FieldValue.serverTimestamp();
        } else {
            progressData.statusKoreksi = 'in_progress';
        }
        
        if (currentAnswerDocId) {
            await answersRef.doc(currentAnswerDocId).update(progressData);
        } else {
            const newDoc = await answersRef.add(progressData);
            currentAnswerDocId = newDoc.id;
        }
        
        if (!isFinalSubmit) {
            answersChangedCount = 0;
        }
        
    } catch (error) {
        console.error('Error saving progress:', error);
    } finally {
        isSaving = false;
    }
}

function trackAnswerChange() {
    answersChangedCount++;
    
    if (pendingSaveTimeout) clearTimeout(pendingSaveTimeout);
    
    // Save setiap 5 jawaban berubah
    if (answersChangedCount >= 5) {
        saveProgressToFirestore(false);
    } else {
        // Backup save setelah 15 detik tidak ada aktivitas
        pendingSaveTimeout = setTimeout(() => {
            if (answersChangedCount > 0) {
                saveProgressToFirestore(false);
            }
        }, 15000);
    }
}

// ==================== FUNGSI UJIAN ====================

async function resumeExam(examId, subjectName, answerDocId) {
    try {
        showLoadingOverlay(true);
        
        const answerDoc = await answersRef.doc(answerDocId).get();
        const existingAnswer = answerDoc.data();
        
        if (!existingAnswer) {
            alert('Data jawaban tidak ditemukan');
            showLoadingOverlay(false);
            return;
        }
        
        const examDoc = await examsRef.doc(examId).get();
        if (!examDoc.exists) {
            alert('Ujian tidak ditemukan');
            showLoadingOverlay(false);
            return;
        }
        
        currentExam = { id: examId, ...examDoc.data() };
        currentAnswerDocId = answerDocId;
        
        const questionsSnapshot = await questionsRef
            .where('kelas', '==', currentExam.kelas)
            .where('mataPelajaran', '==', currentExam.mataPelajaran)
            .get();
        
        let allQuestions = questionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
        
        const examJumlahSoal = currentExam.jumlahSoal || {};
        currentQuestions = [
            ...allQuestions.filter(q => q.tipe === 'pg').slice(0, examJumlahSoal.pg || 999),
            ...allQuestions.filter(q => q.tipe === 'isian').slice(0, examJumlahSoal.isian || 999),
            ...allQuestions.filter(q => q.tipe === 'uraian').slice(0, examJumlahSoal.uraian || 999)
        ];
        
        const nilaiPerSoal = currentExam.nilaiPerSoal || { pg: 5, isian: 5, uraian: 5 };
        currentQuestions = currentQuestions.map(q => {
            if (!q.nilai) {
                if (q.tipe === 'pg') q.nilai = nilaiPerSoal.pg;
                else if (q.tipe === 'isian') q.nilai = nilaiPerSoal.isian;
                else if (q.tipe === 'uraian') q.nilai = nilaiPerSoal.uraian;
            }
            return q;
        });
        
        currentAnswers = {};
        
        if (existingAnswer.jawabanPG) {
            Object.keys(existingAnswer.jawabanPG).forEach(qId => {
                if (existingAnswer.jawabanPG[qId]?.jawaban) {
                    currentAnswers[qId] = existingAnswer.jawabanPG[qId].jawaban;
                }
            });
        }
        if (existingAnswer.jawabanIsian) {
            Object.keys(existingAnswer.jawabanIsian).forEach(qId => {
                if (existingAnswer.jawabanIsian[qId]?.jawaban) {
                    currentAnswers[qId] = existingAnswer.jawabanIsian[qId].jawaban;
                }
            });
        }
        if (existingAnswer.jawabanUraian) {
            Object.keys(existingAnswer.jawabanUraian).forEach(qId => {
                if (existingAnswer.jawabanUraian[qId]?.jawaban) {
                    currentAnswers[qId] = existingAnswer.jawabanUraian[qId].jawaban;
                }
            });
        }
        
        answersChangedCount = 0;
        
        currentQuestionIndex = 0;
        for (let i = 0; i < currentQuestions.length; i++) {
            const q = currentQuestions[i];
            if (!currentAnswers[q.id] || currentAnswers[q.id] === '') {
                currentQuestionIndex = i;
                break;
            }
        }
        
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('examPage').style.display = 'block';
        document.getElementById('examSubject').textContent = subjectName + ' (Lanjutan)';
        
        startTimer((currentExam.durasi || 60) * 60);
        showQuestion();
        updateQuestionGrid();
        
        showLoadingOverlay(false);
        
    } catch (error) {
        console.error('Error resuming exam:', error);
        alert('Gagal melanjutkan ujian: ' + error.message);
        showLoadingOverlay(false);
    }
}

async function startExam(examId, subjectName) {
    try {
        showLoadingOverlay(true);
        
        const existingAnswers = await answersRef
            .where('examId', '==', examId)
            .where('siswaId', '==', currentUser.id)
            .get();
        
        if (!existingAnswers.empty) {
            for (const doc of existingAnswers.docs) {
                const data = doc.data();
                if (data.statusKoreksi === 'selesai') {
                    alert('Anda sudah menyelesaikan ujian ini!');
                    showLoadingOverlay(false);
                    return;
                } else if (data.statusKoreksi === 'in_progress' || data.progressStatus === 'in_progress') {
                    const confirmResume = confirm('Anda memiliki ujian yang belum selesai. Lanjutkan?');
                    if (confirmResume) {
                        await resumeExam(examId, subjectName, doc.id);
                    }
                    showLoadingOverlay(false);
                    return;
                }
            }
        }
        
        const examDoc = await examsRef.doc(examId).get();
        if (!examDoc.exists) {
            alert('Ujian tidak ditemukan');
            showLoadingOverlay(false);
            return;
        }
        
        currentExam = { id: examId, ...examDoc.data() };
        currentAnswerDocId = null;
        
        const questionsSnapshot = await questionsRef
            .where('kelas', '==', currentExam.kelas)
            .where('mataPelajaran', '==', currentExam.mataPelajaran)
            .get();
        
        let allQuestions = questionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
        
        if (allQuestions.length === 0) {
            alert('Tidak ada soal untuk ujian ini');
            showLoadingOverlay(false);
            return;
        }
        
        const examJumlahSoal = currentExam.jumlahSoal || {};
        currentQuestions = [
            ...allQuestions.filter(q => q.tipe === 'pg').slice(0, examJumlahSoal.pg || 999),
            ...allQuestions.filter(q => q.tipe === 'isian').slice(0, examJumlahSoal.isian || 999),
            ...allQuestions.filter(q => q.tipe === 'uraian').slice(0, examJumlahSoal.uraian || 999)
        ];
        
        if (currentQuestions.length === 0) {
            alert('Tidak ada soal yang sesuai konfigurasi');
            showLoadingOverlay(false);
            return;
        }
        
        const nilaiPerSoal = currentExam.nilaiPerSoal || { pg: 5, isian: 5, uraian: 5 };
        currentQuestions = currentQuestions.map(q => {
            if (!q.nilai) {
                if (q.tipe === 'pg') q.nilai = nilaiPerSoal.pg;
                else if (q.tipe === 'isian') q.nilai = nilaiPerSoal.isian;
                else if (q.tipe === 'uraian') q.nilai = nilaiPerSoal.uraian;
            }
            return q;
        });
        
        currentAnswers = {};
        currentQuestionIndex = 0;
        answersChangedCount = 0;
        
        const initialData = {
            examId: currentExam.id,
            siswaId: currentUser.id,
            siswaNama: currentUser.nama,
            nis: currentUser.nis || '',
            kelas: currentUser.kelas,
            mataPelajaran: currentExam.mataPelajaran,
            progressStatus: 'in_progress',
            statusKoreksi: 'in_progress',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const newDoc = await answersRef.add(initialData);
        currentAnswerDocId = newDoc.id;
        
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('examPage').style.display = 'block';
        document.getElementById('examSubject').textContent = subjectName;
        
        startTimer((currentExam.durasi || 60) * 60);
        showQuestion();
        updateQuestionGrid();
        
        showLoadingOverlay(false);
        
    } catch (error) {
        console.error('Error starting exam:', error);
        alert('Gagal memulai ujian: ' + error.message);
        showLoadingOverlay(false);
    }
}

// ==================== FUNGSI NAVIGASI & TAMPILAN ====================

function startTimer(duration) {
    const timerDisplay = document.getElementById('timer');
    if (!timerDisplay) return;
    
    let timeLeft = duration;
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert('Waktu habis!');
            submitExam();
        }
        timeLeft--;
    }, 1000);
}

function showQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    const container = document.getElementById('questionContainer');
    if (!question || !container) return;
    
    let html = `
        <div class="question-number">Soal ${currentQuestionIndex + 1} dari ${currentQuestions.length}</div>
        <div class="question-point">⭐ Nilai: ${question.nilai || 0} poin</div>
    `;
    
    if (question.gambar && question.gambar.trim()) {
        html += `
            <div class="question-image-container">
                <img src="${question.gambar}" class="question-image" onclick="showImageModal('${question.gambar}')" onerror="this.style.display='none'">
                <small>🔍 Klik gambar untuk memperbesar</small>
            </div>
        `;
    }
    
    html += `<div class="question-text">${escapeHtml(question.soal || 'Soal tidak tersedia')}</div>`;
    
    if (question.tipe === 'pg') {
        html += '<div class="options">';
        const letters = ['A', 'B', 'C', 'D'];
        const pilihan = question.pilihan || [];
        const gambarPilihan = question.gambarPilihan || {};
        
        for (let i = 0; i < pilihan.length; i++) {
            const letter = letters[i];
            const isSelected = currentAnswers[question.id] === letter;
            const gambarUrl = gambarPilihan[letter];
            
            html += `
                <div class="option ${isSelected ? 'selected' : ''}" onclick="selectOption('${question.id}', '${letter}')">
                    <div class="option-marker">${letter}</div>
                    <div class="option-text">
                        ${gambarUrl ? `<img src="${gambarUrl}" onerror="this.style.display='none'">` : ''}
                        <span>${escapeHtml(pilihan[i])}</span>
                    </div>
                </div>
            `;
        }
        html += '</div>';
    } 
    else if (question.tipe === 'isian') {
        html += `
            <div class="short-answer">
                <input type="text" placeholder="Tulis jawaban Anda di sini..." 
                       value="${escapeHtml(currentAnswers[question.id] || '')}"
                       oninput="saveShortAnswer('${question.id}', this.value)">
            </div>
        `;
    } 
    else if (question.tipe === 'uraian') {
        html += `
            <div class="essay-answer">
                <textarea placeholder="Tulis jawaban essay Anda di sini..." rows="6"
                          oninput="saveEssay('${question.id}', this.value)">${escapeHtml(currentAnswers[question.id] || '')}</textarea>
            </div>
        `;
    }
    
    html += `<div class="navigation-buttons">`;
    if (currentQuestionIndex > 0) {
        html += `<button class="nav-btn prev" onclick="prevQuestion()">← Sebelumnya</button>`;
    } else {
        html += `<div></div>`;
    }
    
    if (currentQuestionIndex < currentQuestions.length - 1) {
        html += `<button class="nav-btn next" onclick="nextQuestion()">Selanjutnya →</button>`;
    } else {
        html += `<button class="nav-btn submit" onclick="submitExam()">📤 Selesai & Kumpulkan</button>`;
    }
    html += `</div>`;
    
    container.innerHTML = html;
}

function selectOption(questionId, answer) {
    const oldAnswer = currentAnswers[questionId];
    if (oldAnswer === answer) return;
    
    currentAnswers[questionId] = answer;
    trackAnswerChange();
    showQuestion();
    updateQuestionGrid();
}

function saveShortAnswer(questionId, value) {
    const oldValue = currentAnswers[questionId] || '';
    if (oldValue === value) return;
    
    currentAnswers[questionId] = value || '';
    trackAnswerChange();
    updateQuestionGrid();
}

function saveEssay(questionId, value) {
    const oldValue = currentAnswers[questionId] || '';
    if (oldValue === value) return;
    
    currentAnswers[questionId] = value || '';
    trackAnswerChange();
    updateQuestionGrid();
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion();
    }
}

function jumpToQuestion(index) {
    if (index >= 0 && index < currentQuestions.length) {
        currentQuestionIndex = index;
        showQuestion();
    }
}

function updateQuestionGrid() {
    const grid = document.getElementById('questionGrid');
    if (!grid) return;
    
    let html = '';
    currentQuestions.forEach((q, idx) => {
        const isAnswered = currentAnswers[q.id] !== undefined && currentAnswers[q.id] !== '';
        const isCurrent = idx === currentQuestionIndex;
        html += `<div class="question-grid-item ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}" onclick="jumpToQuestion(${idx})">${idx + 1}</div>`;
    });
    grid.innerHTML = html;
}

// ==================== SUBMIT UJIAN ====================

async function submitExam() {
    if (!confirm('⚠️ Apakah Anda yakin ingin mengumpulkan jawaban?\n\nAnda tidak dapat mengubah jawaban setelah dikumpulkan!')) {
        return;
    }
    
    if (timerInterval) clearInterval(timerInterval);
    showLoadingOverlay(true);
    
    try {
        await saveProgressToFirestore(true);
        
        const answerDoc = await answersRef.doc(currentAnswerDocId).get();
        const data = answerDoc.data();
        
        const hasUraian = currentQuestions.some(q => q.tipe === 'uraian');
        
        if (hasUraian) {
            alert(`✅ Jawaban berhasil dikumpulkan!\n\n📊 Nilai Sementara: ${data?.nilaiSementara || 0}\n✏️ Soal uraian akan dikoreksi oleh guru.`);
        } else {
            alert(`✅ Jawaban berhasil dikumpulkan!\n\n📊 Nilai Akhir: ${data?.nilaiSementara || 0}`);
        }
        
        showResults();
        showLoadingOverlay(false);
        
    } catch (error) {
        console.error('Error submitting exam:', error);
        alert('❌ Gagal mengumpulkan jawaban: ' + error.message);
        showLoadingOverlay(false);
    }
}

async function showResults() {
    const examPage = document.getElementById('examPage');
    const resultPage = document.getElementById('resultPage');
    
    if (examPage) examPage.style.display = 'none';
    if (resultPage) resultPage.style.display = 'block';
    
    if (currentAnswerDocId) {
        const answerDoc = await answersRef.doc(currentAnswerDocId).get();
        const data = answerDoc.data();
        
        if (data) {
            document.getElementById('resultPG').textContent = `${data.nilaiPG || 0} / ${data.totalPG || 0}`;
            document.getElementById('resultIsian').textContent = `${data.nilaiIsian || 0} / ${data.totalIsian || 0}`;
            
            const hasUraian = (data.jumlahSoal?.uraian || 0) > 0;
            if (hasUraian && data.statusKoreksi === 'pending') {
                document.getElementById('resultUraian').innerHTML = `⏳ Menunggu koreksi guru`;
                document.getElementById('resultTotal').innerHTML = `${data.nilaiSementara || 0} <small>(Nilai Sementara)</small>`;
            } else {
                document.getElementById('resultUraian').textContent = `${data.nilaiUraian || 0} / ${data.totalUraian || 0}`;
                document.getElementById('resultTotal').textContent = `${data.nilaiSementara || 0}`;
            }
        }
    }
}

// ==================== UTILITY ====================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showImageModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    if (modal && modalImg) {
        modal.style.display = 'flex';
        modalImg.src = imageUrl;
    }
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) modal.style.display = 'none';
}

function showLoadingOverlay(show) {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay && show) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.innerHTML = '<div class="spinner"></div><p>Memuat...</p>';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            color: white;
        `;
        document.body.appendChild(overlay);
        
        const style = document.createElement('style');
        style.textContent = `
            .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            .loading-spinner, .empty-state, .error-state {
                text-align: center;
                padding: 40px;
                background: white;
                border-radius: 24px;
                color: #64748b;
            }
            .badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 30px;
                font-size: 11px;
                font-weight: 600;
                margin-top: 10px;
            }
            .badge-success { background: #10b981; color: white; }
            .badge-warning { background: #f59e0b; color: white; }
            .card.completed { opacity: 0.7; cursor: default; }
            .card.completed:hover { transform: none; }
            .question-image-container {
                background: #f8fafc;
                border-radius: 16px;
                padding: 12px;
                margin: 12px 0;
                text-align: center;
            }
            .question-image {
                max-width: 100%;
                max-height: 200px;
                object-fit: contain;
                border-radius: 8px;
                cursor: pointer;
            }
            .question-image-container small {
                display: block;
                font-size: 10px;
                color: #94a3b8;
                margin-top: 6px;
            }
        `;
        document.head.appendChild(style);
    }
    
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function backToMenu() {
    const resultPage = document.getElementById('resultPage');
    const mainMenu = document.getElementById('mainMenu');
    
    if (resultPage) resultPage.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'block';
    
    if (timerInterval) clearInterval(timerInterval);
    currentExam = null;
    currentQuestions = [];
    currentAnswers = {};
    currentQuestionIndex = 0;
    currentAnswerDocId = null;
    answersChangedCount = 0;
    
    loadSubjects();
}

function logout() {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        if (timerInterval) clearInterval(timerInterval);
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}