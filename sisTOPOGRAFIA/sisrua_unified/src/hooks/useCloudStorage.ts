import { useState, useCallback } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { GlobalState } from '../types';

export interface CloudProject {
    id?: string;
    name: string;
    userId: string;
    updatedAt: any;
    state: GlobalState;
}

export interface ProjectSnapshot {
    id?: string;
    name: string;
    createdAt: any;
    state: GlobalState;
}

export function useCloudStorage() {
    const { user } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const saveProjectToCloud = useCallback(async (projectName: string, state: GlobalState) => {
        if (!user) throw new Error("User must be logged in to save to cloud.");
        setIsSaving(true);

        try {
            const projectsRef = collection(db, 'projects');
            const docRef = await addDoc(projectsRef, {
                name: projectName,
                userId: user.uid,
                updatedAt: serverTimestamp(),
                state
            });
            return docRef.id;
        } catch (error) {
            console.error("Error saving to cloud:", error);
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [user]);

    const loadProjects = useCallback(async (maxResults = 20): Promise<CloudProject[]> => {
        if (!user) return [];
        setIsLoading(true);

        try {
            const q = query(
                collection(db, 'projects'),
                where("userId", "==", user.uid),
                orderBy("updatedAt", "desc"),
                limit(maxResults)
            );

            const querySnapshot = await getDocs(q);
            const projects: CloudProject[] = [];
            querySnapshot.forEach((doc) => {
                projects.push({ id: doc.id, ...doc.data() } as CloudProject);
            });

            return projects;
        } catch (error) {
            console.error("Error loading projects:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const loadProjectById = useCallback(async (id: string): Promise<GlobalState | null> => {
        setIsLoading(true);
        try {
            const docRef = doc(db, 'projects', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                return data.state as GlobalState;
            }
            return null;
        } catch (error) {
            console.error("Error loading specific project:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const saveSnapshot = useCallback(async (projectId: string, snapshotName: string, state: GlobalState) => {
        if (!user) throw new Error("User must be logged in to save snapshots.");
        setIsSaving(true);

        try {
            const snapshotsRef = collection(db, 'projects', projectId, 'snapshots');
            await addDoc(snapshotsRef, {
                name: snapshotName,
                createdAt: serverTimestamp(),
                state
            });
            // Update parent modified time
            const projectRef = doc(db, 'projects', projectId);
            await setDoc(projectRef, { updatedAt: serverTimestamp() }, { merge: true });
        } catch (error) {
            console.error("Error saving snapshot:", error);
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [user]);

    const loadSnapshots = useCallback(async (projectId: string): Promise<ProjectSnapshot[]> => {
        setIsLoading(true);
        try {
            const q = query(
                collection(db, 'projects', projectId, 'snapshots'),
                orderBy("createdAt", "desc")
            );
            const querySnapshot = await getDocs(q);
            const snaps: ProjectSnapshot[] = [];
            querySnapshot.forEach((doc) => {
                snaps.push({ id: doc.id, ...doc.data() } as ProjectSnapshot);
            });
            return snaps;
        } catch (error) {
            console.error("Error loading snapshots:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        saveProjectToCloud,
        loadProjects,
        loadProjectById,
        saveSnapshot,
        loadSnapshots,
        isSaving,
        isLoading
    };
}
