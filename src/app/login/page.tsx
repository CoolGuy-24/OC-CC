"use client";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { COMMITTEE_DATA } from "@/data/committees";
import { useAuth } from "@/lib/auth";
import { CC_AUTH_KEY } from "@/data/config";

export default function LoginPage() {
    const { isLoggedIn, login } = useAuth();
    const router = useRouter();

    const [isRegistering, setIsRegistering] = useState(false);
    const [role, setRole] = useState("oc");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [committeeIdx, setCommitteeIdx] = useState("");
    const [ccAuthKey, setCcAuthKey] = useState("");
    const [ocName, setOcName] = useState("");
    const [authMsg, setAuthMsg] = useState({ text: "", color: "" });

    // Auto redirect if already logged in via context
    useEffect(() => {
        if (isLoggedIn) {
            router.push("/dashboard");
        }
    }, [isLoggedIn, router]);

    const handleCommitteeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCommitteeIdx(e.target.value);
        setOcName("");
    };

    const selectedCommittee = committeeIdx ? COMMITTEE_DATA[Number(committeeIdx)] : null;
    const ocOptions = selectedCommittee ? selectedCommittee.ocs.slice().sort() : [];

    const handleRegister = async () => {
        setAuthMsg({ text: "", color: "" });
        const u = username.trim();
        const p = password.trim();

        if (!u || !p) {
            setAuthMsg({ text: "Please fill in all fields.", color: "#ef4444" });
            return;
        }

        if (committeeIdx === "" || !selectedCommittee) {
            setAuthMsg({ text: "Please select your committee.", color: "#ef4444" });
            return;
        }

        // CC validation
        if (role === "cc") {
            const enteredKey = ccAuthKey.trim();
            if (!enteredKey || enteredKey !== CC_AUTH_KEY) {
                setAuthMsg({ text: "Invalid CC authentication key. Contact admin.", color: "#ef4444" });
                return;
            }
        }

        // OC validation
        let selectedOcName = "";
        if (role === "oc") {
            selectedOcName = ocName;
            if (!selectedOcName) {
                setAuthMsg({ text: "Please select your name from the list.", color: "#ef4444" });
                return;
            }
        }

        try {
            // Attempt to create the user with the email (using username input as email string)
            const userCred = await createUserWithEmailAndPassword(auth, u, p);

            const finalName = role === "oc" ? selectedOcName : u;
            const finalRole = role === "cc" ? "CC" : "OC";

            // Store extra user metadata in the users collection
            await setDoc(doc(db, "users", userCred.user.uid), {
                name: finalName,
                email: u,
                role: finalRole,
                committee: selectedCommittee.name,
                committeeHasTimetable: !!selectedCommittee.hasTimetable
            });

            setAuthMsg({ text: "Registration successful! You are now logged in.", color: "#4ade80" });
            setPassword("");
            setCcAuthKey("");
            // With Firebase onAuthStateChanged, they will be auto-redirected by the AuthProvider
        } catch (error: any) {
            let errorMsg = "Registration failed.";
            if (error.code === 'auth/email-already-in-use') {
                errorMsg = "Email already in use. Try logging in.";
            } else if (error.code === 'auth/invalid-email') {
                errorMsg = "Please enter a valid email address as your username.";
            } else if (error.code === 'auth/weak-password') {
                errorMsg = "Password should be at least 6 characters.";
            }
            setAuthMsg({ text: errorMsg, color: "#ef4444" });
        }
    };

    const handleLogin = async () => {
        setAuthMsg({ text: "", color: "" });

        const u = username.trim();
        const p = password.trim();

        if (!u || !p) {
            setAuthMsg({
                text: "Please enter email and password.",
                color: "#ef4444"
            });
            return;
        }

        try {
            // Sign in through Firebase Authentication
            const userCred = await signInWithEmailAndPassword(auth, u, p);

            // Fetch the user's document explicitly using their UID
            const docRef = doc(db, "users", userCred.user.uid);
            const snap = await getDoc(docRef);

            if (snap.exists()) {
                const userData = snap.data();
                // Manually trigger the context login to update UI state immediately
                login({
                    uid: userCred.user.uid,
                    email: userCred.user.email,
                    role: userData.role,
                    committee: userData.committee,
                    name: userData.name || u,
                    committeeHasTimetable: userData.committeeHasTimetable || false
                });
            } else {
                setAuthMsg({ text: "User record not found in database.", color: "#ef4444" });
            }
        } catch (error: any) {
            let errorMsg = "Invalid credentials.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                errorMsg = "Incorrect username or password.";
            } else if (error.code === 'auth/invalid-email') {
                errorMsg = "Please enter a valid email format.";
            }

            setAuthMsg({
                text: errorMsg,
                color: "#ef4444"
            });
        }
    };

    return (
        <div className="login-container">
            <header>
                <h2>{isRegistering ? "Create Account" : "System Login"}</h2>
                <p>{isRegistering ? "Credentials will be saved" : "Enter details to access your dashboard"}</p>
            </header>

            <div className="input-group">
                <label>Email-id</label>
                <input type="text" placeholder="Email-id" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>

            <div className="input-group">
                <label>Password</label>
                <input type="password" placeholder="Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {/* COMMITTEE SELECTION (always visible) */}
            <div className="input-group">
                <label>Committee</label>
                <select className="modern-select" value={committeeIdx} onChange={handleCommitteeChange}>
                    <option value="" disabled>Select your committee...</option>
                    {COMMITTEE_DATA.map((c: any, i: number) => (
                        <option key={i} value={i}>{c.name}</option>
                    ))}
                </select>
            </div>

            {/* ROLE SELECTION (shown during register) */}
            {isRegistering && (
                <div>
                    <span className="role-label-text">Select your role</span>
                    <div className="role-toggle">
                        <input type="radio" name="role" id="roleOC" value="oc" checked={role === "oc"} onChange={(e) => setRole(e.target.value)} />
                        <label htmlFor="roleOC">🎓 OC<br /><small style={{ opacity: 0.7 }}>(Organising Committee)</small></label>

                        <input type="radio" name="role" id="roleCC" value="cc" checked={role === "cc"} onChange={(e) => setRole(e.target.value)} />
                        <label htmlFor="roleCC">⭐ CC<br /><small style={{ opacity: 0.7 }}>(Core Committee)</small></label>
                    </div>
                </div>
            )}

            {/* CC AUTH KEY (shown during register when CC role selected) */}
            {isRegistering && role === "cc" && (
                <div className="input-group">
                    <label>CC Authentication Key</label>
                    <input type="password" placeholder="Enter the CC secret key" autoComplete="off" value={ccAuthKey} onChange={(e) => setCcAuthKey(e.target.value)} />
                </div>
            )}

            {/* OC NAME SELECTION (shown during register when OC role selected) */}
            {isRegistering && role === "oc" && (
                <div className="input-group">
                    <label>Your Name (from timetable)</label>
                    <select className="modern-select" value={ocName} onChange={(e) => setOcName(e.target.value)}>
                        <option value="" disabled>Select your name...</option>
                        {ocOptions.map((name: string) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* ACTIONS */}
            {!isRegistering ? (
                <div>
                    <button onClick={handleLogin} className="btn-show">Login</button>
                    <div className="auth-footer">
                        New user? <a href="#" onClick={(e) => { e.preventDefault(); setIsRegistering(true); setAuthMsg({ text: '', color: '' }); }}>Create Account</a>
                    </div>
                </div>
            ) : (
                <div>
                    <button onClick={handleRegister} className="btn-show" style={{ background: "#4f46e5", borderColor: "rgba(255, 255, 255, 0.1)" }}>
                        Register Account
                    </button>
                    <div className="auth-footer">
                        Already registered? <a href="#" onClick={(e) => { e.preventDefault(); setIsRegistering(false); setAuthMsg({ text: '', color: '' }); }}>Back to Login</a>
                    </div>
                </div>
            )}

            {authMsg.text && (
                <p style={{ fontSize: "13px", marginTop: "15px", textAlign: "center", minHeight: "15px", fontWeight: 600, color: authMsg.color }}>
                    {authMsg.text}
                </p>
            )}

            <p style={{ fontSize: "10px", color: "rgba(161, 157, 145, 0.45)", textAlign: "center", marginTop: "20px", letterSpacing: "0.3px", lineHeight: 1.5 }}>
                Developed by: Keshav Krishna Singh, Meenakshi S Nair, Vedant Mundra
            </p>
        </div>
    );
}
