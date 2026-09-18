-- Deixa a dona liberar, por profissional, quem pode marcar na própria agenda.
--
-- Falso para todo mundo que já existe: hoje nenhuma profissional marca, e ligar
-- para todas de uma vez mudaria o combinado de quem tem recepção sem ninguém
-- pedir. Quem quiser, liga no cadastro de cada uma.
ALTER TABLE "professionals"
  ADD COLUMN "canManageOwnAgenda" BOOLEAN NOT NULL DEFAULT false;
