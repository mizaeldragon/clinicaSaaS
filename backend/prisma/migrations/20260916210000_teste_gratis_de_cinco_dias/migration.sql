-- O teste gratuito passa de 14 para 5 dias.
--
-- Duas coisas separadas: o padrao da coluna, que vale para plano novo, e os
-- planos que ja existem -- o padrao nao volta no passado para corrigi-los.
ALTER TABLE "plans" ALTER COLUMN "trialDays" SET DEFAULT 5;

UPDATE "plans" SET "trialDays" = 5 WHERE "trialDays" = 14;

-- As empresas que ja estao em teste ficam com o prazo que receberam. Encurtar
-- o teste de quem ja comecou seria mudar o combinado no meio.
