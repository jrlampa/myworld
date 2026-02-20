import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";

// Inicializa o Firebase App
const app = initializeApp(firebaseConfig);

// Exporta instância do Firestore
export const db = getFirestore(app);
