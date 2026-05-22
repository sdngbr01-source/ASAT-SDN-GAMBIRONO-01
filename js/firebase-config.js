// Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAS32q7IfWRdQDRjjHrOgCziLDb2eeNi88",
  authDomain: "asat-sdn-gambirono-01.firebaseapp.com",
  projectId: "asat-sdn-gambirono-01",
  storageBucket: "asat-sdn-gambirono-01.firebasestorage.app",
  messagingSenderId: "773097585212",
  appId: "1:773097585212:web:4c0e56c127f3688206e139"
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
