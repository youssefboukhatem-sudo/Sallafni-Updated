import { ApiStatus, IncomingRequest, OutgoingRequest } from './models';

const d = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00');
export const fmtShort = (s: string) => d(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const fmtDay = (s: string) => d(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtMonth = (s: string) => d(s).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
export const fmtRange = (a: string, b: string) => (a === b ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`);

export const STATUS_LABEL: Record<ApiStatus, string> = {
  pending: 'Pending', accepted: 'Accepted', declined: 'Declined', returned: 'Returned',
};
export const STATUS_BADGE: Record<ApiStatus, string> = {
  pending: 'b-wait', accepted: 'b-ok', declined: 'b-done', returned: 'b-done',
};

export function outgoingInfo(r: OutgoingRequest): string {
  switch (r.status) {
    case 'pending': return `Waiting for reply · Pick-up ${fmtShort(r.from)} · Return ${fmtShort(r.to)}`;
    case 'accepted': return `Pick-up ${fmtShort(r.from)} · Return by ${fmtShort(r.to)}`;
    case 'declined': return 'The lender could not lend this item';
    case 'returned': return `Returned ${fmtShort(r.returnedAt ?? r.to)}`;
  }
}

export function loanInfo(r: IncomingRequest): string {
  return r.status === 'returned' ? `Returned ${fmtShort(r.returnedAt ?? r.to)}` : `Accepted · ${fmtRange(r.from, r.to)}, waiting for return`;
}

export const errorMessage = (e: unknown): string => {
  const err = e as { error?: { error?: string }; status?: number };
  return err?.error?.error ?? (err?.status === 0 ? 'Cannot reach the server. Is the backend running on port 3000?' : 'Something went wrong. Please try again.');
};
