"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, apiBlob } from "@/lib/api";

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

/**
 * Imagen adjunta a un recurso (logo de institución, imagen de pregunta):
 * vista previa + subir / cambiar / quitar. El endpoint acepta GET, PUT y DELETE.
 */
export default function ImageAttachment({
  endpoint,
  hasImage,
  canEdit,
  maxBytes,
  addLabel,
  changeLabel,
  successMessage,
  previewClassName = "h-8 max-w-[120px]",
  onChanged,
}: {
  endpoint: string;
  hasImage?: boolean;
  canEdit: boolean;
  maxBytes: number;
  addLabel: string;
  changeLabel: string;
  successMessage: string;
  previewClassName?: string;
  onChanged?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  // Estado local: después de subir/quitar no hay que esperar a recargar la lista
  const [present, setPresent] = useState(Boolean(hasImage));
  useEffect(() => setPresent(Boolean(hasImage)), [hasImage]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    if (!present) {
      setUrl(null);
      return;
    }
    apiBlob(`${endpoint}?v=${version}`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [endpoint, present, version]);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("La imagen tiene que ser PNG o JPG");
      return;
    }
    if (file.size > maxBytes) {
      toast.error(`La imagen no puede pesar más de ${Math.round(maxBytes / 1024)} KB`);
      return;
    }
    setBusy(true);
    try {
      await api(endpoint, {
        method: "PUT",
        body: JSON.stringify({ data: await readAsBase64(file), mimeType: file.type }),
      });
      toast.success(successMessage);
      setPresent(true);
      setVersion((v) => v + 1);
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(endpoint, { method: "DELETE" });
      toast.success("Imagen quitada");
      setPresent(false);
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo quitar la imagen");
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit && !url) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className={`${previewClassName} rounded border border-gray-200 bg-white object-contain p-0.5 dark:border-slate-700`}
        />
      ) : null}
      {canEdit && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-60 dark:text-indigo-400"
          >
            {busy ? "Guardando…" : url ? changeLabel : addLabel}
          </button>
          {url && (
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
            >
              Quitar
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}
