import type { RequestStatus } from '@/types';

export type RequestDecision = 'Approved' | 'Rejected' | 'Additional Information Required' | 'Pending Approval';

const REVIEWABLE_STATUSES: RequestStatus[] = [
  'Pending Approval',
  'Additional Information Required',
];

export function canReviewRequest(status: RequestStatus): boolean {
  return REVIEWABLE_STATUSES.includes(status);
}

export function canTransitionRequest(status: RequestStatus, next: RequestDecision): boolean {
  if (next === 'Pending Approval') return canReviewRequest(status);
  return canReviewRequest(status) && next !== status;
}

export function findUniqueIdentityNameMatch<T extends { name: string; isArchived: boolean }>(
  identities: T[],
  submittedName: string,
): T | undefined {
  const matches = identities.filter((identity) => !identity.isArchived
    && identity.name.trim().toLocaleLowerCase() === submittedName.trim().toLocaleLowerCase());
  return matches.length === 1 ? matches[0] : undefined;
}

export function requiresDemoOtp(category: string, requireOtpForGuests: boolean): boolean {
  return requireOtpForGuests && category === 'Guest/External Visitor';
}

export type DateRange = { start: Date; end: Date };

export function getLocalDateRange(
  period: 'today' | 'week' | 'month',
  now = new Date(),
): DateRange {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === 'week') {
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
  } else if (period === 'month') {
    start.setDate(1);
  }

  return { start, end };
}

export function isInDateRange(timestamp: string, range: DateRange): boolean {
  const time = Date.parse(timestamp);
  return Number.isFinite(time) && time >= range.start.getTime() && time <= range.end.getTime();
}

export function getHourlyEventCounts<T extends { timestamp: string; eventType: string }>(
  events: T[],
  range: DateRange,
): { time: string; entries: number; exits: number }[] {
  const bins = Array.from({ length: 24 }, (_, hour) => ({
    time: `${String(hour).padStart(2, '0')}:00`,
    entries: 0,
    exits: 0,
  }));

  for (const event of events) {
    if (!isInDateRange(event.timestamp, range)) continue;
    const hour = new Date(event.timestamp).getHours();
    if (event.eventType === 'Entry') bins[hour].entries += 1;
    if (event.eventType === 'Exit') bins[hour].exits += 1;
  }

  return bins;
}
