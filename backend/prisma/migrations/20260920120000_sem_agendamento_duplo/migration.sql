-- Trava de banco contra agendamento duplo.
--
-- A conferência de horário livre acontece antes da escrita, e entre uma coisa e
-- outra cabe outra cliente: duas pessoas clicando no mesmo horário do link
-- público passavam as duas pela checagem e as duas eram gravadas. Índice único
-- resolve no único lugar onde a corrida não existe -- dentro do banco.
--
-- Parcial de propósito: cancelado e falta liberam o horário de novo, e
-- atendimento sem profissional definida (a casa marca e decide depois quem
-- atende) não disputa agenda de ninguém.
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_sem_duplo"
  ON "appointments" ("professionalId", "startsAt")
  WHERE "professionalId" IS NOT NULL
    AND "status" NOT IN ('CANCELED', 'NO_SHOW');
