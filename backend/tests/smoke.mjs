const BASE = 'http://localhost:3333/api/v1';
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
  check('contexto traz módulos da empresa', bella.company.modules.length === 10, JSON.stringify(bella.company.modules));

  const lu = await login('lu@studionails.com', 'studio@12345');
  check('login do Studio Nails (plano Starter)', Boolean(lu.accessToken));
  check(
    'Starter recebe apenas 4 módulos',
    lu.company.modules.length === 4,
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
  check('empresa com módulo ativo acessa aluguéis', bellaRentals.status === 200);

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

  const grid = await api(
    `/appointments/availability?professionalId=${professionalId}&date=${day.toISOString()}&durationMinutes=${shortService.durationMinutes}`,
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
  check('dashboard traz bloco de aluguéis', dashboard.data.rentals !== null);

  const luDashboard = await api('/dashboard', { token: lu.accessToken });
  check('empresa sem financeiro não recebe o bloco', luDashboard.data.financial === null);
  check('empresa sem recursos não recebe o bloco', luDashboard.data.resources === null);

  const reports = await api('/reports/professionals', { token: bella.accessToken });
  check('relatório de profissionais', reports.status === 200 && reports.data.length === 3);

  console.log('\n=== 7. Aluguéis e cobranças ===');
  const rentalStats = await api('/rentals/stats', { token: bella.accessToken });
  check('estatísticas de aluguel', rentalStats.data.activeRentals >= 1);
  const payments = await api('/rentals/payments', { token: bella.accessToken });
  check('cobranças geradas', payments.data.data.length >= 3);

  const pending = payments.data.data.find((p) => p.status === 'PENDING');
  if (pending) {
    const paid = await api(`/rentals/payments/${pending.id}/pay`, {
      method: 'POST',
      token: bella.accessToken,
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
    'plano Starter impede habilitar módulo fora do plano',
    toggle.status === 400,
    JSON.stringify(toggle.data),
  );

  const disableCore = await api('/company/modules', {
    method: 'PATCH',
    token: bella.accessToken,
    body: { module: 'appointments', enabled: false },
  });
  check('módulo essencial não pode ser desativado', disableCore.status === 400);

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

  console.log(`\n──────────────────────────────\n  ${pass} passaram · ${fail} falharam\n`);
  process.exit(fail > 0 ? 1 : 0);
};

run().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
