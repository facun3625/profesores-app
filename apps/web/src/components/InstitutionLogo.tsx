"use client";

import ImageAttachment from "@/components/ImageAttachment";

/**
 * Logo de la institución: vista previa + subir/cambiar/quitar (solo admins).
 * Se imprime en el encabezado de los exámenes (PDF y Word).
 */
export default function InstitutionLogo({
  institutionId,
  hasLogo,
  canEdit,
  onChanged,
}: {
  institutionId: string;
  hasLogo?: boolean;
  canEdit: boolean;
  onChanged?: () => void;
}) {
  return (
    <ImageAttachment
      endpoint={`/institutions/${institutionId}/logo`}
      hasImage={hasLogo}
      canEdit={canEdit}
      maxBytes={500 * 1024}
      addLabel="Subir logo"
      changeLabel="Cambiar logo"
      successMessage="Logo actualizado. Se va a ver en el encabezado de los exámenes."
      onChanged={onChanged}
    />
  );
}
