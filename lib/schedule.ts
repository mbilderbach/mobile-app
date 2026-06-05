import { Prayer } from './types';

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | string | null | undefined;

export function todayISO(): string {
  return toISODate(new Date());
}

export function toLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildNextFire(scheduleDate?: string | null, scheduleTime?: string | null): string | null {
  if (!scheduleDate) return null;
  const time = scheduleTime || '08:00';
  const [hours, minutes] = time.split(':').map(Number);
  const date = toLocalDate(scheduleDate);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toISOString();
}

export function nextDateAfter(fromISO: string, recurrence: Recurrence): string | null {
  if (!fromISO || !recurrence || recurrence === 'none') return null;
  const next = toLocalDate(fromISO);

  if (recurrence === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (recurrence === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (recurrence === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    return null;
  }

  return toISODate(next);
}

export function nextDateAfterToday(recurrence: Recurrence): string | null {
  return nextDateAfter(todayISO(), recurrence);
}

export function isOverdue(prayer: Prayer, today = todayISO()): boolean {
  return !!prayer.schedule_date && prayer.schedule_date < today;
}

export function recurrenceLabel(recurrence: Recurrence): string | null {
  if (!recurrence || recurrence === 'none') return null;
  return recurrence.charAt(0).toUpperCase() + recurrence.slice(1);
}
