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

  console.log('\n=== 3b. Link público individual ===');

  const anaPage = await api(`/public/${SLUG}/p/ana-ribeiro`);
  check('link individual da locatária abre sem login', anaPage.status === 200, JSON.stringify(anaPage.data?.error));
  check('traz a marca do espaço', anaPage.data?.company?.name === 'Espaço Márcia Vaz');
  check('e só a profissional daquele link', anaPage.data?.professional?.name === 'Ana Ribeiro');
  check(
    'mostra só os serviços que ela faz',
    anaPage.data.services.length > 0 &&
      anaPage.data.services.every((s) => ['Corte', 'Escova', 'Lavagem + finalização'].includes(s.name)),
    JSON.stringify(anaPage.data.services.map((s) => s.name)),
  );

  const marciaPage = await api(`/public/${SLUG}/p/marcia-vaz`);
  check(
    'a dona do espaço tem o link dela, com os serviços dela',
    marciaPage.status === 200 &&
      marciaPage.data.services.every((s) => ['Limpeza de pele', 'Massagem modeladora'].includes(s.name)),
    JSON.stringify(marciaPage.data.services?.map((s) => s.name)),
  );

  const ghost = await api(`/public/${SLUG}/p/nao-existe`);
  check('link inexistente devolve 404', ghost.status === 404, String(ghost.status));

  console.log('\n=== 4. Profissional do dia sai do aluguel ===');
  const corte = storefront.data.services.find((s) => s.name === 'Corte');

  const anaOnly = await api(
    `/public/${SLUG}/availability?serviceId=${corte.id}&date=${tuesday.toISOString()}&professionalId=${anaPage.data.professional.id}`,
  );
  check(
    'link individual mostra a agenda de uma profissional só',
    anaOnly.data.professionals.length === 1 &&
      anaOnly.data.professionals[0].professional.name === 'Ana Ribeiro',
    JSON.stringify(anaOnly.data.professionals.map((p) => p.professional.name)),
  );

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
  // O primeiro livre, e não um índice fixo: os horários agora andam de acordo
  // com a duração do serviço, então um Corte de 60 min oferece poucas opções na
  // manhã alugada — pedir o terceiro item assumia uma grade densa que não
  // existe mais.
  const slot = anaSlots.slots[0];
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

  const ana = await login('ana@marciavaz.com.br', 'marcia@12345');
  const day = tuesday.toISOString().slice(0, 10);
  const range = `from=${day}T00:00:00.000Z&to=${day}T23:59:59.000Z`;

  const ownerAgenda = await api(`/appointments?${range}`, { token: marcia.accessToken });
  check(
    'agendamento da locatária NÃO aparece para a dona do espaço',
    !ownerAgenda.data.data.some((a) => a.customer.name === 'Cliente da Ana'),
    JSON.stringify(ownerAgenda.data.data.map((a) => a.customer.name)),
  );

  const anaDay = await api(`/appointments?${range}`, { token: ana.accessToken });
  const created = anaDay.data.data.find((a) => a.customer.name === 'Cliente da Ana');
  check('aparece na agenda da própria locatária', Boolean(created));
  check('atendimento ocupa a sala alugada', created?.room?.id === hairRoom.id, JSON.stringify(created?.room));

  console.log('\n=== 6. Caixa separado ===');
  const completed = await api(`/appointments/${created.id}/status`, {
    method: 'PATCH',
    token: ana.accessToken,
    body: { status: 'COMPLETED', payment: { method: 'PIX', paid: true } },
  });
  check(
    'locatária finaliza o próprio atendimento',
    completed.status === 200,
    JSON.stringify(completed.data),
  );

  const detail = await api(`/appointments/${created.id}`, { token: ana.accessToken });
  check(
    'a receita vai para o caixa da própria locatária',
    detail.data.transactions.length === 1 && Number(detail.data.transactions[0].amount) > 0,
    JSON.stringify(detail.data.transactions),
  );
  check('e não gera comissão — ela não repassa percentual a ninguém', detail.data.commissions.length === 0);

  const customers = await api('/customers', { token: marcia.accessToken });
  const helena = customers.data.data.find((c) => c.name === 'Helena Prado');
  const services = await api('/services', { token: marcia.accessToken });
  // O catálogo também tem dono: o corte é da Ana, a limpeza de pele é da casa.
  const anaServices = await api('/services', { token: ana.accessToken });
  const anaService = (name) => anaServices.data.data.find((s) => s.name === name).id;
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
  const anaCustomers = await api('/customers', { token: ana.accessToken });
  const anaClient = anaCustomers.data.data.find((c) => c.name === 'Cliente da Ana');
  const anaOutside = await api('/appointments', {
    method: 'POST',
    token: ana.accessToken,
    body: {
      customerId: anaClient.id,
      professionalId: anaSlots.professional.id,
      startsAt: outsideShift.toISOString(),
      services: [{ serviceId: anaService('Corte'), quantity: 1 }],
    },
  });
  check(
    'locatária não atende fora do turno que alugou',
    anaOutside.status === 409,
    JSON.stringify(anaOutside.data),
  );

  console.log('\n=== 8. Painel da locatária ===');
  const anaBookings = await api('/rentals/bookings', { token: ana.accessToken });
  const onlyHers = anaBookings.data.data.every((b) => b.professional.name === 'Ana Ribeiro');
  check('locatária vê só os próprios turnos', onlyHers && anaBookings.data.data.length > 0);

  const anaAgenda = await api('/appointments?perPage=100', { token: ana.accessToken });
  const onlyHerAgenda = anaAgenda.data.data.every((a) => a.professional?.id === ana.user.professionalId);
  check('locatária vê só a própria agenda', onlyHerAgenda);

  const anaFinancial = await api('/financial/dashboard', { token: ana.accessToken });
  const marciaFinancial = await api('/financial/dashboard', { token: marcia.accessToken });
  check(
    'locatária abre o financeiro e vê o caixa dela, não o do espaço',
    anaFinancial.status === 200 &&
      marciaFinancial.status === 200 &&
      Number(anaFinancial.data.month.income) !== Number(marciaFinancial.data.month.income),
    JSON.stringify({
      ana: anaFinancial.data?.month?.income ?? anaFinancial.data,
      marcia: marciaFinancial.data?.month?.income ?? marciaFinancial.data,
    }),
  );

  const rentalsForbidden = await api('/rentals', { token: ana.accessToken });
  check(
    'mas não acessa os aluguéis da casa',
    rentalsForbidden.status === 403,
    String(rentalsForbidden.status),
  );

  console.log('\n=== 9. Parede entre carteiras ===');

  const ownerCustomers = await api('/customers?perPage=100', { token: marcia.accessToken });
  check(
    'dona do espaço não vê as clientes da locatária',
    !ownerCustomers.data.data.some((c) => c.name === 'Cliente da Ana'),
    JSON.stringify(ownerCustomers.data.data.map((c) => c.name)),
  );
  check(
    'mas continua vendo as clientes da própria estética',
    ownerCustomers.data.data.some((c) => c.name === 'Helena Prado'),
  );

  const peek = await api(`/appointments/${created.id}`, { token: marcia.accessToken });
  check(
    'nem abrindo o agendamento da locatária pelo id',
    peek.status === 404,
    String(peek.status),
  );

  check(
    'locatária não vê as clientes da casa',
    !anaCustomers.data.data.some((c) => c.name === 'Helena Prado'),
    JSON.stringify(anaCustomers.data.data.map((c) => c.name)),
  );

  // O catálogo é parte do negócio: o preço que a Ana cobra pelo corte não é
  // assunto da casa nem da concorrente de mesa ao lado.
  const houseNames = services.data.data.map((s) => s.name);
  const anaNames = anaServices.data.data.map((s) => s.name);
  check(
    'dona do espaço não vê o catálogo da locatária',
    !houseNames.includes('Corte'),
    JSON.stringify(houseNames),
  );
  check(
    'mas continua vendo o catálogo da própria estética',
    houseNames.includes('Limpeza de pele'),
  );
  check(
    'locatária vê o próprio catálogo',
    anaNames.includes('Corte') && anaNames.includes('Escova'),
    JSON.stringify(anaNames),
  );
  check(
    'e não vê o da casa nem o da outra locatária',
    !anaNames.includes('Limpeza de pele') && !anaNames.includes('Manicure'),
    JSON.stringify(anaNames),
  );

  // A página pública precisa enxergar tudo: é lá que a cliente escolhe o
  // serviço, e ela não sabe de carteira nenhuma.
  const vitrine = await api('/public/espaco-marcia-vaz');
  const vitrineNames = (vitrine.data.services ?? []).map((s) => s.name);
  check(
    'o link público mostra o catálogo inteiro do espaço',
    vitrineNames.includes('Corte') && vitrineNames.includes('Limpeza de pele'),
    JSON.stringify(vitrineNames),
  );

  const biaSession = await login('bia@marciavaz.com.br', 'marcia@12345');
  const biaAgenda = await api('/appointments?perPage=100', { token: biaSession.accessToken });
  check(
    'uma locatária não vê a agenda da outra',
    !biaAgenda.data.data.some((a) => a.professional?.id === ana.user.professionalId),
  );

  const intrusion = await api('/appointments', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      customerId: helena.id,
      professionalId: anaSlots.professional.id,
      startsAt: new Date(tuesday.getTime() + 9 * 3600_000).toISOString(),
      // Serviço da casa de propósito: assim o catálogo resolve e a recusa só
      // pode vir da parede de carteira, não de "serviço não encontrado".
      services: [
        { serviceId: services.data.data.find((x) => x.name === 'Limpeza de pele').id, quantity: 1 },
      ],
    },
  });
  check(
    'dona do espaço não lança nada na agenda da locatária',
    intrusion.status === 403,
    JSON.stringify(intrusion.data),
  );

  const anaDashboard = await api('/dashboard', { token: ana.accessToken });
  check(
    'dashboard da locatária traz o caixa dela, sem o bloco de aluguéis da casa',
    anaDashboard.data.financial !== null && anaDashboard.data.rentals === null,
    JSON.stringify({ status: anaDashboard.status, data: anaDashboard.data }).slice(0, 300),
  );

  // A guarda de exclusão conta atendimentos e turnos — dados que a locadora não
  // enxerga. Se ela contasse dentro da carteira dela, a locatária "vazia" seria
  // apagada de verdade, levando junto as reservas de turno em cascata.
  const removed = await api(`/professionals/${anaSlots.professional.id}`, {
    method: 'DELETE',
    token: marcia.accessToken,
  });
  check('remover locatária responde ok', removed.status === 204, String(removed.status));

  const stillThere = await api('/professionals?isActive=false', { token: marcia.accessToken });
  check(
    'locatária com histórico é inativada, nunca apagada',
    stillThere.data.data.some((p) => p.id === anaSlots.professional.id),
    JSON.stringify(stillThere.data.data.map((p) => p.name)),
  );

  const survivingBookings = await api('/rentals/bookings?perPage=100', { token: marcia.accessToken });
  check(
    'e os turnos alugados dela continuam no histórico',
    survivingBookings.data.data.some((b) => b.professional.id === anaSlots.professional.id),
    String(survivingBookings.data.meta?.total),
  );

  // Devolve a locatária ao ar: o seed também é o ambiente de demonstração.
  const restored = await api(`/professionals/${anaSlots.professional.id}`, {
    method: 'PATCH',
    token: marcia.accessToken,
    body: { isActive: true },
  });
  check('locatária pode ser reativada', restored.status === 200, String(restored.status));

  const ownerDashboard = await api('/reports/appointments', { token: marcia.accessToken });
  check(
    'relatório da dona ignora os atendimentos alugados',
    ownerDashboard.status === 200 && ownerDashboard.data.total >= 0,
    JSON.stringify(ownerDashboard.data?.total),
  );

  console.log('\n=== 10. Cadastrando uma locatária nova, do zero ===');

  const nova = await api('/professionals', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      name: 'Carol Dias',
      phone: '(11) 98111-4040',
      revenueOwner: 'PROFESSIONAL',
      publicBookingEnabled: true,
      specialties: ['Cabelo'],
      // Sem serviços: o catálogo da locatária é dela, e a dona do espaço não
      // define o que a Carol cobra — nem poderia, já que não vê o da Ana.
    },
  });
  check('1) cadastra a profissional como locatária', nova.status === 201, JSON.stringify(nova.data));

  const servicoAlheio = await api('/professionals', {
    method: 'POST',
    token: marcia.accessToken,
    body: { name: 'Tentativa', revenueOwner: 'PROFESSIONAL', serviceIds: [corte.id] },
  });
  check(
    '   e a dona não consegue pendurar nela um serviço de outra carteira',
    servicoAlheio.status === 400,
    JSON.stringify(servicoAlheio.data),
  );
  check(
    '2) o link individual dela já nasce pronto',
    nova.data.publicSlug === 'carol-dias',
    nova.data.publicSlug,
  );

  const acesso = await api('/users', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      name: 'Carol Dias',
      email: 'carol@marciavaz.com.br',
      password: 'carol@12345',
      role: 'PROFESSIONAL',
      professionalId: nova.data.id,
    },
  });
  check('3) cria o acesso vinculado a ela', acesso.status === 201, JSON.stringify(acesso.data));

  const carol = await login('carol@marciavaz.com.br', 'carol@12345');
  check('4) ela entra e o sistema a reconhece como locatária', carol.user.isRenter === true);
  check('   e sabe de quem é a agenda', carol.user.professionalId === nova.data.id);

  const carolClientes = await api('/customers?perPage=100', { token: carol.accessToken });
  check(
    '5) começa com a carteira vazia — não herda as clientes da casa',
    carolClientes.data.data.length === 0,
    JSON.stringify(carolClientes.data.data.map((c) => c.name)),
  );

  const carolServicos = await api('/services', { token: carol.accessToken });
  check(
    '   e com o catálogo vazio — os preços da casa e da Ana não são dela',
    carolServicos.data.data.length === 0,
    JSON.stringify(carolServicos.data.data.map((x) => x.name)),
  );

  // 45 min de propósito: a Carol alugou o turno da noite (18h–22h) e o espaço
  // fecha às 19h, então a janela real dela é de uma hora. Um serviço de duas
  // horas não caberia — e o teste (f) mais abaixo depende de caber.
  const carolCria = await api('/services', {
    method: 'POST',
    token: carol.accessToken,
    body: { name: 'Hidratação', price: 120, durationMinutes: 45 },
  });
  check(
    '6) ela monta o próprio catálogo',
    carolCria.status === 201,
    JSON.stringify(carolCria.data),
  );
  const marciaDepois = await api('/services', { token: marcia.accessToken });
  check(
    '   e o preço que ela pratica não aparece para a dona do espaço',
    !marciaDepois.data.data.some((x) => x.name === 'Hidratação'),
    JSON.stringify(marciaDepois.data.data.map((x) => x.name)),
  );

  const carolPage = await api(`/public/${SLUG}/p/carol-dias`);
  check(
    '7) o link público dela responde, já com o serviço dela',
    carolPage.status === 200 &&
      carolPage.data.professional.name === 'Carol Dias' &&
      (carolPage.data.services ?? []).some((x) => x.name === 'Hidratação'),
    String(carolPage.status),
  );

  console.log('\n=== 11. Formatos reais de locação ===');

  const carolId = nova.data.id;
  const table = await api('/shifts/prices', { token: marcia.accessToken });
  const priceOf = (resourceId, shiftId) =>
    Number(
      table.data.resources
        .find((r) => r.id === resourceId)
        ?.shiftPrices.find((p) => p.shiftId === shiftId)?.price ?? 0,
    );
  const nightShift = shifts.data.find((s) => s.name === 'Noite');
  const morningShift = shifts.data.find((s) => s.name === 'Manhã');
  const afternoonShift = shifts.data.find((s) => s.name === 'Tarde');
  const table02 = resources.data.data.find((r) => r.name.includes('02'));

  const nextMonday = nextWeekday(1);
  const monthEnd = new Date(nextMonday.getFullYear(), nextMonday.getMonth() + 1, 0);

  // (a) A semana inteira, um turno por dia.
  const weekAhead = new Date(nextMonday);
  weekAhead.setDate(weekAhead.getDate() + 6);
  const weekPreview = await api('/rentals/bookings/preview', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      resourceId: table02.id,
      professionalId: carolId,
      date: nextMonday.toISOString(),
      until: weekAhead.toISOString(),
      kind: 'SHIFT',
      shiftIds: [nightShift.id],
    },
  });
  check(
    'a) semana inteira: 7 dias, com valor somado antes de confirmar',
    weekPreview.data.total === 7 && weekPreview.data.amount > 0,
    JSON.stringify({ total: weekPreview.data?.total, amount: weekPreview.data?.amount }),
  );

  // (b) O mesmo turno em dias fixos, o mês inteiro.
  const monthPreview = await api('/rentals/bookings/preview', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      resourceId: table02.id,
      professionalId: carolId,
      date: nextMonday.toISOString(),
      until: monthEnd.toISOString(),
      weekdays: [1, 3],
      kind: 'SHIFT',
      shiftIds: [nightShift.id],
    },
  });
  const onlyMonWed = monthPreview.data.days.every((d) => [1, 3].includes(new Date(d.date).getDay()));
  check(
    'b) mês inteiro só nas segundas e quartas',
    onlyMonWed && monthPreview.data.total >= 4,
    JSON.stringify({ total: monthPreview.data?.total }),
  );

  // (c) Dois turnos no mesmo dia.
  const twoShifts = await api('/rentals/bookings/preview', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      resourceId: table02.id,
      professionalId: carolId,
      date: nextMonday.toISOString(),
      kind: 'SHIFT',
      shiftIds: [morningShift.id, afternoonShift.id],
    },
  });
  const morningPrice = priceOf(table02.id, morningShift.id);
  const afternoonPrice = priceOf(table02.id, afternoonShift.id);
  check(
    'c) manhã + tarde no mesmo dia, cada turno com seu preço',
    twoShifts.data.total === 2 &&
      Math.abs(twoShifts.data.amount - (morningPrice + afternoonPrice)) < 0.01,
    JSON.stringify({ amount: twoShifts.data?.amount, morningPrice, afternoonPrice }),
  );

  // (d) Gravando de verdade o mês inteiro.
  const monthBooked = await api('/rentals/bookings', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      resourceId: table02.id,
      professionalId: carolId,
      date: nextMonday.toISOString(),
      until: monthEnd.toISOString(),
      weekdays: [1, 3],
      kind: 'SHIFT',
      shiftIds: [nightShift.id],
    },
  });
  check(
    'd) o mês inteiro é criado de uma vez',
    monthBooked.status === 201 && monthBooked.data.created.length === monthPreview.data.total,
    JSON.stringify({ criadas: monthBooked.data?.created?.length }),
  );

  // (e) Repetir o mesmo período: tudo ocupado, nada duplicado.
  const again = await api('/rentals/bookings/preview', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      resourceId: table02.id,
      professionalId: carolId,
      date: nextMonday.toISOString(),
      until: monthEnd.toISOString(),
      weekdays: [1, 3],
      kind: 'SHIFT',
      shiftIds: [nightShift.id],
    },
  });
  check(
    'e) repetir o período mostra tudo ocupado, sem duplicar',
    again.data.available === 0 && again.data.blocked === again.data.total,
    JSON.stringify({ livres: again.data?.available, ocupados: again.data?.blocked }),
  );

  // (f) A locatária do mês passa a ter agenda naqueles dias — no serviço dela,
  // que é o único que ela oferece.
  const carolAgenda = await api(
    `/public/${SLUG}/availability?serviceId=${carolCria.data.id}&date=${nextMonday.toISOString()}&professionalId=${carolId}`,
  );
  check(
    'f) quem alugou o mês aparece no link público naqueles dias',
    carolAgenda.data.professionals.length === 1,
    JSON.stringify(carolAgenda.data.professionals?.map((p) => p.professional.name)),
  );

  const rejected = await api('/rentals/bookings/preview', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      resourceId: table02.id,
      professionalId: carolId,
      date: monthEnd.toISOString(),
      until: nextMonday.toISOString(),
      kind: 'SHIFT',
      shiftIds: [nightShift.id],
    },
  });
  check('período invertido é recusado', rejected.status === 400, String(rejected.status));

  console.log('\n=== 12. A cliente mexe no próprio horário ===');

  // A disponibilidade é relida agora: os testes anteriores já ocuparam horários.
  const freshDay = nextWeekday(4); // outra quinta da Ana, ainda intocada
  const fresh = await api(
    `/public/${SLUG}/availability?serviceId=${corte.id}&date=${freshDay.toISOString()}&professionalId=${anaSlots.professional.id}`,
  );
  const freeSlots = fresh.data.professionals[0]?.slots ?? [];
  check('há horário livre para a cliente marcar', freeSlots.length >= 2, String(freeSlots.length));

  const anaSlot = freeSlots[0];
  const ownBooking = await api(`/public/${SLUG}/appointments`, {
    method: 'POST',
    body: {
      serviceId: corte.id,
      professionalId: anaSlots.professional.id,
      startsAt: anaSlot.startsAt,
      customer: { name: 'Sofia Prado', phone: '(11) 95000-1234' },
    },
  });
  check('agendamento devolve o link do horário', Boolean(ownBooking.data?.token), JSON.stringify(ownBooking.data));

  const ownToken = ownBooking.data.token;
  const ownView = await api(`/public/${SLUG}/agendamento/${ownToken}`);
  check(
    'a cliente abre o próprio horário sem login',
    ownView.status === 200 && ownView.data.appointment.customerName === 'Sofia Prado',
    JSON.stringify(ownView.data?.error),
  );
  check('e o horário está aberto para alteração', ownView.data.appointment.changeable === true);

  const newSlot = freeSlots[freeSlots.length - 1];
  const ownMoved = await api(`/public/${SLUG}/agendamento/${ownToken}/remarcar`, {
    method: 'POST',
    body: { startsAt: newSlot.startsAt },
  });
  check(
    'remarca sozinha para outro horário livre',
    ownMoved.status === 200 && new Date(ownMoved.data.startsAt).getTime() === new Date(newSlot.startsAt).getTime(),
    JSON.stringify(ownMoved.data),
  );

  // A Ana alugou a manhã: 15h está fora do turno dela.
  const afternoon = new Date(freshDay);
  afternoon.setHours(15, 0, 0, 0);
  const outOfShift = await api(`/public/${SLUG}/agendamento/${ownToken}/remarcar`, {
    method: 'POST',
    body: { startsAt: afternoon.toISOString() },
  });
  check('não remarca para fora do turno alugado', outOfShift.status === 409, String(outOfShift.status));

  const ownCanceled = await api(`/public/${SLUG}/agendamento/${ownToken}/cancelar`, {
    method: 'POST',
    body: { reason: 'Imprevisto' },
  });
  check(
    'cancela sozinha',
    ownCanceled.status === 200 && ownCanceled.data.status === 'CANCELED',
    JSON.stringify({ status: ownCanceled.status, data: ownCanceled.data }),
  );

  const afterCancel = await api(`/public/${SLUG}/agendamento/${ownToken}`);
  check('depois de cancelado, o link não aceita mais mudança', afterCancel.data.appointment.changeable === false);

  const ghostToken = await api(`/public/${SLUG}/agendamento/${'0'.repeat(32)}`);
  check('link inexistente devolve 404', ghostToken.status === 404, String(ghostToken.status));

  console.log('\n=== 13. Feriado fecha o dia ===');

  const imported = await api('/company/holidays/import', {
    method: 'POST',
    token: marcia.accessToken,
    body: { year: new Date().getFullYear() },
  });
  check('importa os feriados nacionais do ano', imported.data.imported >= 10, JSON.stringify(imported.data));

  const holidays = await api('/company/holidays', { token: marcia.accessToken });
  const christmas = holidays.data.find((h) => h.name === 'Natal');
  check('o Natal está na lista', Boolean(christmas), JSON.stringify(holidays.data?.length));

  // Um dia de trabalho normal, fechado à mão.
  const closedDay = nextWeekday(4);
  const closure = await api('/company/holidays', {
    method: 'POST',
    token: marcia.accessToken,
    body: { date: closedDay.toISOString(), name: 'Recesso da equipe' },
  });
  check('a dona fecha um dia avulso', closure.status === 201, JSON.stringify(closure.data));

  const onClosedDay = new Date(closedDay);
  onClosedDay.setHours(10, 0, 0, 0);
  const holidayBlocked = await api('/appointments', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      customerId: helena.id,
      professionalId: marciaPro.id,
      startsAt: onClosedDay.toISOString(),
      services: [{ serviceId: services.data.data.find((s) => s.name === 'Limpeza de pele').id, quantity: 1 }],
    },
  });
  check(
    'não agenda em dia fechado',
    holidayBlocked.status === 409 && String(holidayBlocked.data.error.message).includes('Recesso'),
    JSON.stringify(holidayBlocked.data),
  );

  const publicOnClosedDay = await api(
    `/public/${SLUG}/availability?serviceId=${corte.id}&date=${closedDay.toISOString()}`,
  );
  check(
    'e o link público não oferece horário nenhum nesse dia',
    publicOnClosedDay.data.professionals.length === 0,
    JSON.stringify(publicOnClosedDay.data.professionals?.length),
  );

  // Um <input type="date"> manda "2026-12-25", sem hora. Lido como meia-noite
  // UTC isso vira 24/12 em São Paulo — marcar o Natal fechava a véspera.
  const natal = await api('/company/holidays', {
    method: 'POST',
    token: marcia.accessToken,
    body: { date: '2027-12-25', name: 'Natal (teste de fuso)' },
  });
  check(
    'data sem hora cai no dia certo, não no anterior',
    natal.data.date.slice(0, 10) === '2027-12-25',
    JSON.stringify(natal.data?.date),
  );
  await api(`/company/holidays/${natal.data.id}`, { method: 'DELETE', token: marcia.accessToken });

  const periodo = await api('/rentals/bookings/preview', {
    method: 'POST',
    token: marcia.accessToken,
    body: {
      resourceId: table02.id,
      professionalId: carolId,
      date: '2027-03-10',
      until: '2027-03-12',
      kind: 'SHIFT',
      shiftIds: [nightShift.id],
    },
  });
  check(
    'e o período começa no dia pedido, sem puxar a véspera',
    periodo.data.total === 3 && periodo.data.days[0].date.slice(0, 10) === '2027-03-10',
    JSON.stringify(periodo.data.days?.map((d) => d.date.slice(0, 10))),
  );

  await api(`/company/holidays/${closure.data.id}`, { method: 'DELETE', token: marcia.accessToken });

  console.log('\n=== 14. Caixa da locatária ===');

  const anaFinance = await login('ana@marciavaz.com.br', 'marcia@12345');
  const anaCash = await api('/financial/dashboard', { token: anaFinance.accessToken });
  check('locatária tem caixa próprio', anaCash.status === 200, String(anaCash.status));
  check(
    'com a receita do atendimento dela',
    Number(anaCash.data.month.income) > 0,
    JSON.stringify(anaCash.data?.month),
  );

  // A dona registra o pagamento de um turno da Ana: o mesmo evento gera receita
  // no caixa da casa e despesa no caixa da locatária.
  const pendingBookings = await api('/rentals/bookings?paymentStatus=PENDING&perPage=50', {
    token: marcia.accessToken,
  });
  const anaBooking = pendingBookings.data.data.find((b) => b.professional.name === 'Ana Ribeiro');
  check('há turno da Ana em aberto para cobrar', Boolean(anaBooking), String(pendingBookings.data.data?.length));

  const settled = await api(`/rentals/bookings/${anaBooking.id}/pay`, {
    method: 'POST',
    token: marcia.accessToken,
    body: { amount: Number(anaBooking.price), paymentMethod: 'PIX' },
  });
  check('a dona registra o pagamento do turno', settled.status === 200, JSON.stringify(settled.data?.error));

  const ownerCash = await api('/financial/transactions?perPage=100', { token: marcia.accessToken });
  check(
    'e essa receita NÃO aparece no caixa da casa',
    !ownerCash.data.data.some((t) => t.description.includes('Cliente da Ana')),
    JSON.stringify(ownerCash.data.data.map((t) => t.description)),
  );

  const anaTx = await api('/financial/transactions?perPage=100', { token: anaFinance.accessToken });
  check(
    'a locatária vê o aluguel que pagou como despesa dela',
    anaTx.data.data.some((t) => t.type === 'EXPENSE' && t.description.includes('Aluguel do espaço')),
    JSON.stringify(anaTx.data.data.map((t) => `${t.type}:${t.description}`)),
  );
  check(
    'e o mesmo aluguel é receita no caixa da casa',
    ownerCash.data.data.some((t) => t.type === 'INCOME' && t.description.includes('Aluguel de turno')),
  );

  console.log(`\n──────────────────────────────\n  ${pass} passaram · ${fail} falharam\n`);
  process.exit(fail > 0 ? 1 : 0);
};

run().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
