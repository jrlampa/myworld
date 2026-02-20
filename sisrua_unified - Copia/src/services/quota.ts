import { db } from "./firestore";
import { collection, doc, getDoc, setDoc, increment, serverTimestamp } from "firebase/firestore";

const QUOTA_COLLECTION = "user_quotas";
const MAX_EXPORTS = 100; // Ajuste conforme limite gratuito do Cloud Run

export async function getUserQuota(userId: string) {
  const ref = doc(db, QUOTA_COLLECTION, userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Inicializa quota se não existir
    await setDoc(ref, { used: 0, max: MAX_EXPORTS, updatedAt: serverTimestamp() });
    return { used: 0, max: MAX_EXPORTS };
  }
  return snap.data();
}

export async function incrementUserQuota(userId: string) {
  const ref = doc(db, QUOTA_COLLECTION, userId);
  await setDoc(ref, { updatedAt: serverTimestamp() }, { merge: true });
  return setDoc(ref, { used: increment(1) }, { merge: true });
}

export async function resetUserQuota(userId: string) {
  const ref = doc(db, QUOTA_COLLECTION, userId);
  return setDoc(ref, { used: 0, updatedAt: serverTimestamp() }, { merge: true });
}
