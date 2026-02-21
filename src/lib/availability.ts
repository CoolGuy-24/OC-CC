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

export function findFreeOCsData(day: string, startStr: string, endStr: string) {
    if (!day || !startStr || !endStr) {
        return { error: 'Please select day and time range to check availability.' };
    }

    const startMin = startStr ? timeToMinutes(startStr) : null;
    const endMin = endStr ? timeToMinutes(endStr) : null;

    const freeOCs: { name: string, status: string }[] = [];

    Object.keys(TIMETABLE_DATA).sort().forEach(name => {
        const person = TIMETABLE_DATA[name];

        if (person.fullDays && person.fullDays.includes(day)) return;

        const schedule = person[day];

        if (!schedule) {
            freeOCs.push({ name, status: 'Free all day' });
            return;
        }

        if (startMin === null || endMin === null) return;

        const slots = schedule.split(", ");
        let isFree = true;

        for (const slot of slots) {
            const timeMatch = slot.match(/(\d{2}\.\d{2})-(\d{2}\.\d{2})/);
            if (timeMatch) {
                const slotStart = dotTimeToMinutes(timeMatch[1]);
                const slotEnd = dotTimeToMinutes(timeMatch[2]);
                if (slotStart < endMin && slotEnd > startMin) {
                    isFree = false;
                    break;
                }
            }
        }

        if (isFree) {
            freeOCs.push({ name, status: 'Free at this time' });
        }
    });

    return { freeOCs };
}
