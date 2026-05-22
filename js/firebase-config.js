// Konfigurasi Firebase
const firebaseConfig = {
   apiKey: "AIzaSyCksNT9rCQrG0dLV1b0Y3TV7R9NhFhCmO4",
  authDomain: "asa-j-2026.firebaseapp.com",
  projectId: "asa-j-2026",
  storageBucket: "asa-j-2026.firebasestorage.app",
  messagingSenderId: "837383753005",
  appId: "1:837383753005:web:9ff358de89893debdb17a4"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Collection references
const usersRef = db.collection('users');
const classesRef = db.collection('classes');
const subjectsRef = db.collection('subjects');
const questionsRef = db.collection('questions');
const examsRef = db.collection('exams');
const answersRef = db.collection('answers');
const gradesRef = db.collection('grades');

// Data kelas yang tersedia
const availableClasses = ['4A', '4B', '5A', '5B', '6A', '6B'];

// Data mata pelajaran
const availableSubjects = [
    'Matematika',
    'Bahasa Indonesia',
    'IPA',
    'IPS',
    'PPKn',
    'PJOK',
    'SBdP'
];
