export function getUsers() {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem('oc_users') || '[]');
}

export function saveUsers(users: any[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem('oc_users', JSON.stringify(users));
}

export function findUser(username: string) {
    return getUsers().find((u: any) => u.username === username);
}

export function getTasks() {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem('oc_tasks') || '[]');
}

export function saveTasks(tasks: any[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem('oc_tasks', JSON.stringify(tasks));
}

export function generateTaskId() {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}
