// Implementação do repositório de projetos usando Firestore - Infrastructure Layer
import { Project, ProjectRepository } from "../application/ProjectService";
import { db } from "../../src/services/firestore";
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where } from "firebase/firestore";

export class FirestoreProjectRepository implements ProjectRepository {
  async save(project: Project) {
    await setDoc(doc(db, "projects", project.id), {
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    });
    return project;
  }

  async findById(id: string) {
    const snap = await getDoc(doc(db, "projects", id));
    if (!snap.exists()) return null;
    const data = snap.data();
    return { ...data, createdAt: new Date(data.createdAt), updatedAt: new Date(data.updatedAt) };
  }

  async findByUser(userId: string) {
    const q = query(collection(db, "projects"), where("userId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map(docSnap => {
      const data = docSnap.data();
      return { ...data, createdAt: new Date(data.createdAt), updatedAt: new Date(data.updatedAt) };
    });
  }

  async delete(id: string) {
    await deleteDoc(doc(db, "projects", id));
  }
}
