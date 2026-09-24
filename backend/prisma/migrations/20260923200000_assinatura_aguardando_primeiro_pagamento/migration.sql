-- Quem assina pelo cartão da landing entra sem teste, aguardando o primeiro
-- pagamento. O teste de cinco dias fica só para o "Começar teste grátis".
ALTER TYPE "SubscriptionStatus" ADD VALUE 'INCOMPLETE' BEFORE 'TRIALING';
