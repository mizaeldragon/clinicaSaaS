import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { env } from '../../config/env';
import { BadRequestError } from '../../shared/errors/AppError';
import { asyncHandler } from '../../shared/utils/http';

/**
 * Envio de imagens (logo da empresa, foto de profissional).
 *
 * Guarda em disco, numa pasta por empresa. Nenhum dado do arquivo enviado é
 * aproveitado: o nome é sorteado e a extensão sai da lista permitida, então um
 * nome malicioso não escapa da pasta nem muda o tipo servido.
 */

/** SVG fica de fora de propósito: ele executa script quando aberto direto. */
const ALLOWED = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const MAX_BYTES = 4 * 1024 * 1024;

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
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('Nenhum arquivo enviado');

    const extension = ALLOWED.get(req.file.mimetype);
    if (!extension) throw new BadRequestError('Envie uma imagem JPG, PNG ou WEBP');

    const folder = path.join(UPLOADS_DIR, req.companyId as string);
    await fs.promises.mkdir(folder, { recursive: true });

    const name = `${crypto.randomUUID()}${extension}`;
    await fs.promises.writeFile(path.join(folder, name), req.file.buffer);

    const url = `${env.PUBLIC_URL}${UPLOADS_ROUTE}/${req.companyId}/${name}`;
    res.status(201).json({ url, size: req.file.size, mimeType: req.file.mimetype });
  }),
);
