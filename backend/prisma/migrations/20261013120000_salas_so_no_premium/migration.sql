-- Salas e equipamentos saem do Pro e ficam so no Premium.
--
-- Controlar a ocupacao de cada sala, cadeira e equipamento e o que quem aluga
-- espaco precisa; o Pro e a clinica que atende as proprias clientes. A
-- inteligencia (risco de falta, encaixes, resumo do mes) continua no Pro: ela
-- mora no modulo de relatorios, que nao muda.
--
-- O seed nao mexe em plano que ja existe em producao, por isso a troca vem aqui.
UPDATE "plans"
SET "modules" = array_remove("modules", 'resources'::"ModuleKey")
WHERE "slug" = 'pro';

-- As descricoes so mudam se ainda forem as do seed: texto editado no painel
-- do super admin fica como esta.
UPDATE "plans"
SET "description" = 'Para a equipe: agenda, financeiro, comissões, relatórios e inteligência (risco de falta, encaixes e resumo do mês).'
WHERE "slug" = 'pro'
  AND "description" = 'A clínica completa: equipe, salas, financeiro, comissões e relatórios.';

UPDATE "plans"
SET "description" = 'Tudo do Pro mais salas e equipamentos sem conflito e o aluguel de espaços por turno, diária ou mês, com login e link para cada profissional.'
WHERE "slug" = 'premium'
  AND "description" = 'Tudo do Pro mais o aluguel de espaços por turno ou diária, com link público para cada profissional.';

-- Quem ja assina o Pro perde o modulo, do mesmo jeito que perderia ao trocar
-- de plano (billing.changePlanModules). As salas cadastradas nao sao apagadas:
-- voltam se a empresa subir para o Premium e religar o modulo.
UPDATE "company_modules" cm
SET "enabled" = false, "updatedAt" = NOW()
FROM "subscriptions" s
JOIN "plans" p ON p."id" = s."planId"
WHERE cm."companyId" = s."companyId"
  AND cm."module" = 'resources'
  AND cm."enabled" = true
  AND p."slug" = 'pro';
