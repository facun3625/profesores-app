import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { toast } from "sonner";

type Institution = { id: string; name: string };

/**
 * Ejemplo de optimistic update
 * 
 * Este hook demuestra cómo hacer actualizaciones optimistas:
 * 1. Actualiza la UI inmediatamente (antes de que el servidor responda)
 * 2. Si el servidor falla, revierte los cambios
 * 3. Muestra feedback visual con toast notifications
 */
export function useCreateInstitutionOptimistic() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { name: string }) =>
            api<Institution>("/institutions", {
                method: "POST",
                body: JSON.stringify(data),
            }),

        // Antes de que se ejecute la mutación
        onMutate: async (newInstitution) => {
            // Cancelar queries en progreso para evitar que sobrescriban nuestro update optimista
            await queryClient.cancelQueries({ queryKey: ["institutions"] });

            // Guardar el estado anterior por si necesitamos revertir
            const previousInstitutions = queryClient.getQueryData<Institution[]>(["institutions"]);

            // Actualizar optimísticamente
            queryClient.setQueryData<Institution[]>(["institutions"], (old = []) => [
                ...old,
                { id: "temp-" + Date.now(), name: newInstitution.name },
            ]);

            // Mostrar toast de loading
            toast.loading("Creando institución...", { id: "create-institution" });

            // Retornar contexto para rollback
            return { previousInstitutions };
        },

        // Si la mutación falla
        onError: (err, newInstitution, context) => {
            // Revertir al estado anterior
            if (context?.previousInstitutions) {
                queryClient.setQueryData(["institutions"], context.previousInstitutions);
            }

            // Mostrar error
            toast.error(err instanceof Error ? err.message : "Error al crear institución", {
                id: "create-institution",
            });
        },

        // Si la mutación tiene éxito
        onSuccess: (data) => {
            toast.success("Institución creada exitosamente", {
                id: "create-institution",
            });
        },

        // Siempre se ejecuta al final (éxito o error)
        onSettled: () => {
            // Refrescar datos del servidor para asegurar consistencia
            queryClient.invalidateQueries({ queryKey: ["institutions"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });
}

/**
 * Hook para eliminar institución con optimistic update
 */
export function useDeleteInstitution() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) =>
            api(`/institutions/${id}`, {
                method: "DELETE",
            }),

        onMutate: async (deletedId) => {
            await queryClient.cancelQueries({ queryKey: ["institutions"] });

            const previousInstitutions = queryClient.getQueryData<Institution[]>(["institutions"]);

            // Remover optimísticamente
            queryClient.setQueryData<Institution[]>(["institutions"], (old = []) =>
                old.filter((inst) => inst.id !== deletedId)
            );

            toast.loading("Eliminando institución...", { id: "delete-institution" });

            return { previousInstitutions };
        },

        onError: (err, deletedId, context) => {
            if (context?.previousInstitutions) {
                queryClient.setQueryData(["institutions"], context.previousInstitutions);
            }

            toast.error(err instanceof Error ? err.message : "Error al eliminar institución", {
                id: "delete-institution",
            });
        },

        onSuccess: () => {
            toast.success("Institución eliminada", {
                id: "delete-institution",
            });
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["institutions"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });
}
