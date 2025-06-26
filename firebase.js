// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// TODO: Replace the following with your app's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDAwnud6tqFA4qyw64dxvutbVK4fqiRKkM",
  authDomain: "zshub-cb7d2.firebaseapp.com",
  projectId: "zshub-cb7d2",
  storageBucket: "zshub-cb7d2.firebasestorage.app",
  messagingSenderId: "749583497475",
  appId: "1:749583497475:web:5f2680f5d409a295ed1136",
  measurementId: "G-E4VLLG7PH2"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export default app;
export { db, auth, provider }; 