"use client";

import { useState } from "react";
import { isTaskOverdue, formatDeadlineDDMMYYYY, formatDateDDMMYYYY } from "@/lib/availability";

export default function TaskCard({ task, roleView, onComplete }: { task: any, roleView: string, onComplete?: (taskId: string) => void }) {
    const [expanded, setExpanded] = useState(false);

    const desc = task.description || '';
    const overdue = isTaskOverdue(task);
    const isImmediate = task.type === 'immediate';

    let cardClass = `task-card ${task.status}`;
    if (isImmediate && task.status === 'pending') cardClass += ' type-immediate';
    if (overdue) cardClass += ' overdue';
    if (expanded) cardClass += ' expanded';

    let typeBadge = null;
    if (isImmediate && task.status === 'pending') {
        typeBadge = <span className="task-type-badge badge-immediate">⚡ Immediate</span>;
    } else if (overdue) {
        typeBadge = <span className="task-type-badge badge-overdue">🔴 Overdue</span>;
    }

    const whoLabel = roleView === 'cc' ? 'Assigned To' : 'Assigned By';
    const whoValue = roleView === 'cc' ? (task.assignedToName || task.assignedTo) : (task.assignedByName || task.assignedBy);
    const whoClass = roleView === 'cc' ? 'accent' : 'gold';

    const deadlineClass = overdue ? 'danger' : 'danger';
    const overdueLabel = overdue ? ' — OVERDUE' : '';

    return (
        <div className={cardClass}>
            <div className="task-card-header" onClick={() => setExpanded(!expanded)}>
                <span className={`task-status-badge ${task.status}`}>
                    {task.status === 'pending' ? '⏳' : '✅'}
                </span>
                <span className="task-title" style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 600, color: '#f1f1f1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {task.title || (desc.length > 60 ? desc.substring(0, 60) + '…' : desc) || 'Untitled Task'}
                </span>
                {typeBadge}
                <span className="task-chevron">▼</span>
            </div>

            <div className="task-card-body">
                {desc && <div className="task-description">{desc}</div>}
                <div className="task-meta-grid">
                    <div className="task-meta-item">
                        <span className="meta-icon">👤</span>
                        <div>
                            <span className="meta-label">{whoLabel}</span>
                            <span className={`meta-value ${whoClass}`}>{whoValue}</span>
                        </div>
                    </div>
                    <div className="task-meta-item">
                        <span className="meta-icon">📅</span>
                        <div>
                            <span className="meta-label">Date Assigned</span>
                            <span className="meta-value">{formatDateDDMMYYYY(task.createdAt)}</span>
                        </div>
                    </div>

                    {task.deadline && (
                        <div className="task-meta-item">
                            <span className="meta-icon">⏰</span>
                            <div>
                                <span className="meta-label">Deadline</span>
                                <span className={`meta-value ${deadlineClass}`}>{formatDeadlineDDMMYYYY(task.deadline)}{overdueLabel}</span>
                            </div>
                        </div>
                    )}

                    {task.completedAt && (
                        <div className="task-meta-item">
                            <span className="meta-icon">✅</span>
                            <div>
                                <span className="meta-label">Completed</span>
                                <span className="meta-value success">{formatDateDDMMYYYY(task.completedAt)}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="task-card-footer">
                    <span className={`task-status-badge ${task.status}`}>
                        {task.status === 'pending' ? '⏳ Pending' : '✅ Completed'}
                    </span>
                    {(roleView === 'oc' && task.status === 'pending' && onComplete) && (
                        <button
                            className="btn-complete"
                            onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
                        >
                            Mark Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
