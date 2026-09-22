-- Capa e recado na página pública de agendamento.
--
-- A página só tinha a logo redonda pequena e o nome. Estes três campos dão à
-- casa um lugar para mostrar o espaço e para avisar o que muda na semana.
--
-- Texto e liga-desliga do recado são colunas separadas: quem escreveu o aviso
-- de uma promoção que acabou desliga agora e liga de novo depois sem redigitar.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "publicCoverUrl" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "publicNotice" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "publicNoticeEnabled" BOOLEAN NOT NULL DEFAULT false;
