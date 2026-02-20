import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { getMe } from "./auth";

// Types (temporalmente aquí hasta que arreglemos el paquete de tipos)
type Institution = { id: string; name: string };
type Subject = { id: string; name: string };
type Exam = { id: string; title: string };

/**
 * Hook para obtener el usuario actual y su rol
 */
export function useMe() {
    return useQuery({
        queryKey: ["me"],
        queryFn: () => getMe() as Promise<any>,
        staleTime: 30_000,
    });
}

/**
 * Hook que devuelve true si el usuario activo es admin (o si aún no cargó, para no bloquear UI)
 */
export function useIsAdmin() {
    const { data } = useMe();
    // Si todavía no cargó el rol, asumimos admin para no bloquear la UI momentáneamente
    if (!data) return true;
    const role = data?.user?.activeRole;
    return role === "admin" || role == null;
}



/**
 * Hook para obtener instituciones
 */
export function useInstitutions() {
    return useQuery({
        queryKey: ["institutions"],
        queryFn: () => api<Institution[]>("/institutions"),
    });
}

/**
 * Hook para obtener materias
 */
export function useSubjects() {
    return useQuery({
        queryKey: ["subjects"],
        queryFn: () => api<Subject[]>("/subjects"),
    });
}

/**
 * Hook para obtener exámenes
 */
export function useExams() {
    return useQuery({
        queryKey: ["exams"],
        queryFn: () => api<Exam[]>("/exams"),
    });
}

/**
 * Hook para obtener datos del dashboard (optimizado con Promise.all)
 */
export function useDashboardData() {
    return useQuery({
        queryKey: ["dashboard"],
        queryFn: async () => {
            const [institutions, subjects, exams] = await Promise.all([
                api<Institution[]>("/institutions"),
                api<Subject[]>("/subjects"),
                api<Exam[]>("/exams"),
            ]);
            return { institutions, subjects, exams };
        },
    });
}

/**
 * Hook para crear una institución
 */
export function useCreateInstitution() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { name: string }) =>
            api<Institution>("/institutions", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            // Invalidar cache para refrescar la lista
            queryClient.invalidateQueries({ queryKey: ["institutions"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });
}

/**
 * Hook para crear una materia
 */
export function useCreateSubject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { name: string; institutionId: string }) =>
            api<Subject>("/subjects", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subjects"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });
}

/**
 * Hook para crear un examen
 */
export function useCreateExam() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { title: string; description?: string; institutionId: string }) =>
            api<Exam>("/exams", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["exams"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });
}
