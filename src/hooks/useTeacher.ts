const KEY = "attendance_teacher_id";

export function getStoredTeacherId(): string | null {
  return localStorage.getItem(KEY);
}

export function setStoredTeacherId(id: string) {
  localStorage.setItem(KEY, id);
}

export function clearStoredTeacherId() {
  localStorage.removeItem(KEY);
}
