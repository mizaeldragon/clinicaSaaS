/* eslint-disable no-console */
import { PrismaClient, ModuleKey, CommissionType, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { slugify } from '../src/shared/utils/slug';

const prisma = new PrismaClient();

const ALL_MODULES: ModuleKey[] = [
  'appointments',
  'customers',
  'professionals',
  'services',
  'financial',
  'commissions',
  'resources',
  'rentals',
  'reports',
  'notifications',
];

async function seedPlans() {
  const plans: Prisma.PlanUncheckedCreateInput[] = [
    {
      // A clínica que atende as próprias clientes: equipe, salas, caixa e
      // comissões. Não aluga espaço — e por isso nunca vê "Aluguel" no menu.
      name: 'Pro',
      slug: 'pro',
      description: 'A clínica completa: equipe, salas, financeiro, comissões e relatórios.',
      price: 300,
      trialDays: 14,
      maxUsers: 8,
      maxProfessionals: 10,
      maxAppointmentsMonth: 2000,
      modules: [
        'appointments',
        'customers',
        'services',
        'professionals',
        'resources',
        'financial',
        'commissions',
        'reports',
        'notifications',
      ],
      sortOrder: 1,
    },
    {
      // O espaço compartilhado: além de atender, aluga sala/mesa/cadeira por
      // turno ou diária, com link público para cada profissional.
      name: 'Premium',
      slug: 'premium',
      description:
        'Tudo do Pro mais o aluguel de espaços por turno ou diária, com link público para cada profissional.',
      price: 450,
      trialDays: 14,
      maxUsers: null,
      maxProfessionals: null,
      maxAppointmentsMonth: null,
      modules: ALL_MODULES,
      sortOrder: 2,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        modules: plan.modules,
        maxUsers: plan.maxUsers,
        maxProfessionals: plan.maxProfessionals,
        maxAppointmentsMonth: plan.maxAppointmentsMonth,
        sortOrder: plan.sortOrder,
      },
    });
  }

  // Planos antigos que saíram do catálogo somem da vitrine, mas continuam
  // valendo para quem já assinou.
  await prisma.plan.updateMany({
    where: { slug: { notIn: plans.map((p) => p.slug) } },
    data: { isActive: false, isPublic: false },
  });

  console.log(`✔ Planos criados (${plans.map((p) => p.name).join(' e ')})`);
}

async function seedSuperAdmin() {
  const email = 'admin@saas.com';
  const existing = await prisma.user.findFirst({ where: { email, companyId: null } });
  if (existing) return;

  await prisma.user.create({
    data: {
      name: 'Super Admin',
      email,
      passwordHash: await bcrypt.hash('admin@12345', 10),
      role: 'SUPER_ADMIN',
      companyId: null,
    },
  });

  console.log('✔ Super admin criado (admin@saas.com / admin@12345)');
}

const BUSINESS_HOURS = [
  { weekday: 0, opensAt: '09:00', closesAt: '18:00', isClosed: true },
  { weekday: 1, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { weekday: 2, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { weekday: 3, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { weekday: 4, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { weekday: 5, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { weekday: 6, opensAt: '09:00', closesAt: '17:00', isClosed: false },
];

function workingHours(companyId: string, professionalId: string) {
  return [1, 2, 3, 4, 5, 6].map((weekday) => ({
    companyId,
    professionalId,
    weekday,
    startsAt: '09:00',
    endsAt: weekday === 6 ? '15:00' : '18:00',
    breakStart: weekday === 6 ? null : '12:00',
    breakEnd: weekday === 6 ? null : '13:00',
    isOff: false,
  }));
}

/** Empresa completa (plano Business) para demonstrar todos os módulos. */
async function seedDemoCompany() {
  const slug = 'clinica-bella';
  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) {
    console.log('• Empresa demo já existe — pulando');
    return;
  }

  const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: 'pro' } });

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const company = await prisma.company.create({
    data: {
      name: 'Clínica Bella',
      slug,
      type: 'AESTHETIC_CLINIC',
      status: 'ACTIVE',
      email: 'contato@clinicabella.com.br',
      phone: '(11) 3333-4444',
      whatsapp: '(11) 99999-4444',
      addressCity: 'São Paulo',
      addressState: 'SP',
      primaryColor: '#7C3AED',
      onboardingCompleted: true,
      onboardingAnswers: {
        companyType: 'AESTHETIC_CLINIC',
        serviceKeys: ['manicure', 'brows', 'facial', 'waxing'],
        hasProfessionals: true,
        usesCommission: true,
        hasRooms: true,
        rentsSpaces: false,
      },
      subscription: {
        create: {
          planId: plan.id,
          status: 'ACTIVE',
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
        },
      },
      modules: { create: plan.modules.map((module) => ({ module, enabled: true })) },
      businessHours: { create: BUSINESS_HOURS },
    },
  });

  const companyId = company.id;
  const passwordHash = await bcrypt.hash('bella@12345', 10);

  const admin = await prisma.user.create({
    data: {
      companyId,
      name: 'Marina Souza',
      email: 'admin@clinicabella.com',
      passwordHash,
      role: 'COMPANY_ADMIN',
      phone: '(11) 98888-1111',
    },
  });

  await prisma.user.create({
    data: {
      companyId,
      name: 'Paula Recepção',
      email: 'recepcao@clinicabella.com',
      passwordHash,
      role: 'RECEPTIONIST',
    },
  });

  // ---------------------------------------------------------- categorias
  const categories = await Promise.all(
    [
      { name: 'Unhas', color: '#EC4899' },
      { name: 'Sobrancelhas', color: '#F59E0B' },
      { name: 'Estética', color: '#0EA5E9' },
      { name: 'Depilação', color: '#14B8A6' },
    ].map((c) => prisma.serviceCategory.create({ data: { ...c, companyId } })),
  );

  const categoryId = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  const services = await Promise.all(
    [
      { name: 'Manicure', price: 45, durationMinutes: 45, category: 'Unhas' },
      { name: 'Pedicure', price: 55, durationMinutes: 60, category: 'Unhas' },
      { name: 'Alongamento de unhas', price: 180, durationMinutes: 150, category: 'Unhas' },
      { name: 'Design de sobrancelha', price: 45, durationMinutes: 30, category: 'Sobrancelhas' },
      { name: 'Design com henna', price: 65, durationMinutes: 45, category: 'Sobrancelhas' },
      { name: 'Limpeza de pele', price: 180, durationMinutes: 90, category: 'Estética' },
      { name: 'Massagem modeladora', price: 160, durationMinutes: 60, category: 'Estética' },
      { name: 'Depilação pernas', price: 90, durationMinutes: 45, category: 'Depilação' },
      { name: 'Depilação axila', price: 35, durationMinutes: 20, category: 'Depilação' },
    ].map((s) =>
      prisma.service.create({
        data: {
          companyId,
          name: s.name,
          price: s.price,
          durationMinutes: s.durationMinutes,
          categoryId: categoryId[s.category],
          commissionType: CommissionType.PERCENTAGE,
          commissionValue: 40,
        },
      }),
    ),
  );

  // -------------------------------------------------------- profissionais
  const professionals = await Promise.all(
    [
      { name: 'Juliana Alves', specialties: ['Unhas', 'Sobrancelhas'], color: '#EC4899' },
      { name: 'Carla Mendes', specialties: ['Estética facial', 'Massagem'], color: '#0EA5E9' },
      { name: 'Rafaela Lima', specialties: ['Depilação'], color: '#14B8A6' },
    ].map((p) =>
      prisma.professional.create({
        data: {
          companyId,
          name: p.name,
          publicSlug: slugify(p.name),
          specialties: p.specialties,
          color: p.color,
          commissionType: CommissionType.PERCENTAGE,
          commissionValue: 40,
          phone: '(11) 97777-0000',
        },
      }),
    ),
  );

  for (const professional of professionals) {
    await prisma.workingHour.createMany({ data: workingHours(companyId, professional.id) });
  }

  // Vincula todos os serviços a todas as profissionais (simplificação do demo).
  await prisma.professionalService.createMany({
    data: professionals.flatMap((p) =>
      services.map((s) => ({ companyId, professionalId: p.id, serviceId: s.id })),
    ),
    skipDuplicates: true,
  });

  await prisma.user.create({
    data: {
      companyId,
      name: professionals[0].name,
      email: 'juliana@clinicabella.com',
      passwordHash,
      role: 'PROFESSIONAL',
      professional: { connect: { id: professionals[0].id } },
    },
  });

  // -------------------------------------------------------------- recursos
  const roomCategory = await prisma.resourceCategory.create({
    data: { companyId, name: 'Salas', isRoom: true },
  });
  const tableCategory = await prisma.resourceCategory.create({
    data: { companyId, name: 'Mesas', isRoom: false },
  });

  const rooms = await Promise.all(
    ['Sala 01', 'Sala 02'].map((name) =>
      prisma.resource.create({ data: { companyId, name, categoryId: roomCategory.id } }),
    ),
  );

  const tables = await Promise.all(
    ['Mesa 01', 'Mesa 02'].map((name) =>
      prisma.resource.create({
        data: {
          companyId,
          name,
          categoryId: tableCategory.id,
          isRentable: true,
          monthlyRate: 500,
        },
      }),
    ),
  );

  // -------------------------------------------------------------- clientes
  const customers = await Promise.all(
    [
      { name: 'Ana Paula Ribeiro', phone: '(11) 99111-2233', birthDate: new Date(1992, 4, 12) },
      { name: 'Beatriz Costa', phone: '(11) 99222-3344', birthDate: new Date(1988, 8, 3) },
      { name: 'Camila Ferreira', phone: '(11) 99333-4455', birthDate: new Date(1995, 1, 27) },
      { name: 'Daniela Rocha', phone: '(11) 99444-5566' },
      { name: 'Eduarda Nunes', phone: '(11) 99555-6677' },
    ].map((c) => prisma.customer.create({ data: { ...c, companyId } })),
  );

  // ---------------------------------------------------- despesas / receitas
  const expenseCategories = await Promise.all(
    ['Aluguel', 'Produtos', 'Energia', 'Salários', 'Marketing'].map((name) =>
      prisma.expenseCategory.create({ data: { companyId, name } }),
    ),
  );

  // ---------------------------------------------------------- agendamentos
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let created = 0;

  for (let dayOffset = -20; dayOffset <= 7; dayOffset += 1) {
    const day = new Date(today);
    day.setDate(day.getDate() + dayOffset);
    if (day.getDay() === 0) continue;

    const appointmentsToday = 2 + (Math.abs(dayOffset) % 3);

    for (let i = 0; i < appointmentsToday; i += 1) {
      const service = services[(created + i) % services.length];
      const professional = professionals[(created + i) % professionals.length];
      const customer = customers[(created + i * 2) % customers.length];

      const startsAt = new Date(day);
      startsAt.setHours(9 + ((created + i) % 7), (i % 2) * 30, 0, 0);
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

      if (endsAt.getHours() >= 18) continue;

      const isPast = startsAt < new Date();
      const status = isPast ? (i % 7 === 0 ? 'NO_SHOW' : 'COMPLETED') : 'SCHEDULED';

      const appointment = await prisma.appointment.create({
        data: {
          companyId,
          customerId: customer.id,
          professionalId: professional.id,
          roomId: rooms[i % rooms.length].id,
          startsAt,
          endsAt,
          durationMinutes: service.durationMinutes,
          status,
          totalPrice: service.price,
          createdById: admin.id,
          completedAt: status === 'COMPLETED' ? endsAt : null,
          services: {
            create: {
              companyId,
              serviceId: service.id,
              name: service.name,
              price: service.price,
              durationMinutes: service.durationMinutes,
              quantity: 1,
            },
          },
        },
      });

      if (status === 'COMPLETED') {
        await prisma.financialTransaction.create({
          data: {
            companyId,
            type: 'INCOME',
            origin: 'APPOINTMENT',
            description: `Atendimento — ${customer.name}`,
            amount: service.price,
            paidAmount: service.price,
            paymentMethod: (['PIX', 'CREDIT_CARD', 'CASH', 'DEBIT_CARD'] as const)[i % 4],
            paymentStatus: 'PAID',
            paidAt: endsAt,
            competenceDate: startsAt,
            customerId: customer.id,
            appointmentId: appointment.id,
          },
        });

        await prisma.commission.create({
          data: {
            companyId,
            professionalId: professional.id,
            appointmentId: appointment.id,
            serviceId: service.id,
            baseAmount: service.price,
            type: CommissionType.PERCENTAGE,
            value: 40,
            amount: Number(service.price) * 0.4,
            referenceMonth: `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, '0')}`,
          },
        });
      }

      created += 1;
    }
  }

  // ------------------------------------------------------------- despesas
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  await prisma.financialTransaction.createMany({
    data: [
      { name: 'Aluguel do espaço', amount: 3500, category: 'Aluguel', day: 5 },
      { name: 'Compra de produtos', amount: 1200, category: 'Produtos', day: 8 },
      { name: 'Conta de energia', amount: 480, category: 'Energia', day: 10 },
      { name: 'Anúncios Instagram', amount: 600, category: 'Marketing', day: 12 },
    ].map((e) => ({
      companyId,
      type: 'EXPENSE' as const,
      origin: 'MANUAL' as const,
      description: e.name,
      amount: e.amount,
      paidAmount: e.amount,
      paymentStatus: 'PAID' as const,
      paymentMethod: 'BANK_TRANSFER' as const,
      competenceDate: new Date(monthStart.getFullYear(), monthStart.getMonth(), e.day),
      paidAt: new Date(monthStart.getFullYear(), monthStart.getMonth(), e.day),
      categoryId: expenseCategories.find((c) => c.name === e.category)?.id,
    })),
  });

  console.log(`✔ Empresa demo "Clínica Bella" criada com ${created} agendamentos`);
  console.log('  Admin:        admin@clinicabella.com / bella@12345');
  console.log('  Recepção:     recepcao@clinicabella.com / bella@12345');
  console.log('  Profissional: juliana@clinicabella.com / bella@12345');
}

/**
 * Studio de uma profissional só. Assina o mesmo Pro da clínica, mas ligou
 * poucos módulos no onboarding — é a diferença entre o que o plano *permite* e
 * o que a empresa *escolheu*.
 */
async function seedSmallStudio() {
  const slug = 'studio-nails-lu';
  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) return;

  const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: 'pro' } });
  const passwordHash = await bcrypt.hash('studio@12345', 10);

  const company = await prisma.company.create({
    data: {
      name: 'Studio Nails Lu',
      slug,
      type: 'NAIL_STUDIO',
      status: 'TRIALING',
      primaryColor: '#EC4899',
      onboardingCompleted: true,
      subscription: {
        create: {
          planId: plan.id,
          status: 'TRIALING',
          trialEndsAt: new Date(Date.now() + 10 * 86400000),
        },
      },
      modules: {
        create: (['appointments', 'customers', 'services', 'notifications'] as ModuleKey[]).map(
          (module) => ({ module, enabled: true }),
        ),
      },
      businessHours: { create: BUSINESS_HOURS },
      users: {
        create: {
          name: 'Luciana Martins',
          email: 'lu@studionails.com',
          passwordHash,
          role: 'COMPANY_ADMIN',
        },
      },
    },
  });

  const category = await prisma.serviceCategory.create({
    data: { companyId: company.id, name: 'Unhas', color: '#EC4899' },
  });

  await prisma.service.createMany({
    data: [
      { name: 'Manicure', price: 40, durationMinutes: 45 },
      { name: 'Pedicure', price: 50, durationMinutes: 60 },
      { name: 'Manutenção de alongamento', price: 120, durationMinutes: 90 },
    ].map((s) => ({ ...s, companyId: company.id, categoryId: category.id })),
  });

  await prisma.customer.createMany({
    data: [
      { name: 'Fernanda Dias', phone: '(11) 98111-0001' },
      { name: 'Gabriela Souza', phone: '(11) 98111-0002' },
    ].map((c) => ({ ...c, companyId: company.id })),
  });

  console.log('✔ Empresa "Studio Nails Lu" criada (lu@studionails.com / studio@12345)');
}


function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Espaço compartilhado de beleza — o cenário da Márcia:
 * 3 áreas, aluguel por turno e link público de agendamento em que
 * "a profissional do dia" sai de quem alugou o turno.
 */
async function seedSharedSpace() {
  const slug = 'espaco-marcia-vaz';
  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) {
    console.log('• Espaço Márcia Vaz já existe — pulando');
    return;
  }

  const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: 'premium' } });
  const passwordHash = await bcrypt.hash('marcia@12345', 10);

  const company = await prisma.company.create({
    data: {
      name: 'Espaço Márcia Vaz',
      slug,
      type: 'BEAUTY_COWORKING',
      status: 'ACTIVE',
      email: 'contato@marciavaz.com.br',
      phone: '(11) 3555-1000',
      whatsapp: '(11) 99555-1000',
      addressStreet: 'Rua das Acácias',
      addressNumber: '240',
      addressCity: 'São Paulo',
      addressState: 'SP',
      primaryColor: '#4B7C5B',
      onboardingCompleted: true,
      publicBookingEnabled: true,
      publicRequiresApproval: false,
      publicDescription:
        'Um espaço planejado para profissionais da beleza que buscam estrutura, conforto e praticidade para atender seus clientes.',
      subscription: {
        create: { planId: plan.id, status: 'ACTIVE', currentPeriodEnd: addDays(new Date(), 30) },
      },
      modules: { create: ALL_MODULES.map((module) => ({ module, enabled: true })) },
      businessHours: { create: BUSINESS_HOURS },
    },
  });

  const companyId = company.id;

  await prisma.user.create({
    data: {
      companyId,
      name: 'Márcia Vaz',
      email: 'marcia@marciavaz.com.br',
      passwordHash,
      role: 'COMPANY_ADMIN',
      phone: '(11) 99555-1000',
    },
  });

  // ------------------------------------------------------------------ turnos
  const shifts = await Promise.all(
    [
      { name: 'Manhã', startsAt: '08:00', endsAt: '12:00', sortOrder: 1 },
      { name: 'Tarde', startsAt: '13:00', endsAt: '18:00', sortOrder: 2 },
      { name: 'Noite', startsAt: '18:00', endsAt: '22:00', sortOrder: 3 },
    ].map((shift) => prisma.shift.create({ data: { ...shift, companyId } })),
  );

  const [morning, afternoon, night] = shifts;

  // -------------------------------------------------------- áreas do espaço
  const hairCategory = await prisma.resourceCategory.create({
    data: { companyId, name: 'Salão de beleza', isRoom: true },
  });
  const nailCategory = await prisma.resourceCategory.create({
    data: { companyId, name: 'Mesas de manicure', isRoom: false },
  });
  const aestheticCategory = await prisma.resourceCategory.create({
    data: { companyId, name: 'Sala de estética', isRoom: true },
  });

  const hairRoom = await prisma.resource.create({
    data: {
      companyId,
      name: 'Salão — estação de cabelo',
      description: 'Cadeira, lavatório e equipamentos. Sem procedimentos químicos.',
      categoryId: hairCategory.id,
      isRentable: true,
      dailyRate: 180,
    },
  });

  const nailTables = await Promise.all(
    ['Mesa de manicure 01', 'Mesa de manicure 02'].map((name) =>
      prisma.resource.create({
        data: {
          companyId,
          name,
          categoryId: nailCategory.id,
          isRentable: true,
          dailyRate: 120,
        },
      }),
    ),
  );

  // A sala de estética é onde a própria Márcia atende — não entra para aluguel.
  const aestheticRoom = await prisma.resource.create({
    data: {
      companyId,
      name: 'Sala de estética',
      description: 'Ambiente exclusivo e estruturado para estética corporal.',
      categoryId: aestheticCategory.id,
      isRentable: false,
    },
  });

  // Preço por espaço × turno
  const shiftPrices: { resourceId: string; shiftId: string; price: number }[] = [
    { resourceId: hairRoom.id, shiftId: morning.id, price: 90 },
    { resourceId: hairRoom.id, shiftId: afternoon.id, price: 110 },
    { resourceId: hairRoom.id, shiftId: night.id, price: 80 },
  ];
  for (const table of nailTables) {
    shiftPrices.push(
      { resourceId: table.id, shiftId: morning.id, price: 60 },
      { resourceId: table.id, shiftId: afternoon.id, price: 70 },
      { resourceId: table.id, shiftId: night.id, price: 55 },
    );
  }
  await prisma.resourceShiftPrice.createMany({
    data: shiftPrices.map((price) => ({ ...price, companyId })),
  });

  // ----------------------------------------------------------- serviços
  const categories = await Promise.all(
    [
      { name: 'Cabelo', color: '#8B5CF6' },
      { name: 'Unhas', color: '#EC4899' },
      { name: 'Estética', color: '#4B7C5B' },
    ].map((c) => prisma.serviceCategory.create({ data: { ...c, companyId } })),
  );
  const categoryId = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  const services = await Promise.all(
    [
      { name: 'Corte', price: 80, durationMinutes: 60, category: 'Cabelo' },
      { name: 'Escova', price: 70, durationMinutes: 45, category: 'Cabelo' },
      { name: 'Lavagem + finalização', price: 50, durationMinutes: 30, category: 'Cabelo' },
      { name: 'Manicure', price: 45, durationMinutes: 45, category: 'Unhas' },
      { name: 'Pedicure', price: 55, durationMinutes: 60, category: 'Unhas' },
      { name: 'Limpeza de pele', price: 180, durationMinutes: 90, category: 'Estética' },
      { name: 'Massagem modeladora', price: 160, durationMinutes: 60, category: 'Estética' },
    ].map((s) =>
      prisma.service.create({
        data: {
          companyId,
          name: s.name,
          price: s.price,
          durationMinutes: s.durationMinutes,
          categoryId: categoryId[s.category],
        },
      }),
    ),
  );

  const byName = (name: string) => services.find((s) => s.name === name)!;

  // ------------------------------------------------------- profissionais
  // Márcia é da casa: a receita dela entra no caixa da empresa.
  const marcia = await prisma.professional.create({
    data: {
      companyId,
      name: 'Márcia Vaz',
      publicSlug: slugify('Márcia Vaz'),
      specialties: ['Estética facial', 'Estética corporal'],
      color: '#4B7C5B',
      phone: '(11) 99555-1000',
      revenueOwner: 'COMPANY',
      publicBookingEnabled: true,
    },
  });

  await prisma.workingHour.createMany({
    data: [1, 2, 3, 4, 5].map((weekday) => ({
      companyId,
      professionalId: marcia.id,
      weekday,
      startsAt: '09:00',
      endsAt: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      isOff: false,
    })),
  });

  // Locatárias: alugam o espaço e cobram as próprias clientes.
  const ana = await prisma.professional.create({
    data: {
      companyId,
      name: 'Ana Ribeiro',
      publicSlug: slugify('Ana Ribeiro'),
      specialties: ['Cabelo'],
      color: '#8B5CF6',
      phone: '(11) 98111-2020',
      revenueOwner: 'PROFESSIONAL',
      publicBookingEnabled: true,
    },
  });

  const bia = await prisma.professional.create({
    data: {
      companyId,
      name: 'Bia Nunes',
      publicSlug: slugify('Bia Nunes'),
      specialties: ['Unhas'],
      color: '#EC4899',
      phone: '(11) 98111-3030',
      revenueOwner: 'PROFESSIONAL',
      publicBookingEnabled: true,
    },
  });

  await prisma.user.createMany({
    data: [
      {
        companyId,
        name: 'Ana Ribeiro',
        email: 'ana@marciavaz.com.br',
        passwordHash,
        role: 'PROFESSIONAL' as const,
      },
      {
        companyId,
        name: 'Bia Nunes',
        email: 'bia@marciavaz.com.br',
        passwordHash,
        role: 'PROFESSIONAL' as const,
      },
    ],
  });

  const anaUser = await prisma.user.findFirstOrThrow({ where: { email: 'ana@marciavaz.com.br' } });
  const biaUser = await prisma.user.findFirstOrThrow({ where: { email: 'bia@marciavaz.com.br' } });
  await prisma.professional.update({ where: { id: ana.id }, data: { userId: anaUser.id } });
  await prisma.professional.update({ where: { id: bia.id }, data: { userId: biaUser.id } });

  // Quem faz o quê
  await prisma.professionalService.createMany({
    data: [
      ...['Corte', 'Escova', 'Lavagem + finalização'].map((name) => ({
        companyId,
        professionalId: ana.id,
        serviceId: byName(name).id,
      })),
      ...['Manicure', 'Pedicure'].map((name) => ({
        companyId,
        professionalId: bia.id,
        serviceId: byName(name).id,
      })),
      ...['Limpeza de pele', 'Massagem modeladora'].map((name) => ({
        companyId,
        professionalId: marcia.id,
        serviceId: byName(name).id,
      })),
    ],
  });

  // Cada catálogo na carteira de quem cobra por ele. O que a Ana pratica de
  // preço no corte é negócio dela — a casa e a Bia não veem. Os serviços da
  // Márcia ficam sem dono: são o catálogo da casa.
  await prisma.service.updateMany({
    where: { companyId, name: { in: ['Corte', 'Escova', 'Lavagem + finalização'] } },
    data: { ownerProfessionalId: ana.id },
  });
  await prisma.service.updateMany({
    where: { companyId, name: { in: ['Manicure', 'Pedicure'] } },
    data: { ownerProfessionalId: bia.id },
  });

  // --------------------------------------------- contratos e reservas de turno
  // Ana aluga a estação de cabelo toda terça e quinta de manhã.
  await prisma.rental.create({
    data: {
      companyId,
      resourceId: hairRoom.id,
      professionalId: ana.id,
      renterName: 'Ana Ribeiro',
      renterPhone: '(11) 98111-2020',
      startsAt: startOfToday(),
      amount: 90,
      billingCycle: 'WEEKLY',
      shiftId: morning.id,
      weekdays: [2, 4],
      status: 'ACTIVE',
    },
  });

  // Bia aluga a mesa 01 nas tardes de quarta e sexta.
  await prisma.rental.create({
    data: {
      companyId,
      resourceId: nailTables[0].id,
      professionalId: bia.id,
      renterName: 'Bia Nunes',
      renterPhone: '(11) 98111-3030',
      startsAt: startOfToday(),
      amount: 70,
      billingCycle: 'WEEKLY',
      shiftId: afternoon.id,
      weekdays: [3, 5],
      status: 'ACTIVE',
    },
  });

  // Reservas concretas dos próximos 21 dias, a partir dos contratos.
  const contracts = [
    { professionalId: ana.id, resourceId: hairRoom.id, shift: morning, weekdays: [2, 4], price: 90 },
    { professionalId: bia.id, resourceId: nailTables[0].id, shift: afternoon, weekdays: [3, 5], price: 70 },
  ];

  let bookings = 0;
  /** Primeiro turno futuro de cada locatária — usado para semear a agenda dela. */
  const firstShift = new Map<string, { startsAt: Date; resourceId: string }>();

  for (let offset = 0; offset < 21; offset += 1) {
    const date = startOfToday();
    date.setDate(date.getDate() + offset);

    for (const contract of contracts) {
      if (!contract.weekdays.includes(date.getDay())) continue;

      const startsAt = new Date(date);
      startsAt.setMinutes(toMinutes(contract.shift.startsAt));
      const endsAt = new Date(date);
      endsAt.setMinutes(toMinutes(contract.shift.endsAt));

      await prisma.rentalBooking.create({
        data: {
          companyId,
          resourceId: contract.resourceId,
          professionalId: contract.professionalId,
          shiftId: contract.shift.id,
          kind: 'SHIFT',
          date,
          startsAt,
          endsAt,
          price: contract.price,
          status: 'CONFIRMED',
          paymentStatus: offset < 7 ? 'PAID' : 'PENDING',
          paidAmount: offset < 7 ? contract.price : 0,
          paymentMethod: offset < 7 ? 'PIX' : null,
          paidAt: offset < 7 ? date : null,
        },
      });
      bookings += 1;

      if (offset > 0 && !firstShift.has(contract.professionalId)) {
        firstShift.set(contract.professionalId, { startsAt, resourceId: contract.resourceId });
      }
    }
  }

  // ------------------------------------------------- contrato mensal fixo
  // Nem toda locação é por turno: a mesa 02 é alugada por mês, com parcelas.
  const monthlyStart = new Date();
  monthlyStart.setMonth(monthlyStart.getMonth() - 2, 1);
  monthlyStart.setHours(12, 0, 0, 0);

  const monthly = await prisma.rental.create({
    data: {
      companyId,
      resourceId: nailTables[1].id,
      renterName: 'Priscila Matos',
      renterPhone: '(11) 98111-5050',
      startsAt: monthlyStart,
      amount: 600,
      billingCycle: 'MONTHLY',
      dueDay: 10,
      status: 'ACTIVE',
      notes: 'Aluguel fixo da mesa 02, sem turno — cobrança mensal.',
    },
  });

  for (let i = 0; i < 3; i += 1) {
    const dueDate = new Date(monthlyStart.getFullYear(), monthlyStart.getMonth() + i, 10, 12);
    const reference = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
    const paid = i < 2;

    await prisma.rentalPayment.create({
      data: {
        companyId,
        rentalId: monthly.id,
        referenceMonth: reference,
        dueDate,
        amount: 600,
        paidAmount: paid ? 600 : 0,
        status: paid ? 'PAID' : 'PENDING',
        paidAt: paid ? dueDate : null,
        paymentMethod: paid ? 'PIX' : null,
      },
    });
  }

  // Clientes da casa — carteira da Márcia (ownerProfessionalId nulo).
  await prisma.customer.createMany({
    data: [
      { name: 'Helena Prado', phone: '(11) 97000-1111' },
      { name: 'Isabela Moreira', phone: '(11) 97000-2222' },
    ].map((c) => ({ ...c, companyId })),
  });

  // Cada locatária tem carteira própria: cliente e atendimento são dela, e não
  // aparecem para a dona do espaço — que fatura o turno, não o atendimento.
  const portfolios = [
    { professional: ana, customer: 'Renata Alves', phone: '(11) 96000-1111', service: 'Corte' },
    { professional: bia, customer: 'Tatiane Souza', phone: '(11) 96000-2222', service: 'Manicure' },
  ];

  for (const entry of portfolios) {
    const shift = firstShift.get(entry.professional.id);
    if (!shift) continue;

    const service = byName(entry.service);
    const customer = await prisma.customer.create({
      data: {
        companyId,
        ownerProfessionalId: entry.professional.id,
        name: entry.customer,
        phone: entry.phone,
        whatsapp: entry.phone,
      },
    });

    const startsAt = new Date(shift.startsAt);
    startsAt.setMinutes(startsAt.getMinutes() + 60);
    const endsAt = new Date(startsAt);
    endsAt.setMinutes(endsAt.getMinutes() + service.durationMinutes);

    await prisma.appointment.create({
      data: {
        companyId,
        customerId: customer.id,
        professionalId: entry.professional.id,
        ownerProfessionalId: entry.professional.id,
        roomId: shift.resourceId,
        startsAt,
        endsAt,
        durationMinutes: service.durationMinutes,
        status: 'CONFIRMED',
        totalPrice: service.price,
        services: {
          create: {
            companyId,
            serviceId: service.id,
            name: service.name,
            price: service.price,
            durationMinutes: service.durationMinutes,
            quantity: 1,
          },
        },
      },
    });
  }

  await prisma.expenseCategory.createMany({
    data: ['Aluguel do imóvel', 'Energia', 'Produtos', 'Marketing'].map((name) => ({
      companyId,
      name,
    })),
  });

  console.log(`✔ "Espaço Márcia Vaz" criado — 3 áreas, 3 turnos e ${bookings} reservas`);
  console.log('  Dona:       marcia@marciavaz.com.br / marcia@12345');
  console.log('  Locatárias: ana@marciavaz.com.br e bia@marciavaz.com.br / marcia@12345');
  console.log(`  Link público: /e/${slug}`);
}


/**
 * `npm run seed` popula tudo — é o banco de demonstração, com três empresas e
 * contas de senha conhecida.
 *
 * `npm run seed:plans` cria **apenas os planos**, que é o que a produção
 * precisa: sem eles o cadastro recusa a primeira empresa ("Nenhum plano
 * disponível para assinatura"), e não há tela para criá-los antes de existir um
 * super admin. As contas de demonstração jamais devem ir para produção — elas
 * são públicas neste repositório.
 */
async function main() {
  if (process.argv.includes('--plans')) {
    console.log('\n🌱 Criando os planos (modo produção)...\n');
    await seedPlans();
    console.log('\n✅ Planos prontos. Nenhuma conta de demonstração foi criada.\n');
    return;
  }

  console.log('\n🌱 Populando o banco...\n');
  await seedPlans();
  await seedSuperAdmin();
  await seedDemoCompany();
  await seedSmallStudio();
  await seedSharedSpace();
  console.log('\n✅ Seed concluído\n');
}

main()
  .catch((error) => {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
