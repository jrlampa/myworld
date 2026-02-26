import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    quotaInfo: QuotaInfo | null;
}

export interface QuotaInfo {
    generatedCount: number;
    maxQuota: number;
    lastReset: Date;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAX_FREE_QUOTA = 15; // Define max quota per month/billing cycle

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Fetch or create user document for quotas
                const userRef = doc(db, 'users', currentUser.uid);
                const docSnap = await getDoc(userRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setQuotaInfo({
                        generatedCount: data.generatedCount || 0,
                        maxQuota: data.maxQuota || MAX_FREE_QUOTA,
                        lastReset: data.lastReset?.toDate() || new Date()
                    });
                } else {
                    // Initialize fresh user
                    const newQuota = {
                        generatedCount: 0,
                        maxQuota: MAX_FREE_QUOTA,
                        lastReset: new Date()
                    };
                    await setDoc(userRef, {
                        email: currentUser.email,
                        displayName: currentUser.displayName,
                        ...newQuota
                    });
                    setQuotaInfo(newQuota);
                }
            } else {
                setQuotaInfo(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Google Auth Error', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Sign Out Error', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, quotaInfo }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
