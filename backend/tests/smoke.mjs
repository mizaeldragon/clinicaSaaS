import 'dotenv/config';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { generateSync } from 'otplib';
import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:3333/api/v1';

/**
 * Acesso direto ao banco para montar cenários que a API não expõe de
 * propósito: o token de redefinição só existe dentro do e-mail, e o
 * vencimento do trial é uma data no passado que nenhuma rota deixa escrever.
 */
const db = new PrismaClient();

/** O mesmo hash que o servidor guarda — é assim que o token do e-mail confere. */
const hashToken = (token) =>
  crypto.createHmac('sha256', process.env.REFRESH_TOKEN_SECRET).update(token).digest('hex');
let pass = 0;
let fail = 0;

function check(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✔ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✘ ${name} ${extra}`);
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function login(email, password) {
  const res = await api('/auth/login', { method: 'POST', body: { email, password } });
  if (res.status !== 200) throw new Error(`login ${email} falhou: ${JSON.stringify(res.data)}`);
  return res.data;
}

const run = async () => {
  console.log('\n=== 1. Autenticação ===');
  const bella = await login('admin@clinicabella.com', 'bella@12345');
  check('login admin da Clínica Bella', Boolean(bella.accessToken));
  check(
    'clínica no plano Pro fica sem o módulo de aluguel',
    bella.company.modules.length === 9 && !bella.company.modules.includes('rentals'),
    JSON.stringify(bella.company.modules),
  );

  const lu = await login('lu@studionails.com', 'studio@12345');
  check('login do Studio Nails', Boolean(lu.accessToken));
  check(
    'o studio assina o mesmo Pro, mas ligou só 4 módulos',
    lu.company.modules.length === 4 && lu.company.plan.slug === 'pro',
    JSON.stringify(lu.company.modules),
  );

  const superAdmin = await login('admin@saas.com', 'admin@12345');
  check('login do super admin', superAdmin.user.role === 'SUPER_ADMIN');

  const bad = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@clinicabella.com', password: 'errada' },
  });
  check('senha inválida rejeitada', bad.status === 401);

  console.log('\n=== 2. Isolamento multiempresa ===');
  const bellaCustomers = await api('/customers', { token: bella.accessToken });
  const luCustomers = await api('/customers', { token: lu.accessToken });
  check('Bella lista seus clientes', bellaCustomers.data.data.length === 5);
  check('Studio lista apenas os seus', luCustomers.data.data.length === 2);

  const targetId = bellaCustomers.data.data[0].id;
  const crossRead = await api(`/customers/${targetId}`, { token: lu.accessToken });
  check('empresa B não acessa cliente da empresa A', crossRead.status === 404, `status=${crossRead.status}`);

  console.log('\n=== 3. Feature flags (módulos) ===');
  const luRentals = await api('/rentals', { token: lu.accessToken });
  check('módulo desabilitado bloqueia no backend', luRentals.status === 403 && luRentals.data.error.code === 'MODULE_DISABLED');
  const bellaRentals = await api('/rentals', { token: bella.accessToken });
  check(
    'clínica no Pro também não acessa aluguéis pela API',
    bellaRentals.status === 403 && bellaRentals.data.error.code === 'MODULE_DISABLED',
    String(bellaRentals.status),
  );

  const marcia = await login('marcia@marciavaz.com.br', 'marcia@12345');
  const marciaRentals = await api('/rentals', { token: marcia.accessToken });
  check(
    'espaço no Premium acessa aluguéis',
    marciaRentals.status === 200 && marcia.company.modules.includes('rentals'),
    String(marciaRentals.status),
  );

  console.log('\n=== 4. Agenda e prevenção de conflitos ===');
  const professionals = await api('/professionals', { token: bella.accessToken });
  const services = await api('/services', { token: bella.accessToken });
  const resources = await api('/resources?onlyRooms=true', { token: bella.accessToken });
  const professionalId = professionals.data.data[0].id;
  const shortService = services.data.data.find((s) => s.durationMinutes <= 45);
  const serviceId = shortService.id;
  const roomId = resources.data.data[0].id;
  const customerId = bellaCustomers.data.data[0].id;

  // Próxima terça-feira, no primeiro horário realmente livre do profissional.
  const day = new Date();
  day.setDate(day.getDate() + ((9 - day.getDay()) % 7 || 7));
  day.setHours(12, 0, 0, 0);

  // A sala entra na consulta: o slot precisa estar livre para o profissional
  // *e* para a sala em que o atendimento vai acontecer.
  const grid = await api(
    `/appointments/availability?professionalId=${professionalId}&roomId=${roomId}&date=${day.toISOString()}&durationMinutes=${shortService.durationMinutes}`,
    { token: bella.accessToken },
  );
  const freeSlot = grid.data.find((slot) => slot.available);
  check('grade de horários encontra slot livre', Boolean(freeSlot));
  const start = new Date(freeSlot.startsAt);

  const created = await api('/appointments', {
    method: 'POST',
    token: bella.accessToken,
    body: {
      customerId,
      professionalId,
      roomId,
      startsAt: start.toISOString(),
      services: [{ serviceId, quantity: 1 }],
    },
  });
  check('cria agendamento', created.status === 201, JSON.stringify(created.data));

  const conflict = await api('/appointments', {
    method: 'POST',
    token: bella.accessToken,
    body: {
      customerId: bellaCustomers.data.data[1].id,
      professionalId,
      startsAt: start.toISOString(),
      services: [{ serviceId, quantity: 1 }],
    },
  });
  check(
    'bloqueia dois atendimentos do mesmo profissional no mesmo horário',
    conflict.status === 409 && conflict.data.error.code === 'SCHEDULE_CONFLICT',
    JSON.stringify(conflict.data),
  );

  const roomConflict = await api('/appointments', {
    method: 'POST',
    token: bella.accessToken,
    body: {
      customerId: bellaCustomers.data.data[1].id,
      professionalId: professionals.data.data[1].id,
      roomId,
      startsAt: start.toISOString(),
      services: [{ serviceId, quantity: 1 }],
    },
  });
  check(
    'bloqueia mesma sala em horários sobrepostos',
    roomConflict.status === 409,
    JSON.stringify(roomConflict.data),
  );

  const outsideHours = new Date(start);
  outsideHours.setHours(23, 0, 0, 0);
  const closed = await api('/appointments', {
    method: 'POST',
    token: bella.accessToken,
    body: {
      customerId,
      professionalId,
      startsAt: outsideHours.toISOString(),
      services: [{ serviceId, quantity: 1 }],
    },
  });
  check('respeita horário de funcionamento', closed.status === 409, JSON.stringify(closed.data));

  const slots = await api(
    `/appointments/availability?professionalId=${professionalId}&date=${start.toISOString()}&durationMinutes=45`,
    { token: bella.accessToken },
  );
  const taken = slots.data.find((s) => s.time === freeSlot.time);
  check('grade de horários marca o slot ocupado', taken && taken.available === false);

  console.log('\n=== 5. Finalização: financeiro + comissão ===');
  const appointmentId = created.data.id;
  const completed = await api(`/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    token: bella.accessToken,
    body: { status: 'COMPLETED', payment: { method: 'PIX', paid: true } },
  });
  check('finaliza atendimento', completed.status === 200 && completed.data.status === 'COMPLETED');

  const detail = await api(`/appointments/${appointmentId}`, { token: bella.accessToken });
  check('gerou lançamento financeiro', detail.data.transactions.length === 1);
  check('gerou comissão do profissional', detail.data.commissions.length === 1);
  check(
    'comissão de 40% calculada',
    Math.abs(detail.data.commissions[0].amount - detail.data.totalPrice * 0.4) < 0.01,
    JSON.stringify(detail.data.commissions[0]),
  );

  const reCompleted = await api(`/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    token: bella.accessToken,
    body: { status: 'SCHEDULED' },
  });
  check('impede transição inválida de status', reCompleted.status === 409);

  console.log('\n=== 6. Dashboard e relatórios ===');
  const dashboard = await api('/dashboard', { token: bella.accessToken });
  check('dashboard responde', dashboard.status === 200);
  check('dashboard traz bloco financeiro', dashboard.data.financial !== null);
  check(
    'clínica no Pro não recebe o bloco de aluguéis',
    dashboard.data.rentals === null,
    JSON.stringify(dashboard.data.rentals),
  );

  const marciaDashboard = await api('/dashboard', { token: marcia.accessToken });
  check('espaço no Premium recebe o bloco de aluguéis', marciaDashboard.data.rentals !== null);

  const luDashboard = await api('/dashboard', { token: lu.accessToken });
  check('empresa sem financeiro não recebe o bloco', luDashboard.data.financial === null);
  check('empresa sem recursos não recebe o bloco', luDashboard.data.resources === null);

  const reports = await api('/reports/professionals', { token: bella.accessToken });
  check('relatório de profissionais', reports.status === 200 && reports.data.length === 3);

  console.log('\n=== 7. Aluguéis e cobranças ===');
  const rentalStats = await api('/rentals/stats', { token: marcia.accessToken });
  check('estatísticas de aluguel', rentalStats.data.activeRentals >= 1, JSON.stringify(rentalStats.data));
  const payments = await api('/rentals/payments', { token: marcia.accessToken });
  check('cobranças geradas', payments.data.data.length >= 1, String(payments.data.data?.length));

  const pending = payments.data.data.find((p) => p.status === 'PENDING');
  if (pending) {
    const paid = await api(`/rentals/payments/${pending.id}/pay`, {
      method: 'POST',
      token: marcia.accessToken,
      body: { amount: pending.amount, paymentMethod: 'PIX' },
    });
    check('registra pagamento de aluguel', paid.status === 200 && paid.data.status === 'PAID');
  }

  console.log('\n=== 8. Permissões ===');
  const receptionist = await login('recepcao@clinicabella.com', 'bella@12345');
  const forbidden = await api('/users', { token: receptionist.accessToken });
  check('recepcionista não gerencia usuários', forbidden.status === 403);
  const allowed = await api('/customers', { token: receptionist.accessToken });
  check('recepcionista acessa clientes', allowed.status === 200);

  const professionalUser = await login('juliana@clinicabella.com', 'bella@12345');
  const ownAgenda = await api('/appointments?perPage=100', { token: professionalUser.accessToken });
  const allOwn = ownAgenda.data.data.every((a) => a.professional?.id === professionalUser.user.professionalId);
  check('profissional vê apenas a própria agenda', allOwn && ownAgenda.data.data.length > 0);

  console.log('\n=== 9. Painel Super Admin ===');
  const metrics = await api('/admin/metrics', { token: superAdmin.accessToken });
  check('métricas globais', metrics.status === 200 && metrics.data.companies.total >= 3);
  check('MRR calculado', metrics.data.mrr > 0);
  const denied = await api('/admin/metrics', { token: bella.accessToken });
  check('admin de empresa não acessa painel do SaaS', denied.status === 403);

  console.log('\n=== 10. Onboarding e módulos ===');
  const options = await api('/onboarding/options', { token: lu.accessToken });
  check('opções do onboarding', options.data.services.length > 10);

  const preview = await api('/onboarding/preview', {
    method: 'POST',
    token: lu.accessToken,
    body: {
      companyType: 'NAIL_STUDIO',
      serviceKeys: ['manicure'],
      hasProfessionals: true,
      usesCommission: true,
      hasRooms: false,
      rentsSpaces: false,
    },
  });
  check('preview sugere módulos', preview.data.modules.includes('commissions'));

  const toggle = await api('/company/modules', {
    method: 'PATCH',
    token: lu.accessToken,
    body: { module: 'rentals', enabled: true },
  });
  check(
    'o plano impede habilitar módulo que ele não cobre',
    toggle.status === 400,
    JSON.stringify(toggle.data),
  );

  const disableCore = await api('/company/modules', {
    method: 'PATCH',
    token: bella.accessToken,
    body: { module: 'appointments', enabled: false },
  });
  check('módulo essencial não pode ser desativado', disableCore.status === 400);

  // O plano decide os módulos no cadastro, e decide sozinho: quem assina o Pro
  // entra sem Aluguel, quem assina o Premium entra com ele. Nenhum wizard no
  // meio — a escolha já foi feita na contratação.
  const nova = await api('/auth/register', {
    method: 'POST',
    body: {
      company: { name: `Clínica Sem Aluguel ${Date.now()}`, type: 'AESTHETIC_CLINIC' },
      admin: {
        name: 'Dona da Clínica',
        email: `clinica${Date.now()}@teste.com`,
        password: 'clinica@12345',
      },
      planSlug: 'pro',
    },
  });
  check('nova empresa é criada', nova.status === 201, JSON.stringify(nova.data?.error));
  check(
    'no Pro, ela já nasce com tudo do plano — e sem Aluguel',
    nova.data.company.modules.length === 9 && !nova.data.company.modules.includes('rentals'),
    JSON.stringify(nova.data.company?.modules),
  );
  check(
    'e sem wizard pendente: não há o que perguntar depois da contratação',
    nova.data.company.onboardingCompleted === true,
  );

  // A mesma porta, o outro plano: é aqui que os dois preços se justificam.
  const novaPremium = await api('/auth/register', {
    method: 'POST',
    body: {
      company: { name: `Espaço Com Aluguel ${Date.now()}`, type: 'BEAUTY_COWORKING' },
      admin: {
        name: 'Dona do Espaço',
        email: `espaco${Date.now()}@teste.com`,
        password: 'jabuticaba-nervosa-71',
      },
      planSlug: 'premium',
    },
  });
  check(
    'no Premium, nasce com Aluguel ligado desde o primeiro acesso',
    novaPremium.status === 201 && novaPremium.data.company.modules.includes('rentals'),
    JSON.stringify(novaPremium.data.company?.modules ?? novaPremium.data),
  );
  check(
    'e a API já aceita /rentals sem passar por wizard nenhum',
    (await api('/rentals', { token: novaPremium.data.accessToken })).status === 200,
  );

  const semAluguel = await api('/onboarding/complete', {
    method: 'POST',
    token: nova.data.accessToken,
    body: {
      companyType: 'AESTHETIC_CLINIC',
      serviceKeys: ['facial'],
      hasProfessionals: true,
      usesCommission: true,
      hasRooms: true,
      rentsSpaces: false,
      seedCatalog: false,
    },
  });
  check(
    'respondendo "não aluga", o módulo continua desligado',
    semAluguel.status === 200 && !semAluguel.data.modules.includes('rentals'),
    JSON.stringify(semAluguel.data?.modules),
  );

  const rentalsOff = await api('/rentals', { token: nova.data.accessToken });
  check(
    'e a API recusa /rentals para essa empresa',
    rentalsOff.status === 403,
    String(rentalsOff.status),
  );

  // Mesmo respondendo "aluga", o plano manda: no Pro o módulo não liga, e o
  // wizard devolve o que ficou de fora para a tela poder oferecer o upgrade.
  const tentaAlugar = await api('/onboarding/complete', {
    method: 'POST',
    token: nova.data.accessToken,
    body: {
      companyType: 'AESTHETIC_CLINIC',
      serviceKeys: ['facial'],
      hasProfessionals: true,
      usesCommission: true,
      hasRooms: true,
      rentsSpaces: true,
      seedCatalog: false,
    },
  });
  check(
    'no plano Pro, pedir aluguel não liga o módulo',
    !tentaAlugar.data.modules.includes('rentals'),
    JSON.stringify(tentaAlugar.data?.modules),
  );
  check(
    'e o wizard avisa o que ficou de fora do plano',
    tentaAlugar.data.blocked.includes('rentals') && tentaAlugar.data.plan === 'Pro',
    JSON.stringify({ blocked: tentaAlugar.data?.blocked, plan: tentaAlugar.data?.plan }),
  );

  const comAluguel = await api('/onboarding/preview', {
    method: 'POST',
    token: nova.data.accessToken,
    body: {
      companyType: 'BEAUTY_COWORKING',
      serviceKeys: ['hair'],
      hasProfessionals: true,
      usesCommission: false,
      hasRooms: true,
      rentsSpaces: true,
    },
  });
  check(
    'respondendo "aluga", o módulo é sugerido',
    comAluguel.data.modules.includes('rentals'),
    JSON.stringify(comAluguel.data?.modules),
  );

  console.log('\n=== 11. Refresh token ===');
  const refreshed = await api('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: bella.refreshToken },
  });
  check('refresh gera novo par de tokens', refreshed.status === 200 && refreshed.data.accessToken !== bella.accessToken);
  const reused = await api('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: bella.refreshToken },
  });
  check('refresh token antigo é revogado (rotação)', reused.status === 401);

  console.log('\n=== 12. Senha ===');

  const NOVA = 'marcia@99887';
  const troca = await api('/auth/change-password', {
    method: 'POST',
    token: marcia.accessToken,
    body: { currentPassword: 'marcia@12345', newPassword: NOVA },
  });
  check('troca a própria senha', troca.status === 204, String(troca.status));

  const senhaVelha = await api('/auth/login', {
    method: 'POST',
    body: { email: 'marcia@marciavaz.com.br', password: 'marcia@12345' },
  });
  check('a senha antiga para de valer', senhaVelha.status === 401, String(senhaVelha.status));

  const senhaNova = await api('/auth/login', {
    method: 'POST',
    body: { email: 'marcia@marciavaz.com.br', password: NOVA },
  });
  check('a nova senha entra', senhaNova.status === 200, String(senhaNova.status));

  // Esqueci a senha: a resposta é a mesma para conta que existe e que não
  // existe, senão a rota viraria um verificador de e-mails cadastrados.
  const pedido = await api('/auth/forgot-password', {
    method: 'POST',
    body: { email: 'marcia@marciavaz.com.br' },
  });
  const pedidoFantasma = await api('/auth/forgot-password', {
    method: 'POST',
    body: { email: 'nao-existe-mesmo@exemplo.com' },
  });
  check(
    'esqueci a senha responde igual para e-mail com e sem conta',
    pedido.status === 204 && pedidoFantasma.status === 204,
    JSON.stringify({ com: pedido.status, sem: pedidoFantasma.status }),
  );

  const reciboInvalido = await api('/auth/reset-password', {
    method: 'POST',
    body: { token: 'x'.repeat(96), newPassword: 'qualquer@123' },
  });
  check('token inventado não redefine nada', reciboInvalido.status === 400);

  // O token só viaja dentro do e-mail, então aqui gravamos um que conhecemos —
  // exatamente como o servidor teria gravado ao enviar a mensagem.
  const marciaUser = await db.user.findFirstOrThrow({
    where: { email: 'marcia@marciavaz.com.br' },
  });
  const tokenDoEmail = crypto.randomBytes(48).toString('hex');
  await db.passwordReset.create({
    data: {
      userId: marciaUser.id,
      tokenHash: hashToken(tokenDoEmail),
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  const redefine = await api('/auth/reset-password', {
    method: 'POST',
    body: { token: tokenDoEmail, newPassword: 'marcia@12345' },
  });
  check('o link do e-mail redefine a senha', redefine.status === 204, JSON.stringify(redefine.data));

  const reuso = await api('/auth/reset-password', {
    method: 'POST',
    body: { token: tokenDoEmail, newPassword: 'outra@12345' },
  });
  check('e o mesmo link não serve duas vezes', reuso.status === 400);

  const voltou = await api('/auth/login', {
    method: 'POST',
    body: { email: 'marcia@marciavaz.com.br', password: 'marcia@12345' },
  });
  check('a senha redefinida vale no login', voltou.status === 200, String(voltou.status));

  const marciaDeVolta = voltou.data;

  console.log('\n=== 13. Cobrança da mensalidade ===');

  const cobranca = await api('/billing', { token: marciaDeVolta.accessToken });
  check(
    'a tela de cobrança abre',
    cobranca.status === 200 && cobranca.data.plan.slug === 'premium',
    JSON.stringify(cobranca.data?.plan),
  );
  check(
    'e diz que o gateway não está configurado nesta instalação',
    cobranca.data.gateway.enabled === false,
  );
  check(
    'o plano Premium custa R$ 450',
    Number(cobranca.data.plan.price) === 450,
    String(cobranca.data?.plan?.price),
  );

  const proPlan = (await api('/auth/plans')).data.find((p) => p.slug === 'pro');
  check('e o Pro, R$ 300', Number(proPlan.price) === 300, String(proPlan?.price));

  const assina = await api('/billing/subscribe', {
    method: 'POST',
    token: marciaDeVolta.accessToken,
    body: { billingType: 'PIX' },
  });
  check(
    'assinar sem gateway devolve erro claro, não 500',
    assina.status === 503 && assina.data.error.code === 'BILLING_NOT_CONFIGURED',
    JSON.stringify(assina.data),
  );

  const recepcaoBilling = await login('recepcao@clinicabella.com', 'bella@12345');
  const cobrancaNegada = await api('/billing', { token: recepcaoBilling.accessToken });
  check('recepcionista não vê a cobrança da empresa', cobrancaNegada.status === 403);

  // Trial vencido numa instalação sem gateway: ninguém é trancado, porque não
  // haveria como pagar para destravar.
  await db.subscription.update({
    where: { companyId: marciaDeVolta.company.id },
    data: { trialEndsAt: new Date(Date.now() - 86_400_000), status: 'TRIALING' },
  });

  const aindaEscreve = await api('/customers', {
    method: 'POST',
    token: marciaDeVolta.accessToken,
    body: { name: 'Teste Pós-Trial' },
  });
  check(
    'trial vencido não tranca quando não há como pagar',
    aindaEscreve.status === 201,
    JSON.stringify(aindaEscreve.data),
  );
  check(
    'e a tela de cobrança concorda que o acesso está liberado',
    (await api('/billing', { token: marciaDeVolta.accessToken })).data.access.kind === 'ok',
  );

  await db.$disconnect();

  console.log('\n=== 14. Segurança ===');

  // --- Token forjado -------------------------------------------------------
  // Um token so tem valor se foi assinado com o nosso segredo, pelo algoritmo
  // que esperamos e para este sistema. Cada tentativa abaixo falha uma dessas.
  const bellaToken = bella.accessToken;
  const [, payloadB64] = bellaToken.split('.');
  const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

  const semAssinatura =
    Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') +
    '.' +
    payloadB64 +
    '.';
  check(
    'token sem assinatura ("alg: none") é recusado',
    (await api('/auth/me', { token: semAssinatura })).status === 401,
  );

  const outroSegredo = jwt.sign(claims, 'segredo-que-nao-e-o-nosso', { algorithm: 'HS256' });
  check(
    'token assinado com outro segredo é recusado',
    (await api('/auth/me', { token: outroSegredo })).status === 401,
  );

  const outroEmissor = jwt.sign(
    { sub: claims.sub, companyId: claims.companyId, role: claims.role, permissions: claims.permissions },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '15m', issuer: 'outro-sistema', audience: 'belezza-app' },
  );
  check(
    'token do nosso segredo mas de outro emissor é recusado',
    (await api('/auth/me', { token: outroEmissor })).status === 401,
  );

  // --- Desligar alguém corta o acesso agora --------------------------------
  const demitida = await api('/users', {
    method: 'POST',
    token: bella.accessToken,
    body: {
      name: 'Recepção Temporária',
      email: 'temporaria@clinicabella.com',
      password: 'jabuticaba-nervosa-71',
      role: 'RECEPTIONIST',
    },
  });
  const sessaoDela = await login('temporaria@clinicabella.com', 'jabuticaba-nervosa-71');
  check(
    'a conta nova funciona antes de ser desligada',
    (await api('/customers', { token: sessaoDela.accessToken })).status === 200,
  );

  await api(`/users/${demitida.data.id}`, {
    method: 'PATCH',
    token: bella.accessToken,
    body: { isActive: false },
  });
  const depoisDeDesligada = await api('/customers', { token: sessaoDela.accessToken });
  check(
    'desligar a conta corta o acesso na hora, não quando o token vencer',
    depoisDeDesligada.status === 401,
    String(depoisDeDesligada.status),
  );

  // --- Refresh token roubado -----------------------------------------------
  const vitima = await login('recepcao@clinicabella.com', 'bella@12345');
  const girou = await api('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: vitima.refreshToken },
  });
  check('a rotação entrega um par novo', girou.status === 200);

  // O antigo já foi revogado pela rotação. Reapresentá-lo significa que existe
  // uma cópia circulando — e não dá para saber se quem chegou é a dona.
  const reapresentado = await api('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: vitima.refreshToken },
  });
  check('refresh revogado reapresentado é recusado', reapresentado.status === 401);

  const aindaValia = await api('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: girou.data.refreshToken },
  });
  check(
    'e derruba junto a sessão boa — a cópia roubada morre com ela',
    aindaValia.status === 401,
    String(aindaValia.status),
  );

  // --- Upload ---------------------------------------------------------------
  // O Content-Type do upload é escrito por quem envia. O que vale são os bytes.
  const disfarcado = new FormData();
  disfarcado.append(
    'file',
    new Blob([Buffer.from('<?php system($_GET["c"]); ?>')], { type: 'image/png' }),
    'inocente.png',
  );
  const upload = await fetch(`${BASE}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bella.accessToken}` },
    body: disfarcado,
  });
  check(
    'arquivo que não é imagem é recusado mesmo dizendo ser PNG',
    upload.status === 400,
    String(upload.status),
  );

  const pngDeVerdade = new FormData();
  pngDeVerdade.append(
    'file',
    new Blob([
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(64),
      ]),
    ], { type: 'image/png' }),
    'logo.png',
  );
  const uploadOk = await fetch(`${BASE}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bella.accessToken}` },
    body: pngDeVerdade,
  });
  check('e um PNG de verdade passa', uploadOk.status === 201, String(uploadOk.status));

  // --- Permissões inventadas ------------------------------------------------
  const permissaoFalsa = await api('/users', {
    method: 'POST',
    token: bella.accessToken,
    body: {
      name: 'Gerente Curioso',
      email: 'curioso@clinicabella.com',
      password: 'curioso@12345',
      role: 'MANAGER',
      permissions: ['users:manage', 'tudo:liberado'],
    },
  });
  check(
    'permissão fora do catálogo é recusada no cadastro',
    permissaoFalsa.status === 400,
    JSON.stringify(permissaoFalsa.data),
  );

  // --- Enumeração de contas -------------------------------------------------
  const contaQueExiste = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@clinicabella.com', password: 'senha-errada' },
  });
  const contaQueNaoExiste = await api('/auth/login', {
    method: 'POST',
    body: { email: 'ninguem-aqui@exemplo.com', password: 'senha-errada' },
  });
  check(
    'login não revela se o e-mail tem conta',
    contaQueExiste.status === contaQueNaoExiste.status &&
      contaQueExiste.data.error.message === contaQueNaoExiste.data.error.message,
    JSON.stringify({ existe: contaQueExiste.data.error, naoExiste: contaQueNaoExiste.data.error }),
  );

  // --- Nao existe caminho de liberar a assinatura sem pagar ---------------
  // Ja existiu: POST /subscription/change-plan gravava ACTIVE com mais um mes
  // de validade sem falar com o gateway. Empresa com o teste vencido se
  // liberava sozinha, de graca, quantas vezes quisesse.
  const assinaturaAntes = await db.subscription.findUnique({
    where: { companyId: bella.company.id },
  });

  const burlar = await api('/subscription/change-plan', {
    method: 'POST',
    token: bella.accessToken,
    body: { planSlug: 'premium' },
  });
  check(
    'nao ha rota que troque o plano sem emitir cobranca',
    burlar.status === 404,
    String(burlar.status),
  );
  const cancelarDeLado = await api('/subscription/cancel', {
    method: 'POST',
    token: bella.accessToken,
  });
  check(
    'nem que cancele por fora do gateway',
    cancelarDeLado.status === 404,
    String(cancelarDeLado.status),
  );

  const assinaturaDepois = await db.subscription.findUnique({
    where: { companyId: bella.company.id },
  });
  check(
    'e a assinatura fica exatamente como estava',
    assinaturaDepois.status === assinaturaAntes.status &&
      String(assinaturaDepois.currentPeriodEnd) === String(assinaturaAntes.currentPeriodEnd) &&
      assinaturaDepois.planId === assinaturaAntes.planId,
    JSON.stringify({
      antes: { status: assinaturaAntes.status, ate: assinaturaAntes.currentPeriodEnd },
      depois: { status: assinaturaDepois.status, ate: assinaturaDepois.currentPeriodEnd },
    }),
  );

  console.log('\n=== 15. Verificação em duas etapas ===');

  const dono = await login('lu@studionails.com', 'studio@12345');
  const T = dono.accessToken;

  const zero = await api('/auth/2fa', { token: T });
  check('começa desligada', zero.data.enabled === false);

  const setup = await api('/auth/2fa/setup', { method: 'POST', token: T });
  check(
    'a configuração devolve o segredo e o endereço do QR',
    setup.status === 200 &&
      typeof setup.data.secret === 'string' &&
      setup.data.otpauthUrl.startsWith('otpauth://totp/'),
    JSON.stringify(setup.data?.otpauthUrl?.slice(0, 40)),
  );

  const aindaDesligada = await api('/auth/2fa', { token: T });
  check(
    'e não liga nada antes de a pessoa provar que o aplicativo funciona',
    aindaDesligada.data.enabled === false,
  );

  const errado = await api('/auth/2fa/enable', {
    method: 'POST',
    token: T,
    body: { code: '000000' },
  });
  check('código errado não ativa', errado.status === 400);

  const ligar = await api('/auth/2fa/enable', {
    method: 'POST',
    token: T,
    body: { code: generateSync({ secret: setup.data.secret }) },
  });
  check(
    'código certo ativa e entrega os códigos de recuperação',
    ligar.status === 200 && ligar.data.recoveryCodes.length === 8,
    JSON.stringify(ligar.data).slice(0, 90),
  );

  // --- o login muda de forma ------------------------------------------------
  const comSenha = await api('/auth/login', {
    method: 'POST',
    body: { email: 'lu@studionails.com', password: 'studio@12345' },
  });
  check(
    'a senha sozinha para de abrir a conta',
    comSenha.data.twoFactorRequired === true && comSenha.data.accessToken === undefined,
    JSON.stringify(Object.keys(comSenha.data)),
  );

  const passe = comSenha.data.challengeToken;
  const passeComoSessao = await api('/customers', { token: passe });
  check(
    'e o passe do desafio não serve como sessão',
    passeComoSessao.status === 401,
    String(passeComoSessao.status),
  );

  const codigoErrado = await api('/auth/2fa/login', {
    method: 'POST',
    body: { challengeToken: passe, code: '111111' },
  });
  check('código errado não completa o login', codigoErrado.status === 401);

  const entrou = await api('/auth/2fa/login', {
    method: 'POST',
    body: { challengeToken: passe, code: generateSync({ secret: setup.data.secret }) },
  });
  check(
    'com o código do aplicativo, entra',
    entrou.status === 200 && Boolean(entrou.data.accessToken),
    String(entrou.status),
  );

  // --- perdeu o celular -----------------------------------------------------
  const outroPasse = (
    await api('/auth/login', {
      method: 'POST',
      body: { email: 'lu@studionails.com', password: 'studio@12345' },
    })
  ).data.challengeToken;
  const deRecuperacao = ligar.data.recoveryCodes[0];
  const comRecuperacao = await api('/auth/2fa/login', {
    method: 'POST',
    body: { challengeToken: outroPasse, code: deRecuperacao },
  });
  check('um código de recuperação também entra', comRecuperacao.status === 200);

  const maisUmPasse = (
    await api('/auth/login', {
      method: 'POST',
      body: { email: 'lu@studionails.com', password: 'studio@12345' },
    })
  ).data.challengeToken;
  const reusado = await api('/auth/2fa/login', {
    method: 'POST',
    body: { challengeToken: maisUmPasse, code: deRecuperacao },
  });
  check('mas o mesmo código de recuperação não serve duas vezes', reusado.status === 401);

  // --- o segredo não fica legível no banco ---------------------------------
  const noBanco = await db.user.findFirstOrThrow({ where: { email: 'lu@studionails.com' } });
  check(
    'o segredo do 2FA está cifrado no banco',
    !noBanco.twoFactorSecret.includes(setup.data.secret) && noBanco.twoFactorSecret.includes('.'),
    noBanco.twoFactorSecret.slice(0, 24),
  );
  const codigosNoBanco = await db.recoveryCode.findMany({ where: { userId: noBanco.id } });
  check(
    'e os códigos de recuperação, em hash',
    codigosNoBanco.every((c) => !ligar.data.recoveryCodes.includes(c.codeHash)),
  );

  // --- desligar exige senha E código ---------------------------------------
  const sessao = entrou.data.accessToken;
  const semSenha = await api('/auth/2fa/disable', {
    method: 'POST',
    token: sessao,
    body: { password: 'errada@12345', code: generateSync({ secret: setup.data.secret }) },
  });
  check('desligar com a senha errada não passa', semSenha.status === 400);

  const desligou = await api('/auth/2fa/disable', {
    method: 'POST',
    token: sessao,
    body: { password: 'studio@12345', code: generateSync({ secret: setup.data.secret }) },
  });
  check('com senha e código, desliga', desligou.status === 204, String(desligou.status));

  const voltouAoNormal = await api('/auth/login', {
    method: 'POST',
    body: { email: 'lu@studionails.com', password: 'studio@12345' },
  });
  check('e o login volta a abrir direto', Boolean(voltouAoNormal.data.accessToken));

  console.log('\n=== 16. Senha vazada ===');

  // "password" aparece em centenas de milhares de vazamentos — é a primeira
  // coisa que qualquer lista de ataque testa.
  const senhaVazada = await api('/users', {
    method: 'POST',
    token: bella.accessToken,
    body: {
      name: 'Teste Vazada',
      email: 'vazada@clinicabella.com',
      password: 'password',
      role: 'RECEPTIONIST',
    },
  });
  const bloqueou = senhaVazada.status === 400;
  check(
    bloqueou
      ? 'senha de lista de vazamento é recusada no cadastro'
      : 'senha vazada — checagem indisponível, seguiu sem barrar (falha em aberto)',
    bloqueou || senhaVazada.status === 201,
    JSON.stringify(senhaVazada.data).slice(0, 120),
  );

  const senhaBoa = await api('/users', {
    method: 'POST',
    token: bella.accessToken,
    body: {
      name: 'Teste Senha Boa',
      email: 'senhaboa@clinicabella.com',
      password: 'jacaranda-molhado-42',
      role: 'RECEPTIONIST',
    },
  });
  check('e uma senha que nunca vazou passa', senhaBoa.status === 201, String(senhaBoa.status));

  console.log(`\n──────────────────────────────\n  ${pass} passaram · ${fail} falharam\n`);
  process.exit(fail > 0 ? 1 : 0);
};

run().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
