-- Conserta registros antigos da trilha de auditoria.
--
-- A alteração dos dados da empresa gravava o ID do usuário no campo do NOME,
-- e a tela mostrava um UUID na coluna "Usuário". Onde esse ID bate com um
-- usuário existente, o registro ganha o vínculo e o nome de verdade.
--
-- Registros sem usuário nenhum continuam como estão: o defeito que zerava o
-- usuário não deixou rastro de quem fez, e não há como recuperar.
--
-- Idempotente: depois de aplicada, nenhuma linha atende mais a condição.
UPDATE "audit_logs" AS a
SET "userId" = u."id",
    "userName" = u."name"
FROM "users" AS u
WHERE a."userId" IS NULL
  AND a."userName" = u."id";
