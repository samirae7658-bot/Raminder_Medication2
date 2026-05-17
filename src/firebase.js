import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBEDRV0P9s81dhO_QWLjJQE_1qakESUOyE",
  authDomain: "med-reminder2.firebaseapp.com",
  projectId: "med-reminder2",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);