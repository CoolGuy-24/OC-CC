"use client";

import { useState } from "react";
import { findFreeOCsData } from "@/lib/availability";
import { generateTaskId } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { TIMETABLE_DATA } from "@/data/timetable";
import { COMMITTEE_DATA } from "@/data/committees";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function TaskModal({ isOpen, onClose, onAssigned }: { isOpen: boolean, onClose: () => void, onAssigned: () => void }) {
    const { uid, user, committee, committeeHasTimetable } = useAuth();

    const [workMode, setWorkMode] = useState<'immediate' | 'scheduled'>('immediate');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    // Scheduled Date & Time
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('');

    // Immediate availability check
    const [day, setDay] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');

    const [selectedOCs, setSelectedOCs] = useState<string[]>([]);

    if (!isOpen) return null;

    // List of OCs for the current CC's committee
    const myCommittee = COMMITTEE_DATA.find((c: any) => c.name === committee);
    const committeeOCs = myCommittee ? myCommittee.ocs.slice().sort() : [];

    const { freeOCs, error } = findFreeOCsData(day, start, end);

    const toggleOCSelection = (name: string) => {
        if (selectedOCs.includes(name)) {
            setSelectedOCs(selectedOCs.filter(n => n !== name));
        } else {
            setSelectedOCs([...selectedOCs, name]);
        }
    };

    const handleAssign = async () => {
        if (selectedOCs.length === 0) {
            alert("Please select at least one OC.");
            return;
        }

        if (!title.trim()) {
            alert("Please enter a task title.");
            return;
        }

        let deadline = "";
        if (workMode === "scheduled" && deadlineDate) {
            deadline = deadlineDate;
            if (deadlineTime) deadline += " " + deadlineTime;
        }

        try {
            // 1️⃣ Fetch all users of this committee
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("committee", "==", committee));
            const querySnapshot = await getDocs(q);

            // 2️⃣ Map OC display name → UID
            const ocUids: Record<string, string> = {};

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.role === "OC" && data.name) {
                    ocUids[data.name] = docSnap.id; // docSnap.id is UID
                }
            });

            // 3️⃣ Create tasks
            const taskPromises = selectedOCs.map(async (ocName: string) => {
                const assignedToUid = ocUids[ocName];

                if (!assignedToUid) {
                    console.error("UID not found for OC:", ocName);
                    return;
                }

                const taskId = generateTaskId();

                await setDoc(doc(db, "tasks", taskId), {
                    id: taskId,
                    assignedTo: assignedToUid,   // ✅ REAL UID
                    assignedToName: ocName,
                    assignedBy: uid,
                    assignedByName: user,
                    title: title.trim(),
                    description: description.trim(),
                    type: workMode,
                    deadline: deadline,
                    committee: committee,
                    status: "pending",
                    createdAt: new Date().toISOString(),
                    completedAt: ""
                });
            });

            await Promise.all(taskPromises);

            onAssigned();
            onClose();

            // Reset form
            setTitle("");
            setDescription("");
            setDeadlineDate("");
            setDeadlineTime("");
            setDay("");
            setStart("");
            setEnd("");
            setSelectedOCs([]);

        } catch (error) {
            console.error("Error creating tasks:", error);
            alert("Failed to assign tasks. Please check your connection.");
        }
    };

    return (
        <div className="task-modal-overlay" style={{ display: 'flex' }}>
            <div className="task-modal">
                <h2>Allot New Work</h2>
                <p>Assign tasks to OCs in your committee and track their progress.</p>

                <div className="work-toggle">
                    <button
                        className={`toggle-btn ${workMode === 'immediate' ? 'active' : ''}`}
                        onClick={() => { setWorkMode('immediate'); setSelectedOCs([]); }}
                    >
                        ⚡ Immediate Task
                    </button>
                    <button
                        className={`toggle-btn ${workMode === 'scheduled' ? 'active' : ''}`}
                        onClick={() => { setWorkMode('scheduled'); setSelectedOCs([]); }}
                    >
                        📅 Scheduled Task
                    </button>
                </div>

                <div className="input-group">
                    <label>Task Title *</label>
                    <input
                        type="text"
                        placeholder="Short summary of the task..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>

                <div className="input-group">
                    <label>Description & Requirements</label>
                    <textarea
                        rows={3}
                        placeholder="Provide details, location, and instructions..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    ></textarea>
                </div>

                {/* Immediate Section */}
                {workMode === 'immediate' && (
                    <div id="immediateSection">
                        {!committeeHasTimetable ? (
                            <div className="no-free-msg">
                                ⚠ Your committee does not have valid timetable data for availability checking.
                            </div>
                        ) : (
                            <div className="modal-row">
                                <div className="input-group">
                                    <label>Day</label>
                                    <select className="modern-select" value={day} onChange={(e) => setDay(e.target.value)}>
                                        <option value="" disabled>Select day...</option>
                                        <option value="Monday">Monday</option>
                                        <option value="Tuesday">Tuesday</option>
                                        <option value="Wednesday">Wednesday</option>
                                        <option value="Thursday">Thursday</option>
                                        <option value="Friday">Friday</option>
                                        <option value="Saturday">Saturday</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>From Time</label>
                                    <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>To Time</label>
                                    <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                                </div>
                            </div>
                        )}

                        {committeeHasTimetable ? (
                            <div id="freeOCsList">
                                {error && <div className="availability-helper">{error}</div>}
                                {!error && freeOCs && freeOCs.length === 0 && (
                                    <div className="oc-checklist"><div className="no-free-msg">No OCs are free at the selected time.</div></div>
                                )}
                                {!error && freeOCs && freeOCs.length > 0 && (
                                    <div className="oc-checklist">
                                        <h4>✅ Available OCs ({freeOCs.length}) — select one or more</h4>
                                        {freeOCs.filter((o: any) => committeeOCs.includes(o.name)).map((oc: any) => (
                                            <label key={oc.name} className={`oc-check-item ${selectedOCs.includes(oc.name) ? 'checked' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOCs.includes(oc.name)}
                                                    onChange={() => toggleOCSelection(oc.name)}
                                                />
                                                <span>{oc.name}</span>
                                                <div style={{ display: "flex", flexDirection: "column" }}>
                                                    <span className="oc-status">{oc.status}</span>
                                                    {oc.freeMinutes > 0 && (
                                                        <span style={{ fontSize: "0.8rem", color: "#8b949e", marginTop: "2px" }}>
                                                            Total Free: {Math.floor(oc.freeMinutes / 60)}h {oc.freeMinutes % 60}m
                                                        </span>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            // List ALL OCs for committees with no timetable
                            <div className="oc-checklist">
                                <h4>👥 Select OCs — choose one or more</h4>
                                {committeeOCs.map((name: string) => (
                                    <label key={name} className={`oc-check-item ${selectedOCs.includes(name) ? 'checked' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedOCs.includes(name)}
                                            onChange={() => toggleOCSelection(name)}
                                        />
                                        <span>{name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Scheduled Section */}
                {workMode === 'scheduled' && (
                    <>
                        <div className="modal-row" id="deadlineRow">
                            <div className="input-group">
                                <label>Deadline Date</label>
                                <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>Deadline Time (optional)</label>
                                <input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} />
                            </div>
                        </div>

                        <div id="scheduledOCsList">
                            <div className="oc-checklist">
                                <h4>👥 Select OCs ({committeeOCs.length} available) — choose one or more</h4>
                                {committeeOCs.map((name: string) => (
                                    <label key={name} className={`oc-check-item ${selectedOCs.includes(name) ? 'checked' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedOCs.includes(name)}
                                            onChange={() => toggleOCSelection(name)}
                                        />
                                        <span>{name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                <div id="selectedOCTags" className="selected-tags">
                    {selectedOCs.map((name: string) => (
                        <span key={name} className="selected-tag">
                            {name}
                            <span className="tag-remove" onClick={() => toggleOCSelection(name)}>&times;</span>
                        </span>
                    ))}
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onClose}>Cancel</button>
                    <button className="btn-assign" onClick={handleAssign}>Assign to Selected OCs</button>
                </div>
            </div>
        </div>
    );
}
