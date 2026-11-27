import { BadRequestException } from '@nestjs/common';

export const IMAGE_TYPES = ['image/png', 'image/jpeg'] as const;

/**
 * Decodifica una imagen en base64 (con o sin prefijo data:) y verifica tipo,
 * tamaño y la firma real del archivo (para no guardar cualquier cosa como imagen).
 */
export function decodeImage(base64: string, mimeType: string, maxBytes: number): Uint8Array<ArrayBuffer> {
  if (!(IMAGE_TYPES as readonly string[]).includes(mimeType)) {
    throw new BadRequestException('La imagen debe ser PNG o JPG');
  }
  const bytes = Buffer.from(String(base64 ?? '').replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (bytes.length === 0) throw new BadRequestException('Imagen vacía');
  if (bytes.length > maxBytes) {
    throw new BadRequestException(`La imagen no puede pesar más de ${Math.round(maxBytes / 1024)} KB`);
  }
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if ((mimeType === 'image/png' && !isPng) || (mimeType === 'image/jpeg' && !isJpeg)) {
    throw new BadRequestException('El archivo no es una imagen PNG/JPG válida');
  }
  return new Uint8Array(bytes); // copia con ArrayBuffer propio (tipo que espera Prisma)
}
