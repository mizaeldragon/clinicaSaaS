import { Job, Worker } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES, registerRepeatableJobs } from '../queues';
import { getRedisConnection } from '../queues/connection';
import { logger } from '../shared/utils/logger';
import { prisma } from '../shared/database/prisma';
import { tenantContext } from '../shared/database/tenantContext';
import { notificationsService } from '../modules/notifications/notifications.service';
import { rentalsService } from '../modules/rentals/rentals.service';
import { bookingsService } from '../modules/rentals/bookings.service';

const connection = getRedisConnection();

if (!connection) {
  logger.warn('REDIS_ENABLED=false — worker não iniciado');
  process.exit(0);
}

/** Lembrete de agendamento (24h e 1h antes). */
async function handleReminder(job: Job) {
  const { companyId, appointmentId, window } = job.data as {
    companyId: string;
    appointmentId: string;
    window: string;
  };

  const appointment = await tenantContext.runAsSystem(() =>
    prisma.appointment.findFirst({
      where: { id: appointmentId, companyId },
      include: {
        customer: { select: { name: true, phone: true, whatsapp: true } },
        professional: { select: { id: true, name: true } },
      },
    }),
  );

  if (!appointment) return;
  if (!['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) return;

  await notificationsService.notifyEvent(companyId, 'APPOINTMENT_REMINDER', {
    title: `Lembrete de atendimento (${window})`,
    message: `${appointment.customer.name} às ${appointment.startsAt.toLocaleString('pt-BR')}${
      appointment.professional ? ` com ${appointment.professional.name}` : ''
    }`,
    data: { appointmentId, window },
  });
}

/**
 * Entrega em canais externos. O envio real (SMTP/WhatsApp) é plugado aqui —
 * a estrutura já persiste e marca a notificação como enviada.
 */
async function handleNotification(job: Job) {
  const { notificationId, companyId } = job.data as { notificationId: string; companyId: string };

  const notification = await tenantContext.runAsSystem(() =>
    prisma.notification.findFirst({ where: { id: notificationId, companyId } }),
  );
  if (!notification) return;

  logger.info(
    { channel: notification.channel, title: notification.title },
    'Despachando notificação externa (integração pendente de credenciais)',
  );

  await tenantContext.runAsSystem(() =>
    prisma.notification.update({ where: { id: notificationId }, data: { sentAt: new Date() } }),
  );
}

async function handleRentals(job: Job) {
  if (job.name === JOB_NAMES.generateRentalCharges) {
    const result = await rentalsService.generateAllCharges();
    logger.info(result, 'Cobranças de aluguel geradas');
    return;
  }
  if (job.name === JOB_NAMES.generateShiftBookings) {
    const result = await bookingsService.generateFromContracts();
    logger.info(result, 'Reservas de turno geradas a partir dos contratos');
    return;
  }
  if (job.name === JOB_NAMES.markOverdueRentals) {
    const result = await rentalsService.markOverdue();
    logger.info(result, 'Aluguéis atrasados atualizados');
  }
}

const workers = [
  new Worker(QUEUE_NAMES.reminders, handleReminder, { connection, concurrency: 5 }),
  new Worker(QUEUE_NAMES.notifications, handleNotification, { connection, concurrency: 10 }),
  new Worker(QUEUE_NAMES.rentals, handleRentals, { connection, concurrency: 1 }),
  new Worker(
    QUEUE_NAMES.reports,
    async (job) => {
      logger.info({ job: job.name }, 'Processamento de relatório');
    },
    { connection, concurrency: 2 },
  ),
];

for (const worker of workers) {
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, err: err.message }, 'Job falhou');
  });
  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, name: job.name }, 'Job concluído');
  });
}

void registerRepeatableJobs();

logger.info('⚙️  Worker BullMQ iniciado');

async function shutdown() {
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
