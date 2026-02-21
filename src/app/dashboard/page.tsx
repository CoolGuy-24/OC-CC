"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { sortTasksPrioritized } from "@/lib/availability";
import { CC_AUTH_KEY } from "@/data/config";
import Navbar from "@/components/Navbar";
import TaskCard from "@/components/TaskCard";
import TaskModal from "@/components/TaskModal";
import TimetablePopup from "@/components/TimetablePopup";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function DashboardPage() {
    const { isLoggedIn, role, uid, user, committee, committeeHasTimetable } = useAuth();
    const router = useRouter();

    const normalizedRole = role?.toLowerCase() || "oc";

    const [tasks, setTasks] = useState<any[]>([]);
    const [ccFilter, setCcFilter] = useState("all");
    const [ocFilter, setOcFilter] = useState("all");
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!isLoggedIn) {
            router.push("/login");
        } else {
            loadTasks();
        }
    }, [isLoggedIn, router, ccFilter, ocFilter]);

    const loadTasks = async () => {
        if (!uid) return;

        try {
            const tasksRef = collection(db, "tasks");
            let q;
            if (normalizedRole === 'cc') {
                q = query(tasksRef, where("assignedBy", "==", uid));
            } else {
                q = query(tasksRef, where("assignedTo", "==", uid));
            }

            const querySnapshot = await getDocs(q);
            let allTasks: any[] = [];
            querySnapshot.forEach((docSnap) => {
                allTasks.push({ firebaseId: docSnap.id, ...docSnap.data() });
            });

            if (normalizedRole === 'cc') {
                if (committee) allTasks = allTasks.filter(t => t.committee === committee);
                if (ccFilter !== 'all') allTasks = allTasks.filter(t => t.status === ccFilter);
            } else {
                if (committee) allTasks = allTasks.filter(t => t.committee === committee);
                if (ocFilter !== 'all') allTasks = allTasks.filter(t => t.status === ocFilter);
            }

            setTasks(sortTasksPrioritized(allTasks));
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
    };

    const handleCompleteTask = async (taskId: string) => {
        try {
            const taskRef = doc(db, "tasks", taskId);
            await updateDoc(taskRef, {
                status: 'completed',
                completedAt: new Date().toISOString()
            });
            loadTasks();
        } catch (error) {
            console.error("Error completing task: ", error);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm("Are you sure you want to delete this task?")) return;
        try {
            await deleteDoc(doc(db, "tasks", taskId));
            loadTasks();
        } catch (error) {
            console.error("Error deleting task: ", error);
            alert("Failed to delete task. You might not have permission.");
        }
    };

    if (!isLoggedIn) return null; // Avoid flicker before redirect

    const immediateTasks = tasks.filter(t => t.type === 'immediate' && t.status === 'pending');
    const otherTasks = tasks.filter(t => !(t.type === 'immediate' && t.status === 'pending'));

    return (
        <>
            <Navbar onAllotWorkClick={() => setIsModalOpen(true)} />

            {normalizedRole === 'cc' && committeeHasTimetable && <TimetablePopup />}

            <div className="task-section">
                {normalizedRole === 'cc' ? (
                    <>
                        <h3 style={{ color: "var(--accent)", margin: "0 0 5px 0", fontSize: "16px" }}>Allocated Tasks</h3>
                        <p>Monitor tasks you have assigned to your OCs</p>

                        <div className="task-tabs">
                            <button className={`task-tab ${ccFilter === 'all' ? 'active' : ''}`} onClick={() => setCcFilter('all')}>All Tasks</button>
                            <button className={`task-tab ${ccFilter === 'pending' ? 'active' : ''}`} onClick={() => setCcFilter('pending')}>Pending</button>
                            <button className={`task-tab ${ccFilter === 'completed' ? 'active' : ''}`} onClick={() => setCcFilter('completed')}>Completed</button>
                        </div>
                    </>
                ) : (
                    <>
                        <h3 style={{ color: "var(--accent)", margin: "0 0 5px 0", fontSize: "16px" }}>Your Tasks</h3>
                        <p>Tasks assigned to you by your CC</p>

                        <div className="task-tabs">
                            <button className={`task-tab ${ocFilter === 'all' ? 'active' : ''}`} onClick={() => setOcFilter('all')}>All Tasks</button>
                            <button className={`task-tab ${ocFilter === 'pending' ? 'active' : ''}`} onClick={() => setOcFilter('pending')}>Pending</button>
                            <button className={`task-tab ${ocFilter === 'completed' ? 'active' : ''}`} onClick={() => setOcFilter('completed')}>Completed</button>
                        </div>
                    </>
                )}

                <div>
                    {tasks.length === 0 ? (
                        <div className="no-tasks">
                            {normalizedRole === 'cc' ? 'No tasks found. Click "+ Allot Work" to assign tasks to OCs.' : 'No tasks assigned to you yet. Check back later!'}
                        </div>
                    ) : (
                        <>
                            {immediateTasks.length > 0 && (
                                <>
                                    {immediateTasks.map(t => <TaskCard key={t.id} task={t} roleView={normalizedRole} onComplete={handleCompleteTask} onDelete={handleDeleteTask} />)}
                                    {otherTasks.length > 0 && <div className="task-section-divider">Scheduled Tasks</div>}
                                </>
                            )}
                            {otherTasks.map(t => <TaskCard key={t.id} task={t} roleView={normalizedRole} onComplete={handleCompleteTask} onDelete={handleDeleteTask} />)}
                        </>
                    )}
                </div>
            </div>

            <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAssigned={loadTasks} />
        </>
    );
}
