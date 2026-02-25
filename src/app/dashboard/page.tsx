"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { sortTasksPrioritized, isTaskOverdue } from "@/lib/availability";
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
    const [editingTask, setEditingTask] = useState<any>(null);
    const [dateFilter, setDateFilter] = useState<string>("");

    const handleEditTask = (task: any) => {
        setEditingTask(task);
        setIsModalOpen(true);
    };

    useEffect(() => {
        if (!isLoggedIn) {
            router.push("/login");
        } else {
            loadTasks();
        }
    }, [isLoggedIn, router]);

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

            if (committee) allTasks = allTasks.filter(t => t.committee === committee);

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

    const currentFilter = normalizedRole === 'cc' ? ccFilter : ocFilter;

    let displayTasks = tasks;

    if (currentFilter === 'pending') {
        displayTasks = displayTasks.filter(t => t.status === 'pending' && (!isTaskOverdue(t) || t.type === 'immediate'));
    } else if (currentFilter === 'overdue') {
        displayTasks = displayTasks.filter(t => t.status === 'pending' && isTaskOverdue(t) && t.type !== 'immediate');
    } else if (currentFilter === 'completed') {
        displayTasks = displayTasks.filter(t => t.status === 'completed');
    }

    if (dateFilter && currentFilter !== 'all') {
        displayTasks = displayTasks.filter(t => {
            if (!t.createdAt) return false;
            const date = new Date(t.createdAt);
            const localDate = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
            return localDate === dateFilter;
        });
    }

    const immediateTasks = displayTasks.filter(t => t.type === 'immediate' && t.status === 'pending');
    const overdueTasks = displayTasks.filter(t => t.status === 'pending' && t.type !== 'immediate' && isTaskOverdue(t));
    const pendingTasks = displayTasks.filter(t => t.status === 'pending' && t.type !== 'immediate' && !isTaskOverdue(t));
    const completedTasks = displayTasks.filter(t => t.status === 'completed');

    return (
        <>
            <Navbar onAllotWorkClick={() => { setEditingTask(null); setIsModalOpen(true); }} />

            {normalizedRole === 'cc' && committeeHasTimetable && <TimetablePopup />}

            <div className="task-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                        {normalizedRole === 'cc' ? (
                            <>
                                <h3 style={{ color: "var(--accent)", margin: "0 0 5px 0", fontSize: "16px" }}>Allocated Tasks</h3>
                                <p style={{ margin: 0 }}>Monitor tasks you have assigned to your OCs</p>
                            </>
                        ) : (
                            <>
                                <h3 style={{ color: "var(--accent)", margin: "0 0 5px 0", fontSize: "16px" }}>Your Tasks</h3>
                                <p style={{ margin: 0 }}>Tasks assigned to you by your CC</p>
                            </>
                        )}
                    </div>
                    <div className="date-filter" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Date:</label>
                        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="modern-select" style={{ padding: "6px 10px", width: "auto" }} />
                    </div>
                </div>

                <div className="task-tabs" style={{ marginBottom: "20px" }}>
                    <button className={`task-tab ${currentFilter === 'all' ? 'active' : ''}`} onClick={() => normalizedRole === 'cc' ? setCcFilter('all') : setOcFilter('all')}>All Tasks</button>
                    <button className={`task-tab ${currentFilter === 'pending' ? 'active' : ''}`} onClick={() => normalizedRole === 'cc' ? setCcFilter('pending') : setOcFilter('pending')}>Pending</button>
                    <button className={`task-tab ${currentFilter === 'overdue' ? 'active' : ''}`} onClick={() => normalizedRole === 'cc' ? setCcFilter('overdue') : setOcFilter('overdue')}>Overdue</button>
                    <button className={`task-tab ${currentFilter === 'completed' ? 'active' : ''}`} onClick={() => normalizedRole === 'cc' ? setCcFilter('completed') : setOcFilter('completed')}>Completed</button>
                </div>

                <div>
                    {displayTasks.length === 0 ? (
                        <div className="no-tasks">
                            {tasks.length === 0 ? (normalizedRole === 'cc' ? 'No tasks found. Click "+ Allot Work" to assign tasks to OCs.' : 'No tasks assigned to you yet. Check back later!') : 'No tasks match your filters.'}
                        </div>
                    ) : (
                        <>
                            {immediateTasks.length > 0 && (
                                <div style={{ marginBottom: "20px" }}>
                                    <h4 style={{ color: "var(--accent)", margin: "0 0 10px 0", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>⚡ Immediate Tasks</h4>
                                    {immediateTasks.map(t => <TaskCard key={t.id || t.firebaseId} task={t} roleView={normalizedRole} onComplete={handleCompleteTask} onDelete={handleDeleteTask} onEdit={handleEditTask} />)}
                                </div>
                            )}
                            {overdueTasks.length > 0 && (
                                <div style={{ marginBottom: "20px" }}>
                                    <h4 style={{ color: "#ef4444", margin: "0 0 10px 0", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>🔴 Overdue Tasks</h4>
                                    {overdueTasks.map(t => <TaskCard key={t.id || t.firebaseId} task={t} roleView={normalizedRole} onComplete={handleCompleteTask} onDelete={handleDeleteTask} onEdit={handleEditTask} />)}
                                </div>
                            )}
                            {pendingTasks.length > 0 && (
                                <div style={{ marginBottom: "20px" }}>
                                    <h4 style={{ color: "var(--text-primary)", margin: "0 0 10px 0", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>⏳ Pending Tasks</h4>
                                    {pendingTasks.map(t => <TaskCard key={t.id || t.firebaseId} task={t} roleView={normalizedRole} onComplete={handleCompleteTask} onDelete={handleDeleteTask} onEdit={handleEditTask} />)}
                                </div>
                            )}
                            {completedTasks.length > 0 && (
                                <div style={{ marginBottom: "20px" }}>
                                    <h4 style={{ color: "#34d399", margin: "0 0 10px 0", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>✅ Completed Tasks</h4>
                                    {completedTasks.map(t => <TaskCard key={t.id || t.firebaseId} task={t} roleView={normalizedRole} onComplete={handleCompleteTask} onDelete={handleDeleteTask} onEdit={handleEditTask} />)}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <TaskModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTask(null); }} onAssigned={loadTasks} taskToEdit={editingTask} />
        </>
    );
}
