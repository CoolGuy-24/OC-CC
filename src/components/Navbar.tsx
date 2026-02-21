"use client";

import { useAuth } from "@/lib/auth";

export default function Navbar({ onAllotWorkClick }: { onAllotWorkClick?: () => void }) {
    const { user, role, logout } = useAuth();

    // For OC or CC, user now contains the explicit name property
    const displayName = user;
    const normalizedRole = role?.toLowerCase() || 'oc';

    return (
        <div className="top-bar">
            <div className="user-info">
                Logged in as <strong id="displayUser">{displayName}</strong>
                <span id="displayRole" className={`role-badge ${normalizedRole}`} style={{ marginLeft: "10px" }}>
                    {normalizedRole === 'cc' ? '⭐ CC' : '🎓 OC'}
                </span>
            </div>
            <div className="top-bar-actions">
                {normalizedRole === 'cc' && (
                    <button id="btnAllotWork" className="btn-allot" onClick={onAllotWorkClick}>
                        + Allot Work
                    </button>
                )}
                <button className="btn-logout" onClick={logout}>
                    Logout
                </button>
            </div>
        </div>
    );
}
