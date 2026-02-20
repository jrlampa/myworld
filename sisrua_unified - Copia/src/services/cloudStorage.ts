// Funções utilitárias para persistência de projetos no Firestore
import { db } from "./firestore";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  where,
} from "firebase/firestore";

const PROJECTS_COLLECTION = "projects";
const MAX_PROJECTS = 90;

export async function saveProject(userId: string, projectData: any) {
  // Adiciona timestamp e userId
  const data = {
    ...projectData,
    userId,
    updatedAt: serverTimestamp(),
  };
  // Despeja o mais antigo se exceder o limite
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    where("userId", "==", userId),
    orderBy("updatedAt", "asc"),
    limit(MAX_PROJECTS + 1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.size >= MAX_PROJECTS) {
    const oldest = snapshot.docs[0];
    await deleteDoc(doc(db, PROJECTS_COLLECTION, oldest.id));
  }
  return addDoc(collection(db, PROJECTS_COLLECTION), data);
}

export async function getUserProjects(userId: string) {
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc"),
    limit(MAX_PROJECTS)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function updateProject(projectId: string, data: any) {
  return updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProject(projectId: string) {
  return deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
}

// Salva snapshot de projeto (versão)
export async function saveProjectSnapshot(userId: string, projectId: string, snapshotData: any) {
  // Cada snapshot é um documento em subcoleção 'snapshots' do projeto
  const snapshotRef = collection(db, PROJECTS_COLLECTION, projectId, "snapshots");
  return addDoc(snapshotRef, {
    ...snapshotData,
    userId,
    createdAt: serverTimestamp(),
  });
}

// Lista snapshots de um projeto
export async function getProjectSnapshots(projectId: string) {
  const snapshotRef = collection(db, PROJECTS_COLLECTION, projectId, "snapshots");
  const q = query(snapshotRef, orderBy("createdAt", "desc"), limit(20));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Restaura um snapshot (sobrescreve o projeto)
export async function restoreProjectFromSnapshot(projectId: string, snapshotId: string) {
  const snapshotRef = doc(db, PROJECTS_COLLECTION, projectId, "snapshots", snapshotId);
  const snap = await getDoc(snapshotRef);
  if (!snap.exists()) throw new Error("Snapshot não encontrado");
  const data = snap.data();
  // Remove campos de controle
  delete data.id;
  delete data.createdAt;
  return updateProject(projectId, data);
}
