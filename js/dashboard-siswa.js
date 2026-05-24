// dashboard-siswa.js - VERSI DIPERBAIKI

// Ambil data user dari sessionStorage
const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
let currentExam = null;
let currentQuestions = [];
let currentAnswers = {};
let currentQuestionIndex = 0;
let timerInterval = null;

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
    
    subjectList.innerHTML = '<p>Loading...</p>';
    
    try {
        const examsSnapshot = await examsRef
            .where('kelas', '==', currentUser.kelas)
            .where('aktif', '==', true)
            .get();
        
        subjectList.innerHTML = '';
        
        if (examsSnapshot.empty) {
            subjectList.innerHTML = '<p>Tidak ada ujian tersedia</p>';
            return;
        }
        
        examsSnapshot.forEach(doc => {
            const exam = doc.data();
            const totalSoal = (exam.jumlahSoal?.pg || 0) + (exam.jumlahSoal?.isian || 0) + (exam.jumlahSoal?.uraian || 0);
            subjectList.innerHTML += `
                <div class="card" onclick="startExam('${doc.id}', '${exam.mataPelajaran || 'Ujian'}')">
                    <div class="card-icon">📚</div>
                    <h3>${exam.mataPelajaran || 'Mata Pelajaran'}</h3>
                    <p>${totalSoal} Soal</p>
                    <p>Durasi: ${exam.durasi || 60} menit</p>
                </div>
            `;
        });
        
    } catch (error) {
        console.error('Error loading subjects:', error);
        subjectList.innerHTML = '<p style="color: red;">Error loading data</p>';
    }
}

// Mulai ujian
async function startExam(examId, subjectName) {
    try {
        // Cek apakah sudah pernah mengerjakan
        const existingAnswer = await answersRef
            .where('examId', '==', examId)
            .where('siswaId', '==', currentUser.id)
            .limit(1)
            .get();
        
        if (!existingAnswer.empty) {
            alert('Anda sudah mengerjakan ujian ini!');
            return;
        }
        
        // Ambil data ujian
        const examDoc = await examsRef.doc(examId).get();
        if (!examDoc.exists) {
            alert('Ujian tidak ditemukan');
            return;
        }
        
        currentExam = { id: examId, ...examDoc.data() };
        
        // Ambil soal berdasarkan kelas dan mata pelajaran
        const questionsSnapshot = await questionsRef
            .where('kelas', '==', currentExam.kelas)
            .where('mataPelajaran', '==', currentExam.mataPelajaran)
            .get();
        
        currentQuestions = questionsSnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
        
        if (currentQuestions.length === 0) {
            alert('Tidak ada soal untuk ujian ini. Silakan hubungi guru.');
            return;
        }
        
        // Filter soal berdasarkan tipe yang di-setting
        const examJumlahSoal = currentExam.jumlahSoal || {};
        let filteredQuestions = [];
        
        const pgQuestions = currentQuestions.filter(q => q.tipe === 'pg');
        const isianQuestions = currentQuestions.filter(q => q.tipe === 'isian');
        const uraianQuestions = currentQuestions.filter(q => q.tipe === 'uraian');
        
        const pgCount = examJumlahSoal.pg || pgQuestions.length;
        const isianCount = examJumlahSoal.isian || isianQuestions.length;
        const uraianCount = examJumlahSoal.uraian || uraianQuestions.length;
        
        filteredQuestions = [
            ...pgQuestions.slice(0, pgCount),
            ...isianQuestions.slice(0, isianCount),
            ...uraianQuestions.slice(0, uraianCount)
        ];
        
        if (filteredQuestions.length === 0) {
            alert('Tidak ada soal yang sesuai dengan konfigurasi ujian');
            return;
        }
        
        currentQuestions = filteredQuestions;
        
        // Set nilai per soal dari exam setting
        const nilaiPerSoalSetting = currentExam.nilaiPerSoal || {
            pg: 5,
            isian: 5,
            uraian: 5
        };
        
        currentQuestions = currentQuestions.map(question => {
            if (!question.nilai) {
                if (question.tipe === 'pg') question.nilai = nilaiPerSoalSetting.pg;
                else if (question.tipe === 'isian') question.nilai = nilaiPerSoalSetting.isian;
                else if (question.tipe === 'uraian') question.nilai = nilaiPerSoalSetting.uraian;
            }
            return question;
        });
        
        currentAnswers = {};
        currentQuestionIndex = 0;
        
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('examPage').style.display = 'block';
        document.getElementById('examSubject').textContent = subjectName;
        
        startTimer((currentExam.durasi || 60) * 60);
        showQuestion();
        updateQuestionGrid();
        
    } catch (error) {
        console.error('Error starting exam:', error);
        alert('Gagal memulai ujian: ' + error.message);
    }
}

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

// 🔥 PERBAIKAN: Fungsi showQuestion dengan gambar di pilihan jawaban
function showQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    const container = document.getElementById('questionContainer');
    
    if (!question || !container) return;
    
    let questionHtml = `
        <div class="question-number">Soal ${currentQuestionIndex + 1} dari ${currentQuestions.length}</div>
        <div class="question-point">Nilai: ${question.nilai || 0} poin</div>
    `;
    
    // Gambar soal
    if (question.gambar && question.gambar.trim() !== '') {
        questionHtml += `
            <div class="question-image-container">
                <img src="${question.gambar}" 
                     alt="Gambar soal" 
                     class="question-image"
                     onclick="showImageModal('${question.gambar}')"
                     onerror="this.style.display='none'">
                <p style="font-size: 12px; color: #666; margin-top: 5px;">Klik gambar untuk memperbesar</p>
            </div>
        `;
    }
    
    // Teks soal
    questionHtml += `<div class="question-text">${question.soal || 'Soal tidak tersedia'}</div>`;
    
    // Pilihan Jawaban
    if (question.tipe === 'pg') {
        questionHtml += '<div class="options">';
        const optionLetters = ['A', 'B', 'C', 'D'];
        const pilihan = question.pilihan || [];
        const gambarPilihan = question.gambarPilihan || {};
        
        for (let i = 0; i < pilihan.length; i++) {
            const pilihanText = pilihan[i];
            if (!pilihanText) continue;
            
            const optionLetter = optionLetters[i];
            const isSelected = currentAnswers[question.id] === optionLetter;
            const gambarUrl = (gambarPilihan && gambarPilihan[optionLetter]) ? gambarPilihan[optionLetter] : '';
            
            questionHtml += `<div class="option ${isSelected ? 'selected' : ''}" onclick="selectOption('${question.id}', '${optionLetter}')">`;
            questionHtml += `<div class="option-marker">${optionLetter}</div>`;
            questionHtml += `<div class="option-text">`;
            
            if (gambarUrl) {
                questionHtml += `<img src="${gambarUrl}" 
                       onclick="showOptionImage('${gambarUrl}', event)" 
                       onerror="this.style.display='none'"
                       style="cursor: pointer;"
                       title="Klik untuk memperbesar">`;
            }
            questionHtml += `<span>${pilihanText}</span>`;
            questionHtml += `</div>`; // tutup option-text
            questionHtml += `</div>`; // tutup option
        }
        
        questionHtml += '</div>';
        
    } else if (question.tipe === 'isian') {
        questionHtml += `
            <div class="short-answer">
                <input type="text" 
                       placeholder="Tulis jawaban Anda" 
                       value="${escapeHtml(currentAnswers[question.id] || '')}"
                       onchange="saveShortAnswer('${question.id}', this.value)">
            </div>
        `;
        
    } else if (question.tipe === 'uraian') {
        questionHtml += `
            <div class="essay-answer">
                <textarea placeholder="Tulis jawaban Anda" rows="5"
                          onchange="saveEssay('${question.id}', this.value)">${escapeHtml(currentAnswers[question.id] || '')}</textarea>
            </div>
        `;
    }
    
    // Tombol navigasi
    questionHtml += `<div class="navigation-buttons">`;
    if (currentQuestionIndex > 0) {
        questionHtml += `<button class="nav-btn prev" onclick="prevQuestion()">← Sebelumnya</button>`;
    } else {
        questionHtml += `<div></div>`;
    }
    
    if (currentQuestionIndex < currentQuestions.length - 1) {
        questionHtml += `<button class="nav-btn next" onclick="nextQuestion()">Selanjutnya →</button>`;
    } else {
        questionHtml += `<button class="nav-btn submit" onclick="submitExam()">Selesai</button>`;
    }
    questionHtml += `</div>`;
    
    container.innerHTML = questionHtml;
}

// 🔥 FUNGSI BARU: Escape HTML untuk keamanan
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 🔥 FUNGSI BARU: Modal gambar
function showImageModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    if (modal && modalImg) {
        modal.style.display = 'flex';
        modalImg.src = imageUrl;
    }
}
function showOptionImage(imageUrl, event) {
    if (event) {
        event.stopPropagation(); // Mencegah agar tidak memilih jawaban saat klik gambar
    }
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    if (modal && modalImg) {
        modal.style.display = 'flex';
        modalImg.src = imageUrl;
    }
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function selectOption(questionId, answer) {
    currentAnswers[questionId] = answer;
    showQuestion();
    updateQuestionGrid();
}

function saveShortAnswer(questionId, value) {
    currentAnswers[questionId] = value || '';
    updateQuestionGrid();
}

function saveEssay(questionId, value) {
    currentAnswers[questionId] = value || '';
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
    
    let gridHtml = '';
    
    currentQuestions.forEach((question, index) => {
        const isAnswered = currentAnswers[question.id] !== undefined && currentAnswers[question.id] !== '';
        const isCurrent = index === currentQuestionIndex;
        
        gridHtml += `
            <div class="question-grid-item ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}" 
                 onclick="jumpToQuestion(${index})">
                ${index + 1}
            </div>
        `;
    });
    
    grid.innerHTML = gridHtml;
}

async function submitExam() {
    if (!confirm('Apakah Anda yakin ingin mengumpulkan jawaban?')) {
        return;
    }
    
    if (timerInterval) clearInterval(timerInterval);
    
    try {
        const examDoc = await examsRef.doc(currentExam.id).get();
        const examData = examDoc.data();
        
        if (!examData) {
            throw new Error('Data ujian tidak ditemukan');
        }
        
        const nilaiPGPerSoal = examData.nilaiPerSoal?.pg || 5;
        const nilaiIsianPerSoal = examData.nilaiPerSoal?.isian || 5;
        const nilaiUraianPerSoal = examData.nilaiPerSoal?.uraian || 5;
        
        const jawabanPG = {};
        const jawabanIsian = {};
        const jawabanUraian = {};
        
        let nilaiPG = 0;
        let nilaiIsian = 0;
        let jmlPG = 0;
        let jmlIsian = 0;
        let jmlUraian = 0;
        
        for (const question of currentQuestions) {
            const jawabanSiswa = currentAnswers[question.id];
            const kunci = question.kunci;
            const tipe = question.tipe;
            
            if (tipe === 'pg') {
                jmlPG++;
                jawabanPG[question.id] = {
                    jawaban: jawabanSiswa || '',
                    kunci: kunci || '',
                    nomor: question.nomor,
                    soal: question.soal,
                    pilihan: question.pilihan || []
                };
                
                if (jawabanSiswa && kunci) {
                    const jawabanHuruf = String(jawabanSiswa).trim().toUpperCase();
                    const kunciHuruf = String(kunci).trim().toUpperCase();
                    if (jawabanHuruf === kunciHuruf) {
                        nilaiPG += nilaiPGPerSoal;
                    }
                }
            } 
            else if (tipe === 'isian') {
                jmlIsian++;
                jawabanIsian[question.id] = {
                    jawaban: jawabanSiswa || '',
                    kunci: kunci || '',
                    nomor: question.nomor,
                    soal: question.soal
                };
                
                if (jawabanSiswa && kunci) {
                    const jawabanStr = String(jawabanSiswa).toLowerCase().trim();
                    const kunciStr = String(kunci).toLowerCase().trim();
                    if (jawabanStr === kunciStr) {
                        nilaiIsian += nilaiIsianPerSoal;
                    }
                }
            }
            else if (tipe === 'uraian') {
                jmlUraian++;
                jawabanUraian[question.id] = {
                    jawaban: jawabanSiswa || '',
                    soal: question.soal,
                    nilaiMaksimal: nilaiUraianPerSoal,
                    nilaiDiperoleh: 0,
                    nomor: question.nomor
                };
            }
        }
        
        const totalPG = jmlPG * nilaiPGPerSoal;
        const totalIsian = jmlIsian * nilaiIsianPerSoal;
        const totalUraian = jmlUraian * nilaiUraianPerSoal;
        
        const jumlahNilaiDiperoleh = nilaiPG + nilaiIsian;
        const jumlahNilaiMaksimal = totalPG + totalIsian + totalUraian;
        
        let nilaiSementara = 0;
        if (jumlahNilaiMaksimal > 0) {
            nilaiSementara = (jumlahNilaiDiperoleh / jumlahNilaiMaksimal) * 100;
            nilaiSementara = Math.round(nilaiSementara);
        }
        
        await answersRef.add({
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
            
            jumlahSoal: {
                pg: jmlPG,
                isian: jmlIsian,
                uraian: jmlUraian
            },
            
            nilaiSementara: nilaiSementara,
            statusKoreksi: jmlUraian > 0 ? 'pending' : 'selesai',
            waktu: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        if (jmlUraian > 0) {
            alert('Jawaban berhasil dikumpulkan!\nNilai Sementara: ' + nilaiSementara + '\n(Soal uraian menunggu koreksi)');
        } else {
            alert('Jawaban berhasil dikumpulkan!\nNilai Akhir: ' + nilaiSementara);
        }
        showResults(nilaiPG, nilaiIsian, totalPG, totalIsian);
        
    } catch (error) {
        console.error('Error submitting exam:', error);
        alert('Gagal mengumpulkan jawaban: ' + error.message);
    }
}

function showResults(nilaiPG, nilaiIsian, totalPG, totalIsian) {
    const examPage = document.getElementById('examPage');
    const resultPage = document.getElementById('resultPage');
    
    if (examPage) examPage.style.display = 'none';
    if (resultPage) resultPage.style.display = 'block';
    
    const resultPG = document.getElementById('resultPG');
    const resultIsian = document.getElementById('resultIsian');
    const resultUraian = document.getElementById('resultUraian');
    const resultTotal = document.getElementById('resultTotal');
    
    if (resultPG) resultPG.textContent = nilaiPG + ' / ' + totalPG;
    if (resultIsian) resultIsian.textContent = nilaiIsian + ' / ' + totalIsian;
    if (resultUraian) resultUraian.textContent = 'Menunggu koreksi guru';
    if (resultTotal) resultTotal.textContent = (nilaiPG + nilaiIsian) + ' / ' + (totalPG + totalIsian);
}

// 🔥 PERBAIKAN: Fungsi backToMenu
function backToMenu() {
    const resultPage = document.getElementById('resultPage');
    const mainMenu = document.getElementById('mainMenu');
    
    if (resultPage) resultPage.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'block';
    
    // Reset semua variabel
    currentExam = null;
    currentQuestions = [];
    currentAnswers = {};
    currentQuestionIndex = 0;
    if (timerInterval) clearInterval(timerInterval);
}

// 🔥 PERBAIKAN: Fungsi logout
function logout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        // Hapus session storage
        sessionStorage.removeItem('currentUser');
        // Redirect ke halaman login
        window.location.href = 'index.html';
    }
}
