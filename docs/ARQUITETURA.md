# Arquitetura — SaaS Multiempresa para Beleza, Estética e Clínicas

## 1. Visão geral

Plataforma **SaaS multi-tenant modular**. Um único banco PostgreSQL com isolamento
lógico por `companyId` (shared database / shared schema + discriminator column),
padrão mais eficiente em custo para SaaS B2B e que permite evoluir para
schema-per-tenant sem reescrever o domínio.

O isolamento **não depende do desenvolvedor lembrar de filtrar**. É garantido em
três camadas:

1. `tenantMiddleware` resolve a `companyId` a partir do JWT (nunca do body/query).
2. `AsyncLocalStorage` (`tenantContext`) carrega a `companyId` por requisição.
3. **Prisma Client Extension** (`shared/database/prisma.ts`) injeta
   automaticamente `where: { companyId }` em toda leitura e `data: { companyId }`
   em toda escrita das entidades tenant-scoped.

A mesma mecânica sustenta um segundo nível de isolamento **dentro** da empresa —
a *carteira*, que separa o negócio da casa do negócio de cada locatária do
espaço. Ver [4.5](#45-carteira--o-segundo-nível-de-isolamento).

Modularidade: cada empresa possui uma lista de módulos habilitados
(`CompanyModule`), resultante da interseção entre **o plano assinado** e **as
escolhas do onboarding**. O acesso é bloqueado no backend (`moduleGuard`) e o
menu/rotas do frontend são renderizados dinamicamente a partir do mesmo
contrato (`GET /api/v1/me/context`).

## 2. Stack

**Backend:** Node.js 22, TypeScript strict, Express 4, PostgreSQL 16, Prisma ORM,
Redis, BullMQ, Socket.IO, Zod, JWT + refresh token rotativo, Pino.

**Frontend:** React 18, Vite, TypeScript, TailwindCSS, componentes no estilo
shadcn/ui (Radix + CVA), React Router, TanStack Query, Zustand.

## 3. Estrutura de pastas

```
sistemaClinicas/
├── docker-compose.yml            # PostgreSQL + Redis
├── docs/ARQUITETURA.md
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── config/env.ts         # validação de env com Zod
│       ├── modules/
│       │   ├── auth/             # login, refresh, registro de empresa
│       │   ├── companies/        # empresa, branding, horários, módulos
│       │   ├── onboarding/       # wizard -> ativação automática de módulos
│       │   ├── users/            # usuários e papéis
│       │   ├── customers/        # clientes + timeline
│       │   ├── professionals/    # profissionais, jornada, comissão
│       │   ├── services/         # categorias e serviços
│       │   ├── appointments/     # agenda + motor de conflitos
│       │   ├── resources/        # recursos genéricos (sala/mesa/cadeira/maca)
│       │   ├── rentals/          # contratos de aluguel + recorrência
│       │   ├── financial/        # receitas, despesas, dashboard
│       │   ├── commissions/      # cálculo e fechamento
│       │   ├── reports/          # relatórios agregados
│       │   ├── notifications/    # notificações internas/e-mail
│       │   ├── subscriptions/    # planos e assinaturas
│       │   ├── admin/            # painel Super Admin do SaaS
│       │   └── audit/            # trilha de auditoria
│       ├── shared/
│       │   ├── database/         # prisma client + extension multi-tenant
│       │   ├── middlewares/      # auth, tenant, rbac, moduleGuard, errors
│       │   ├── errors/           # AppError e catálogo de erros
│       │   └── utils/            # jwt, hash, datas, paginação, asyncHandler
│       ├── jobs/                 # workers BullMQ
│       ├── queues/               # definição das filas
│       ├── websocket/            # Socket.IO + salas por empresa
│       └── routes/               # composição do router raiz
└── frontend/
    └── src/
        ├── api/                  # client HTTP + hooks por recurso
        ├── components/ui/        # design system (estilo shadcn)
        ├── components/           # layout, sidebar dinâmica, guards
        ├── features/             # telas por módulo
        ├── hooks/  lib/  stores/
        └── routes.tsx
```

Cada módulo do backend segue o mesmo contrato:
`*.routes.ts` → `*.controller.ts` → `*.service.ts` (regra de negócio) →
`*.schema.ts` (DTO/Zod). Repositórios aparecem apenas onde a consulta é complexa.

## 4. Modelo de dados

### 4.1 Núcleo SaaS
- `Plan` — nome, preço, limites (usuários, profissionais, agendamentos/mês), módulos.
- `Subscription` — empresa ↔ plano, status (TRIALING/ACTIVE/PAST_DUE/CANCELED), ciclo.
- `Company` — tenant raiz: dados, branding (logo, cor), horário de funcionamento.
- `CompanyModule` — `(companyId, module)` com `enabled`. Fonte da verdade dos feature flags.
- `User` — pertence à empresa, `role` (SUPER_ADMIN, COMPANY_ADMIN, MANAGER, RECEPTIONIST, PROFESSIONAL) e `permissions[]` para papéis configuráveis.
- `RefreshToken` — rotação e revogação de sessões.
- `AuditLog` — quem, o quê, entidade, antes/depois.

### 4.2 Operação
- `Customer` — cliente da empresa.
- `Professional` — vinculado opcionalmente a um `User`; jornada (`WorkingHour`), `TimeOff`, comissão padrão.
- `ServiceCategory` / `Service` — preço, duração, profissionais habilitados (`ProfessionalService`), categoria de recurso exigida.
- `Appointment` — cliente, profissional, sala/recurso, início/fim, status, valor, observações.
- `AppointmentService` — N serviços por atendimento (preço e duração congelados no agendamento).
- `ResourceCategory` / `Resource` — recurso genérico com status (AVAILABLE/IN_USE/MAINTENANCE/INACTIVE).

### 4.3 Aluguel por turno e espaço compartilhado

Dois formatos de locação coexistem:

- **Contrato tradicional** (`Rental` + `RentalPayment`): mesa alugada por mês, com
  parcelas recorrentes.
- **Turno / diária** (`Shift` + `RentalBooking`): a profissional aluga *aquele*
  espaço, *naquele* dia e turno. É o formato dos espaços compartilhados.

Peças:

- `Shift` — turnos fixos vendidos pela empresa (Manhã 08–12, Tarde 13–18, Noite 18–22).
- `ResourceShiftPrice` — preço de cada turno em cada espaço (a estação de cabelo
  à noite pode custar menos que de manhã).
- `RentalBooking` — a ocupação concreta: espaço + profissional + dia + turno, com
  preço e status de pagamento próprios. **É o que bloqueia a agenda.**
- `Rental.shiftId` + `Rental.weekdays` — contrato recorrente ("toda terça e quinta
  de manhã") do qual um job diário deriva as reservas futuras.

A criação de reservas trabalha sempre com **período**, não com um dia: data
inicial, `until` opcional, `weekdays` opcional e um ou mais `shiftIds`. Os
formatos que aparecem na vida real são todos o mesmo desenho:

| O que a dona quer | Como fica |
|---|---|
| um turno solto | sem `until` |
| a semana toda | `until` = fim da semana |
| o mês inteiro | `until` = fim do mês |
| "terça e quinta de manhã até dia 30" | `until` + `weekdays: [2,4]` |
| manhã e tarde no mesmo dia | dois `shiftIds` |

`POST /rentals/bookings/preview` roda a mesma expansão sem gravar e devolve
quantos turnos entram, quais estão ocupados e o total — o valor aparece antes de
confirmar. Na gravação, dias ocupados são pulados em vez de derrubar a série, e
cada turno recebe o preço da sua própria faixa.

**Quem alugou o turno é a profissional do dia.** Essa é a ligação entre o módulo de
aluguel e a agenda pública: a disponibilidade que aparece no link vem dos turnos
reservados, não de uma jornada fixa.

### 4.4 Dono da receita

`Professional.revenueOwner` separa dois papéis dentro do mesmo espaço:

| Valor | Quem é | Ao finalizar um atendimento |
|---|---|---|
| `COMPANY` | equipe da casa | gera receita e comissão para a empresa |
| `PROFESSIONAL` | locatária | **nada** entra no caixa da empresa — ela cobra as próprias clientes e a empresa fatura só o turno |

A disponibilidade também muda: equipe própria usa `WorkingHour`; locatária usa os
`RentalBooking` dela.

### 4.5 Carteira — o segundo nível de isolamento

Um espaço compartilhado abriga **negócios diferentes debaixo do mesmo teto**: o
da dona (a estética onde ela atende) e o de cada locatária. A locadora aluga
imóvel mobiliado; o que acontece dentro dele é negócio de quem alugou. Ela
fatura o turno — não o atendimento — e por isso **não enxerga a agenda, as
clientes nem o faturamento de quem aluga**.

Isso é uma segunda dimensão de isolamento, ortogonal à empresa:

| | Discriminador | Quem separa |
|---|---|---|
| Empresa | `companyId` | uma empresa nunca vê outra |
| Carteira | `ownerProfessionalId` | dentro da empresa, a casa não vê a locatária, e uma locatária não vê a outra |

`Customer.ownerProfessionalId` e `Appointment.ownerProfessionalId` são `null`
quando o registro é da casa e apontam para a locatária quando são dela. O campo
é escalar de propósito: continua válido em `findUnique`/`update`/`delete`.

O recorte de cada requisição vive no mesmo `AsyncLocalStorage` do tenant
(`PortfolioScope`) e é aplicado pela **mesma Prisma Client Extension**:

- `house` — a dona e a equipe: só `ownerProfessionalId = null`;
- `professional` — a locatária: só a carteira dela;
- `all` — sem recorte: jobs, seed, página pública e o motor de conflitos.

`tenantContext.runUnscoped()` é a única porta para o modo `all` dentro de uma
requisição com recorte. O motor de agendamento precisa dela: para impedir
overbooking de uma sala é necessário enxergar a agenda inteira do espaço. Nada
disso vaza para a resposta — quando o conflito é de outra carteira, o rótulo
devolvido é genérico ("Este horário já está ocupado"), sem nome de profissional
nem de cliente.

A parede também vale para escrita (`assertCanWriteToPortfolio`): a locadora não
lança nada na agenda de quem aluga, e uma locatária não lança nada na de outra.
E vale para os avisos: eventos de WebSocket e notificações de um atendimento de
locatária vão para a sala `professional:{id}` e para o usuário dela, nunca para
a empresa inteira.

A mesma pessoa pode ser cliente da casa **e** de uma locatária — são dois
cadastros, porque são dois negócios. O reconhecimento por telefone no
agendamento público acontece dentro da carteira de destino.

Blocos do dashboard (caixa, aluguéis, recursos) passaram a exigir permissão
além do módulo: quem só atende no espaço não recebe o financeiro da casa.

### 4.6 Financeiro
- `Rental` — contrato: recurso, responsável (profissional ou nome livre), período, valor, `billingCycle` (HOUR/DAY/WEEK/MONTH/CUSTOM), dia de vencimento, status.
- `RentalPayment` — parcelas geradas automaticamente pelo worker de recorrência.
- `FinancialTransaction` — receita/despesa unificada, com `paymentMethod`, `paymentStatus`, valor pago/pendente e origem (appointment, rental, avulso).
- `ExpenseCategory` — plano de contas simples de despesas.
- `Commission` — gerada na finalização do atendimento; percentual ou valor fixo; status de pagamento.
- `Notification` — canal (IN_APP/EMAIL/WHATSAPP), evento, payload, lida/enviada.

### 4.7 Regras de integridade multi-tenant
Todas as tabelas de domínio possuem `companyId` + índice composto
`(companyId, <campo de busca>)`. Chaves únicas são sempre compostas com
`companyId` (ex.: `@@unique([companyId, email])`), permitindo que duas empresas
tenham clientes com o mesmo e-mail sem colisão.

## 5. Motor de agendamento (prevenção de conflitos)

Ao criar/alterar um agendamento o serviço valida, dentro de uma transação:

1. Jornada de trabalho do profissional (`WorkingHour`) e ausências (`TimeOff`).
2. Horário de funcionamento da empresa.
3. Sobreposição de intervalo `[start, end)` para **profissional**, **sala** e **recurso**
   (`start < other.end && end > other.start`), ignorando cancelados/no-show.
4. **Espaço alugado**: a sala não aceita atendimento de outra profissional durante
   um turno reservado.
5. **Locatária**: o atendimento precisa cair dentro de um turno que ela alugou.
6. **Carteira**: ninguém agenda na agenda de outra carteira (verificado antes de
   qualquer validação de horário, para não revelar a agenda alheia pela mensagem
   de erro).
7. Limite de agendamentos do plano.

As buscas por conflito rodam sem recorte de carteira — a sala é física e é
compartilhada, então uma agenda invisível continua ocupando o espaço.

## 6. Segurança

JWT de acesso (15 min) + refresh token rotativo persistido e revogável; bcrypt
para senhas; Helmet; CORS restrito; rate limiting global e específico de login;
validação Zod em body/query/params; RBAC por papel + permissões granulares;
feature flag validado no servidor; tratamento centralizado de erros sem vazar
stack em produção.

## 7. Assíncrono

- **BullMQ/Redis**: `reminders` (lembrete 24h/1h antes), `rentals` (cobranças
  recorrentes às 03:00, geração das reservas de turno dos contratos recorrentes
  às 03:15 e marcação de atraso às 03:30), `notifications` (envio), `reports`
  (processamento pesado).
- **Socket.IO**: salas `company:{id}` e `professional:{id}`; eventos
  `appointment.created|updated|deleted`, `resource.status.changed`,
  `notification.created`.

## 8. Plano de implementação (fases)

| Fase | Entrega |
|---|---|
| 1 | Projeto, Prisma, autenticação, multiempresa, usuários e permissões |
| 2 | Dashboard, clientes, serviços, profissionais |
| 3 | Agenda, disponibilidade, prevenção de conflitos |
| 4 | Financeiro, pagamentos, relatórios |
| 5 | Recursos, salas, mesas, cadeiras |
| 6 | Aluguéis e cobranças recorrentes |
| 7 | Planos, assinaturas, feature flags, painel Super Admin |
| 8 | Notificações, Redis, BullMQ, WebSockets |

## 9. Agendamento público (`/e/{slug}`)

Rotas **sem autenticação**, montadas em `/api/v1/public/:slug`. O slug da empresa
resolve o tenant e abre o `AsyncLocalStorage` — o mesmo isolamento do resto da API
vale aqui.

Duas vitrines saem das mesmas rotas:

| Endereço | O que mostra | Quem divulga |
|---|---|---|
| `/e/{empresa}` | o espaço inteiro: quem está no salão naquele dia | a casa |
| `/e/{empresa}/{profissional}` | uma profissional só, com os serviços dela | cada uma para as próprias clientes |

`Professional.publicSlug` (único por empresa, derivado do nome) é o endereço
individual. Num espaço compartilhado cada locatária divulga o seu, e a dona
divulga o dela — quem abre já cai na agenda de quem mandou o link. A vitrine
individual filtra os serviços por `ProfessionalService` e passa `professionalId`
adiante, então disponibilidade e agenda respondem por aquela profissional apenas.

Fluxo da cliente: **serviço → data → profissional/horário → dados → confirmação.**

A lista de profissionais de um dia é montada assim:

- equipe própria (`revenueOwner = COMPANY`) → janelas da jornada de trabalho;
- locatárias (`revenueOwner = PROFESSIONAL`) → janelas dos turnos alugados naquele dia.

Depois subtrai ausências e agendamentos existentes, recorta pelo horário de
funcionamento e devolve os slots livres. Um agendamento criado para uma locatária
já nasce vinculado à sala que ela alugou.

Proteções: rate limit próprio (120 req/min para navegar, 8 agendamentos a cada
10 min), revalidação do slot no momento da confirmação (dois cliques simultâneos
não geram overbooking) e a página só responde quando `Company.publicBookingEnabled`
está ligado.
