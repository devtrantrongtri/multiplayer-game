import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  // Thay thế bằng config Firebase của bạn
  apiKey: "AIzaSyBk8in7N5L3ljyv1m_T4vwjxBEzrgy5_m0",
  authDomain: "multiplayer-game-f7cfb.firebaseapp.com",
  databaseURL: "https://multiplayer-game-f7cfb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "multiplayer-game-f7cfb",
  storageBucket: "multiplayer-game-f7cfb.firebasestorage.app",
  messagingSenderId: "444611956434",
  appId: "1:444611956434:web:a7e8277b7320e3ae97e70b",
  measurementId: "G-GFL36XZTN1"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
