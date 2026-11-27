import { api } from "@/lib/api";

export type Course = {
  id: string;
  name: string;
  year: number | null;
  archived: boolean;
  _count?: { exams: number };
};

export function courseLabel(c: Pick<Course, "name" | "year">) {
  return c.year ? `${c.name} (${c.year})` : c.name;
}

export function fetchCourses(includeArchived = false) {
  return api<Course[]>(`/courses${includeArchived ? "?includeArchived=true" : ""}`);
}
