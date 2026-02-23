import { TIMETABLE_DATA } from "@/data/timetable";

export function timeToMinutes(timeStr: string) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

export function dotTimeToMinutes(dotStr: string) {
    const [h, m] = dotStr.split('.').map(Number);
    return h * 60 + m;
}

export function isTaskOverdue(task: any) {
    if (task.status === 'completed' || !task.deadline) return false;
    const parts = task.deadline.split(' ');
    let deadlineDate;
    if (parts[1]) {
        deadlineDate = new Date(parts[0] + 'T' + parts[1] + ':00');
    } else {
        deadlineDate = new Date(parts[0] + 'T23:59:59');
    }
    return !isNaN(deadlineDate.getTime()) && new Date() > deadlineDate;
}

export function getDeadlineTimestamp(task: any) {
    if (!task.deadline) return Infinity;
    const parts = task.deadline.split(' ');
    let d;
    if (parts[1]) {
        d = new Date(parts[0] + 'T' + parts[1] + ':00');
    } else {
        d = new Date(parts[0] + 'T23:59:59');
    }
    return isNaN(d.getTime()) ? Infinity : d.getTime();
}

export function sortTasksPrioritized(tasks: any[]) {
    return tasks.sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;

        const aImm = (a.type === 'immediate') ? 1 : 0;
        const bImm = (b.type === 'immediate') ? 1 : 0;
        if (aImm !== bImm) return bImm - aImm;

        return getDeadlineTimestamp(a) - getDeadlineTimestamp(b);
    });
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function pad2(n: number) { return String(n).padStart(2, '0'); }

function parseFuzzyDate(str: string) {
    if (!str) return null;
    let d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    return null;
}

export function formatDateDDMMYYYY(raw: string) {
    const d = parseFuzzyDate(raw);
    if (!d) return raw || '—';
    return `${pad2(d.getDate())} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDeadlineDDMMYYYY(raw: string) {
    if (!raw) return '—';
    const parts = raw.split(' ');
    const dateParts = parts[0].split('-');
    if (dateParts.length === 3) {
        const day = pad2(Number(dateParts[2]));
        const mon = MONTH_NAMES[Number(dateParts[1]) - 1] || dateParts[1];
        const year = dateParts[0];
        const formatted = `${day} ${mon} ${year}`;
        if (parts[1]) return `${formatted} ${parts[1]}`;
        return formatted;
    }
    return raw;
}

export function minutesToTimeStr(mins: number) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${pad2(h)}:${pad2(m)}`;
}

export function findFreeOCsData(day: string, startStr: string, endStr: string) {
    if (!day || !startStr || !endStr) {
        return { error: 'Please select day and time range to check availability.' };
    }

    const startMin = startStr ? timeToMinutes(startStr) : null;
    const endMin = endStr ? timeToMinutes(endStr) : null;

    if (startMin !== null && endMin !== null && endMin <= startMin) {
        return { error: 'To time must be after From time.' };
    }

    const freeOCs: { name: string, status: string, freeMinutes: number }[] = [];

    if (startMin === null || endMin === null) return { freeOCs };

    const totalRequestedMinutes = endMin - startMin;

    Object.keys(TIMETABLE_DATA).sort().forEach(name => {
        const person = TIMETABLE_DATA[name];
        const schedule = person[day];

        const busyPeriods: { start: number, end: number }[] = [];

        // Adding explicit "busy" blocks for universal free times so they don't get reported
        const universalBreaks = [
            { start: timeToMinutes("10:00"), end: timeToMinutes("10:30") },
            { start: timeToMinutes("15:00"), end: timeToMinutes("15:30") }
        ];

        for (const breakTime of universalBreaks) {
            const overlapStart = Math.max(breakTime.start, startMin);
            const overlapEnd = Math.min(breakTime.end, endMin);
            if (overlapStart < overlapEnd) {
                busyPeriods.push({ start: overlapStart, end: overlapEnd });
            }
        }

        if (schedule) {
            const slots = schedule.split(", ");
            for (const slot of slots) {
                const timeMatch = slot.match(/(\d{2}\.\d{2})-(\d{2}\.\d{2})/);
                if (timeMatch) {
                    const slotStart = dotTimeToMinutes(timeMatch[1]);
                    const slotEnd = dotTimeToMinutes(timeMatch[2]);

                    // Keep only the part of the busy slot that overlaps with our requested range
                    const overlapStart = Math.max(slotStart, startMin);
                    const overlapEnd = Math.min(slotEnd, endMin);

                    if (overlapStart < overlapEnd) {
                        busyPeriods.push({ start: overlapStart, end: overlapEnd });
                    }
                }
            }
        }

        // If no overlapping busy periods, they are completely free during the requested time
        if (busyPeriods.length === 0) {
            freeOCs.push({ name, status: 'Free at this time', freeMinutes: totalRequestedMinutes });
            return;
        }

        // Merge busy periods (just in case they overlap in the timetable)
        busyPeriods.sort((a, b) => a.start - b.start);
        const mergedBusy: { start: number, end: number }[] = [];
        for (const p of busyPeriods) {
            if (mergedBusy.length === 0) {
                mergedBusy.push(p);
            } else {
                const last = mergedBusy[mergedBusy.length - 1];
                if (p.start <= last.end) {
                    last.end = Math.max(last.end, p.end);
                } else {
                    mergedBusy.push(p);
                }
            }
        }

        // Calculate free periods within [startMin, endMin] by subtracting merged busy periods
        const freePeriods: { start: number, end: number }[] = [];
        let cursor = startMin;

        for (const p of mergedBusy) {
            if (cursor < p.start) {
                freePeriods.push({ start: cursor, end: p.start });
            }
            cursor = Math.max(cursor, p.end);
        }
        if (cursor < endMin) {
            freePeriods.push({ start: cursor, end: endMin });
        }

        // Calculate total free time for this OC
        let totalFreeMinutes = 0;
        for (const p of freePeriods) {
            totalFreeMinutes += (p.end - p.start);
        }

        // If there are any free gaps during the requested time, we list them
        if (freePeriods.length > 0) {
            // Check if this perfectly matches the entire duration after trimming breaks
            // Or just check if the total calculated free time == expected max free time minus breaks
            let expectedMaxFreeTime = totalRequestedMinutes;
            for (const breakTime of universalBreaks) {
                const overlapStart = Math.max(breakTime.start, startMin);
                const overlapEnd = Math.min(breakTime.end, endMin);
                if (overlapStart < overlapEnd) {
                    expectedMaxFreeTime -= (overlapEnd - overlapStart);
                }
            }

            if (totalFreeMinutes === expectedMaxFreeTime && totalFreeMinutes > 0) {
                freeOCs.push({ name, status: 'Free at this time', freeMinutes: totalFreeMinutes });
            } else {
                const statusStrings = freePeriods.map(p => {
                    return `Free ${minutesToTimeStr(p.start)} - ${minutesToTimeStr(p.end)}`;
                });
                freeOCs.push({ name, status: statusStrings.join(', '), freeMinutes: totalFreeMinutes });
            }
        }
    });

    // Sort OCs by most free time first
    freeOCs.sort((a, b) => b.freeMinutes - a.freeMinutes);

    return { freeOCs };
}
