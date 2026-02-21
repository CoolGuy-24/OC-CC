"use client";

import { useState } from "react";
import { TIMETABLE_DATA } from "@/data/timetable";
import { useAuth } from "@/lib/auth";
import { COMMITTEE_DATA } from "@/data/committees";

export default function TimetablePopup() {
    const { committee, committeeHasTimetable } = useAuth();

    const [name, setName] = useState('');
    const [day, setDay] = useState('');
    const [popupContent, setPopupContent] = useState<React.ReactNode | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    if (!committeeHasTimetable) return null;

    const myCommittee = COMMITTEE_DATA.find((c: any) => c.name === committee);
    const committeeOCs = myCommittee ? myCommittee.ocs.slice().sort() : [];

    // Valid OCs for timetable dropdown (only those in both committee and timetable)
    const validOCs = committeeOCs.filter((c: any) => TIMETABLE_DATA[c]);

    const showTimetable = () => {
        if (!name || !day) {
            setPopupContent(<p style={{ color: '#ef4444' }}>Please select both a student and a day.</p>);
            setIsOpen(true);
            return;
        }

        const person = TIMETABLE_DATA[name];
        if (!person) {
            setPopupContent(<p style={{ color: '#ef4444' }}>Student data not found.</p>);
            setIsOpen(true);
            return;
        }

        const schedule = person[day];
        if (!schedule) {
            setPopupContent(
                <>
                    <h3 style={{ color: '#00cccc', margin: '0 0 10px 0' }}>{name}</h3>
                    <p style={{ color: '#4ade80' }}>✅ Free all day on {day}!</p>
                </>
            );
            setIsOpen(true);
            return;
        }

        const slots = schedule.split(", ");
        const isFullDay = person.fullDays && person.fullDays.includes(day);

        setPopupContent(
            <>
                <h3 style={{ color: '#00cccc', margin: '0 0 10px 0' }}>{name} — {day}</h3>
                {isFullDay && <p style={{ color: '#ef4444', fontWeight: 600 }}>⚠ Full day busy</p>}
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {slots.map((slot: string, i: number) => (
                        <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#ccc' }}>
                            {slot}
                        </li>
                    ))}
                </ul>
            </>
        );
        setIsOpen(true);
    };

    return (
        <div className="timetable-section">
            <h3 style={{ color: "var(--accent)", margin: "0 0 5px 0", fontSize: "16px" }}>OC Schedule Checker</h3>
            <p className="sub">Check an OC's timetable for a specific day</p>

            <div className="input-group">
                <label>OC Name</label>
                <select className="modern-select" value={name} onChange={(e) => setName(e.target.value)}>
                    <option value="" disabled>Choose a student...</option>
                    {validOCs.map((oc: string) => (
                        <option key={oc} value={oc}>{oc}</option>
                    ))}
                </select>
            </div>

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

            <button className="btn-show" onClick={showTimetable}>Show Timetable</button>

            {/* Popup Modal */}
            {isOpen && (
                <div className="popup-overlay" style={{ display: 'flex' }} onClick={() => setIsOpen(false)}>
                    <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                        <span className="close-btn" onClick={() => setIsOpen(false)}>&times;</span>
                        {popupContent}
                    </div>
                </div>
            )}
        </div>
    );
}
