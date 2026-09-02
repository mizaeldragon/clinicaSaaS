/* eslint-disable no-console */
import { PrismaClient, ModuleKey, CommissionType, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
      name: 'Starter',
      slug: 'starter',
      description: 'Para quem está começando: agenda, clientes e serviços.',
      price: 49.9,
      trialDays: 14,
      maxUsers: 2,
      maxProfessionals: 2,
      maxAppointmentsMonth: 300,
      modules: ['appointments', 'customers', 'services', 'notifications'],
      sortOrder: 1,
    },
    {
      name: 'Pro',
      slug: 'pro',
      description: 'Equipe, financeiro e relatórios para crescer com controle.',
      price: 99.9,
      trialDays: 14,
      maxUsers: 8,
      maxProfessionals: 10,
      maxAppointmentsMonth: 2000,
      modules: [
        'appointments',
        'customers',
        'services',
        'professionals',
        'financial',
        'reports',
        'notifications',
      ],
      sortOrder: 2,
    },
    {
      name: 'Business',
      slug: 'business',
      description: 'Operação completa: recursos, salas, aluguéis e comissões.',
      price: 199.9,
      trialDays: 14,
      maxUsers: null,
      maxProfessionals: null,
      maxAppointmentsMonth: null,
      modules: ALL_MODULES,
      sortOrder: 3,
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

  console.log('✔ Planos criados');
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

  const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: 'business' } });

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
        rentsSpaces: true,
        rentalResourceKeys: ['tables', 'rooms'],
      },
      subscription: {
        create: {
          planId: plan.id,
          status: 'ACTIVE',
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
        },
      },
      modules: { create: ALL_MODULES.map((module) => ({ module, enabled: true })) },
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

  // -------------------------------------------------------------- aluguéis
  const rentalStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);

  const rental = await prisma.rental.create({
    data: {
      companyId,
      resourceId: tables[0].id,
      professionalId: professionals[0].id,
      renterName: 'Juliana Alves',
      renterPhone: '(11) 97777-0000',
      startsAt: rentalStart,
      amount: 500,
      billingCycle: 'MONTHLY',
      dueDay: 10,
      status: 'ACTIVE',
    },
  });

  await prisma.resource.update({ where: { id: tables[0].id }, data: { status: 'IN_USE' } });

  for (let i = 0; i < 3; i += 1) {
    const dueDate = new Date(rentalStart.getFullYear(), rentalStart.getMonth() + i, 10, 12);
    const reference = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
    const paid = i < 2;

    await prisma.rentalPayment.create({
      data: {
        companyId,
        rentalId: rental.id,
        referenceMonth: reference,
        dueDate,
        amount: 500,
        paidAmount: paid ? 500 : 0,
        status: paid ? 'PAID' : 'PENDING',
        paidAt: paid ? dueDate : null,
        paymentMethod: paid ? 'PIX' : null,
      },
    });
  }

  console.log(`✔ Empresa demo "Clínica Bella" criada com ${created} agendamentos`);
  console.log('  Admin:        admin@clinicabella.com / bella@12345');
  console.log('  Recepção:     recepcao@clinicabella.com / bella@12345');
  console.log('  Profissional: juliana@clinicabella.com / bella@12345');
}

/** Empresa pequena (plano Starter) — mostra o sistema modular em ação. */
async function seedSmallStudio() {
  const slug = 'studio-nails-lu';
  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) return;

  const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: 'starter' } });
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

async function main() {
  console.log('\n🌱 Populando o banco...\n');
  await seedPlans();
  await seedSuperAdmin();
  await seedDemoCompany();
  await seedSmallStudio();
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
