const KEY = "attendance_student_id";

export function getStoredStudentId(): string | null {
  return localStorage.getItem(KEY);
}

export function setStoredStudentId(id: string) {
  localStorage.setItem(KEY, id);
}

export function clearStoredStudentId() {
  localStorage.removeItem(KEY);
}
