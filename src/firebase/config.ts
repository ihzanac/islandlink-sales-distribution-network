import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBEOGj5j6FAQumk_A6AF_IceOsOVv6nx4c",
  authDomain: "islandlink-1f345.firebaseapp.com",
  projectId: "islandlink-1f345",
  storageBucket: "islandlink-1f345.firebasestorage.app",
  messagingSenderId: "107273179025",
  appId: "1:107273179025:web:34bf3aa5ad49b9a51ad430",
  measurementId: "G-5LJ17RPFSG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const GOOGLE_MAPS_API_KEY = firebaseConfig.apiKey;

// keep user logged in even after browser restart
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Auth persistence set to LOCAL");
  })
  .catch((error) => {
    console.error("Persistence error:", error);
  });