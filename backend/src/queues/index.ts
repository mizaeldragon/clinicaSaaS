import { JobsOptions, Queue } from 'bullmq';
import { getRedisConnection, isQueueEnabled } from './connection';
import { logger } from '../shared/utils/logger';

export const QUEUE_NAMES = {
  reminders: 'reminders',
  notifications: 'notifications',
  rentals: 'rentals',
  reports: 'reports',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  appointmentReminder: 'appointment.reminder',
  sendNotification: 'notification.send',
  generateRentalCharges: 'rental.generate-charges',
  markOverdueRentals: 'rental.mark-overdue',
  buildReport: 'report.build',
} as const;

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue | null {
  if (!isQueueEnabled()) return null;
  const connection = getRedisConnection();
  if (!connection) return null;

  const existing = queues.get(name);
  if (existing) return existing;

  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 3600, count: 500 },
      removeOnFail: { age: 24 * 3600 },
    },
  });

  queues.set(name, queue);
  return queue;
}

/** Enfileira um job. Se o Redis estiver desabilitado, apenas registra em log. */
export async function enqueue(
  queueName: QueueName,
  jobName: string,
  data: unknown,
  opts?: JobsOptions,
): Promise<void> {
  const queue = getQueue(queueName);
  if (!queue) {
    logger.debug({ queueName, jobName }, 'Fila desabilitada — job ignorado');
    return;
  }
  try {
    await queue.add(jobName, data, opts);
  } catch (error) {
    logger.warn({ error, queueName, jobName }, 'Falha ao enfileirar job');
  }
}

/** Agenda os jobs repetitivos do SaaS (cron). */
export async function registerRepeatableJobs(): Promise<void> {
  const rentals = getQueue(QUEUE_NAMES.rentals);
  if (!rentals) return;

  // Todo dia às 03:00: gera cobranças recorrentes e marca atrasos.
  await rentals.add(
    JOB_NAMES.generateRentalCharges,
    {},
    { repeat: { pattern: '0 3 * * *' }, jobId: 'cron:generate-rental-charges' },
  );
  await rentals.add(
    JOB_NAMES.markOverdueRentals,
    {},
    { repeat: { pattern: '30 3 * * *' }, jobId: 'cron:mark-overdue-rentals' },
  );

  logger.info('Jobs recorrentes registrados');
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
}
