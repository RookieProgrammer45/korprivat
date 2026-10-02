// Persist unsigned booking form drafts across login/signup redirects.

const DRAFT_PREFIX = 'dlu_booking_draft:';

export type BookingFormDraft = {
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  category: string;
  slotId: string;
};

function draftKey(instructorId: string): string {
  return `${DRAFT_PREFIX}${instructorId}`;
}

export function persistBookingDraft(instructorId: string, draft: BookingFormDraft): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(draftKey(instructorId), JSON.stringify(draft));
  } catch {
    // private mode / quota — ignore
  }
}

export function readBookingDraft(instructorId: string): BookingFormDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(draftKey(instructorId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BookingFormDraft>;
    if (typeof parsed.studentName !== 'string') return null;
    return {
      studentName: parsed.studentName,
      studentEmail: typeof parsed.studentEmail === 'string' ? parsed.studentEmail : '',
      studentPhone: typeof parsed.studentPhone === 'string' ? parsed.studentPhone : '',
      category: typeof parsed.category === 'string' ? parsed.category : '',
      slotId: typeof parsed.slotId === 'string' ? parsed.slotId : '',
    };
  } catch {
    return null;
  }
}

export function clearBookingDraft(instructorId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(draftKey(instructorId));
  } catch {
    // ignore
  }
}
