import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { BadRequestError } from '../../shared/errors/AppError';
import { asyncHandler } from '../../shared/utils/http';

/**
 * Envio de imagens (logo da empresa, foto de profissional).
 *
 * Guarda em disco, numa pasta por empresa. Nada do que o cliente manda é
 * aproveitado: o nome é sorteado, a extensão sai da lista permitida e o formato
 * é conferido nos bytes do arquivo. Assim um nome malicioso não escapa da
 * pasta, e um executável rotulado de imagem não passa.
 */

/** SVG fica de fora de propósito: ele executa script quando aberto direto. */
const ALLOWED = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Assinatura dos formatos aceitos, lida do próprio conteúdo.
 *
 * O `Content-Type` que chega no upload é escrito pelo cliente — quem envia
 * escolhe o que declarar. Conferir os primeiros bytes é o que garante que o
 * arquivo é mesmo a imagem que diz ser, e não outra coisa com o rótulo trocado.
 */
const SIGNATURES: Array<{ mime: string; matches: (buffer: Buffer) => boolean }> = [
  { mime: 'image/jpeg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    matches: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    matches: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

/** O formato real do arquivo, ou null se não for nenhum dos aceitos. */
function detectImage(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  return SIGNATURES.find((signature) => signature.matches(buffer))?.mime ?? null;
}

/**
 * Teto de envios. Sem ele, qualquer conta autenticada enche o disco do servidor
 * em minutos — 4 MB por arquivo, em sequência, até acabar o espaço.
 */
const uploadLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Muitos envios seguidos. Aguarde alguns minutos.',
    },
  },
});

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
export const UPLOADS_ROUTE = '/uploads';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED.has(file.mimetype)) {
      callback(new BadRequestError('Envie uma imagem JPG, PNG ou WEBP'));
      return;
    }
    callback(null, true);
  },
});

export const uploadsRoutes = Router();

uploadsRoutes.post(
  '/',
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('Nenhum arquivo enviado');

    // Vale o que está dentro do arquivo, não o que o cliente declarou.
    const mimeType = detectImage(req.file.buffer);
    const extension = mimeType ? ALLOWED.get(mimeType) : undefined;
    if (!mimeType || !extension) {
      throw new BadRequestError('Envie uma imagem JPG, PNG ou WEBP');
    }

    const folder = path.join(UPLOADS_DIR, req.companyId as string);
    await fs.promises.mkdir(folder, { recursive: true });

    const name = `${crypto.randomUUID()}${extension}`;
    await fs.promises.writeFile(path.join(folder, name), req.file.buffer);

    const url = `${env.PUBLIC_URL}${UPLOADS_ROUTE}/${req.companyId}/${name}`;
    res.status(201).json({ url, size: req.file.size, mimeType });
  }),
);
