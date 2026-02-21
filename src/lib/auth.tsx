"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

interface AuthContextType {
    isLoggedIn: boolean;
    uid: string;
    user: string;
    role: string;
    committee: string;
    committeeHasTimetable: boolean;
    login: (userData: any) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [uid, setUid] = useState("");
    const [user, setUser] = useState("");
    const [role, setRole] = useState("OC");
    const [committee, setCommittee] = useState("");
    const [committeeHasTimetable, setCommitteeHasTimetable] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
            if (firebaseUser) {
                try {
                    const docRef = doc(db, "users", firebaseUser.uid);
                    const snap = await getDoc(docRef);

                    if (snap.exists()) {
                        const userData = snap.data();

                        setIsLoggedIn(true);
                        setUid(firebaseUser.uid);
                        setUser(userData.name || "");
                        setRole(userData.role || "OC");
                        setCommittee(userData.committee || "");
                        setCommitteeHasTimetable(userData.committeeHasTimetable || false);
                    } else {
                        // Handle case where user auth exists but no Firestore doc
                        console.error("User authenticated but no Firestore record found.");
                        logout();
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    logout();
                }
            } else {
                setIsLoggedIn(false);
                setUid("");
                setUser("");
                setRole("OC");
                setCommittee("");
                setCommitteeHasTimetable(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = (userData: any) => {
        // With Firebase onAuthStateChanged, manual setting is usually not needed for persistence,
        // but can be used for immediate UI updates before the listener fires or if custom data needs to be set immediately.
        setIsLoggedIn(true);
        setUid(userData.uid || "");
        setUser(userData.name || "");
        setRole(userData.role || "OC");
        setCommittee(userData.committee || "");
        setCommitteeHasTimetable(userData.committeeHasTimetable || false);
        router.push("/dashboard");
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setIsLoggedIn(false);
            setUid("");
            setUser("");
            setRole("OC");
            setCommittee("");
            setCommitteeHasTimetable(false);
            router.push("/login");
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };

    if (loading) return null; // Avoid hydration mismatch

    return (
        <AuthContext.Provider value={{ isLoggedIn, uid, user, role, committee, committeeHasTimetable, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
