/**
 * Cenário do espaço compartilhado: aluguel por turno alimentando a agenda
 * pública. Roda contra a API em execução, depois de `npm run seed`.
 */
const BASE = 'http://localhost:3333/api/v1';
const SLUG = 'espaco-marcia-vaz';

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
  if (res.status !== 200) throw new Error(`login ${email}: ${JSON.stringify(res.data)}`);
  return res.data;
}

/** Próxima data (a partir de amanhã) que cai no dia da semana informado. */
function nextWeekday(weekday) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  do {
    date.setDate(date.getDate() + 1);
  } while (date.getDay() !== weekday);
  return date;
}

const run = async () => {
  console.log('\n=== 1. Turnos e espaços ===');
  const marcia = await login('marcia@marciavaz.com.br', 'marcia@12345');
  check('login da dona do espaço', Boolean(marcia.accessToken));

  const shifts = await api('/shifts', { token: marcia.accessToken });
  check('3 turnos configurados', shifts.data.length === 3, JSON.stringify(shifts.data?.length));

  const prices = await api('/shifts/prices', { token: marcia.accessToken });
  check(
    'tabela de preço por espaço × turno',
    prices.data.resources.length === 3 && prices.data.resources[0].shiftPrices.length === 3,
  );

  console.log('\n=== 2. Reserva de turno ===');
  const tuesday = nextWeekday(2); // dia da Ana
  const dayMap = await api(`/rentals/bookings/day-map?date=${tuesday.toISOString()}`, {
    token: marcia.accessToken,
  });
  const hairRow = dayMap.data.resources.find((r) => r.name.includes('cabelo'));
  const morningSlot = hairRow.shifts.find((s) => s.booking);
  check('mapa do dia mostra quem alugou', Boolean(morningSlot?.booking), JSON.stringify(hairRow));
  check(
    'turno da manhã reservado para Ana',
    morningSlot?.booking?.professional?.name === 'Ana Ribeiro',
  );

  const resources = await api('/resources?isRentable=true', { token: marcia.accessToken });
  const hairRoom = resources.data.data.find((r) => r.name.includes('cabelo'));
  const professionals = await api('/professionals', { token: marcia.accessToken });
  const bia = professionals.data.data.find((p) => p.name === 'Bia Nunes');

  const duplicate = await api('/rentals/bookings', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      resourceId: hairRoom.id,
      professionalId: bia.id,
      date: tuesday.toISOString(),
      shiftId: shifts.data.find((s) => s.name === 'Manhã').id,
    },
  });
  check(
    'não deixa alugar o mesmo espaço/turno duas vezes',
    duplicate.status === 409,
    JSON.stringify(duplicate.data),
  );

  const freeNight = await api('/rentals/bookings', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      resourceId: hairRoom.id,
      professionalId: bia.id,
      date: tuesday.toISOString(),
      shiftId: shifts.data.find((s) => s.name === 'Noite').id,
    },
  });
  check('aluga turno livre no mesmo dia', freeNight.status === 201, JSON.stringify(freeNight.data));
  check(
    'preço vem da tabela do turno (noite = R$ 80)',
    Number(freeNight.data?.created?.[0]?.price) === 80,
    JSON.stringify(freeNight.data?.created?.[0]?.price),
  );

  console.log('\n=== 3. Página pública ===');
  const storefront = await api(`/public/${SLUG}`);
  check('vitrine abre sem login', storefront.status === 200);
  check('mostra as 3 áreas', storefront.data.categories.length === 3, JSON.stringify(storefront.data.categories?.map((c) => c.name)));
  check('mostra as 3 profissionais', storefront.data.professionals.length === 3);

  const blocked = await api('/public/clinica-bella');
  check(
    'empresa sem agendamento online não expõe página',
    blocked.status === 404 && blocked.data.error.code === 'PUBLIC_BOOKING_OFF',
    JSON.stringify(blocked.data),
  );

  console.log('\n=== 4. Profissional do dia sai do aluguel ===');
  const corte = storefront.data.services.find((s) => s.name === 'Corte');

  const tuesdayAvailability = await api(
    `/public/${SLUG}/availability?serviceId=${corte.id}&date=${tuesday.toISOString()}`,
  );
  check(
    'terça: Ana disponível (alugou a manhã)',
    tuesdayAvailability.data.professionals.some((p) => p.professional.name === 'Ana Ribeiro'),
    JSON.stringify(tuesdayAvailability.data.professionals.map((p) => p.professional.name)),
  );

  const anaSlots = tuesdayAvailability.data.professionals.find(
    (p) => p.professional.name === 'Ana Ribeiro',
  );
  const allInMorning = anaSlots.slots.every((s) => s.time >= '08:00' && s.time < '12:00');
  check('horários limitados ao turno alugado (manhã)', allInMorning, anaSlots.slots.at(-1)?.time);
  check(
    'slot já traz a sala alugada',
    anaSlots.slots[0].resourceId === hairRoom.id,
    JSON.stringify(anaSlots.slots[0]),
  );

  const monday = nextWeekday(1); // Ana não aluga segunda
  const mondayAvailability = await api(
    `/public/${SLUG}/availability?serviceId=${corte.id}&date=${monday.toISOString()}`,
  );
  check(
    'segunda: nenhuma cabeleireira (ninguém alugou)',
    mondayAvailability.data.professionals.length === 0,
    JSON.stringify(mondayAvailability.data.professionals.map((p) => p.professional.name)),
  );

  const limpeza = storefront.data.services.find((s) => s.name === 'Limpeza de pele');
  const mondayEsthetics = await api(
    `/public/${SLUG}/availability?serviceId=${limpeza.id}&date=${monday.toISOString()}`,
  );
  check(
    'segunda: Márcia disponível (equipe da casa, não depende de aluguel)',
    mondayEsthetics.data.professionals.some((p) => p.professional.name === 'Márcia Vaz'),
  );

  console.log('\n=== 5. Cliente agenda pelo link ===');
  const slot = anaSlots.slots[2];
  const booked = await api(`/public/${SLUG}/appointments`, {
    method: 'POST',
    body: {
      serviceId: corte.id,
      professionalId: anaSlots.professional.id,
      startsAt: slot.startsAt,
      customer: { name: 'Cliente da Ana', phone: '(11) 96000-7777' },
    },
  });
  check('agendamento criado pelo link', booked.status === 201, JSON.stringify(booked.data));

  const retry = await api(`/public/${SLUG}/appointments`, {
    method: 'POST',
    body: {
      serviceId: corte.id,
      professionalId: anaSlots.professional.id,
      startsAt: slot.startsAt,
      customer: { name: 'Outra cliente', phone: '(11) 96000-8888' },
    },
  });
  check('horário ocupado não aceita segundo agendamento', retry.status === 409, JSON.stringify(retry.data));

  const agenda = await api(
    `/appointments?from=${tuesday.toISOString().slice(0, 10)}T00:00:00.000Z&to=${tuesday.toISOString().slice(0, 10)}T23:59:59.000Z`,
    { token: marcia.accessToken },
  );
  const created = agenda.data.data.find((a) => a.customer.name === 'Cliente da Ana');
  check('aparece na agenda da dona do espaço', Boolean(created));
  check('atendimento ocupa a sala alugada', created?.room?.id === hairRoom.id, JSON.stringify(created?.room));

  console.log('\n=== 6. Caixa separado ===');
  const completed = await api(`/appointments/${created.id}/status`, {
    method: 'PATCH',
    token: marcia.accessToken,
    body: { status: 'COMPLETED', payment: { method: 'PIX', paid: true } },
  });
  check('finaliza o atendimento da locatária', completed.status === 200);

  const detail = await api(`/appointments/${created.id}`, { token: marcia.accessToken });
  check(
    'receita da locatária NÃO entra no caixa do espaço',
    detail.data.transactions.length === 0,
    JSON.stringify(detail.data.transactions),
  );
  check('e não gera comissão', detail.data.commissions.length === 0);

  const customers = await api('/customers', { token: marcia.accessToken });
  const helena = customers.data.data.find((c) => c.name === 'Helena Prado');
  const services = await api('/services', { token: marcia.accessToken });
  const marciaPro = professionals.data.data.find((p) => p.name === 'Márcia Vaz');

  const ownStart = new Date(monday);
  ownStart.setHours(10, 0, 0, 0);

  const ownAppointment = await api('/appointments', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      customerId: helena.id,
      professionalId: marciaPro.id,
      startsAt: ownStart.toISOString(),
      services: [{ serviceId: services.data.data.find((s) => s.name === 'Limpeza de pele').id, quantity: 1 }],
    },
  });
  check('cria atendimento da própria dona', ownAppointment.status === 201, JSON.stringify(ownAppointment.data));

  await api(`/appointments/${ownAppointment.data.id}/status`, {
    method: 'PATCH',
    token: marcia.accessToken,
    body: { status: 'COMPLETED', payment: { method: 'PIX', paid: true } },
  });

  const ownDetail = await api(`/appointments/${ownAppointment.data.id}`, { token: marcia.accessToken });
  check(
    'receita da equipe própria ENTRA no caixa',
    ownDetail.data.transactions.length === 1,
    JSON.stringify(ownDetail.data.transactions?.length),
  );

  console.log('\n=== 7. Espaço alugado protege a agenda ===');
  const conflictStart = new Date(tuesday);
  conflictStart.setHours(9, 0, 0, 0);

  const invasion = await api('/appointments', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      customerId: helena.id,
      professionalId: marciaPro.id,
      roomId: hairRoom.id,
      startsAt: conflictStart.toISOString(),
      services: [{ serviceId: services.data.data.find((s) => s.name === 'Massagem modeladora').id, quantity: 1 }],
    },
  });
  check(
    'não agenda em sala alugada para outra profissional',
    invasion.status === 409,
    JSON.stringify(invasion.data),
  );

  const outsideShift = new Date(tuesday);
  outsideShift.setHours(15, 0, 0, 0);
  const anaOutside = await api('/appointments', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      customerId: helena.id,
      professionalId: anaSlots.professional.id,
      startsAt: outsideShift.toISOString(),
      services: [{ serviceId: services.data.data.find((s) => s.name === 'Corte').id, quantity: 1 }],
    },
  });
  check(
    'locatária não atende fora do turno que alugou',
    anaOutside.status === 409,
    JSON.stringify(anaOutside.data),
  );

  console.log('\n=== 8. Painel da locatária ===');
  const ana = await login('ana@marciavaz.com.br', 'marcia@12345');
  const anaBookings = await api('/rentals/bookings', { token: ana.accessToken });
  const onlyHers = anaBookings.data.data.every((b) => b.professional.name === 'Ana Ribeiro');
  check('locatária vê só os próprios turnos', onlyHers && anaBookings.data.data.length > 0);

  const anaAgenda = await api('/appointments?perPage=100', { token: ana.accessToken });
  const onlyHerAgenda = anaAgenda.data.data.every((a) => a.professional?.id === ana.user.professionalId);
  check('locatária vê só a própria agenda', onlyHerAgenda);

  const forbidden = await api('/financial/dashboard', { token: ana.accessToken });
  check('locatária não acessa o financeiro do espaço', forbidden.status === 403, String(forbidden.status));

  console.log(`\n──────────────────────────────\n  ${pass} passaram · ${fail} falharam\n`);
  process.exit(fail > 0 ? 1 : 0);
};

run().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
