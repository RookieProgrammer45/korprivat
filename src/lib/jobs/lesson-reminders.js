// jobs/lesson-reminders.js — 24h-before lesson reminder cron.
//
// Runs under plain `node` (NOT via Next.js). The deploy platform picks this
// up via the [[crons]] block in polsia.toml:
//   schedule = "5 * * * *"     (every hour at :05; off the noisy :00 slot)
//   command  = "node src/lib/jobs/lesson-reminders.js"
//
// Reads all booked lessons starting in [now, now+25h] that haven't been
// reminded yet (`reminderSentAt IS NULL`), emails both the student and the
// instructor (lesson date/time + the other party's name) and stamps
// `reminderSentAt = now()` once both sends return, so a re-run within the
// window NEVER double-fires.
//
// Reflection of a planned in-app sender: `lessonReminderEmail(...)` lives in
// `src/lib/email/templates.ts` (user-owned). The TS module pulls in
// `import 'server-only'`, which throws under bare `node`, so the cron
// re-implements the body builders in plain JS. KEEP BOTH IN LOCK-STEP —
// the immutable lesson-time string and the flipping copy live in TWO
// places; a divergence silently ships wrong bodies.

const { PrismaClient } = require('@prisma/client');
const nodeFetch = require('node-fetch').default || require('node-fetch');

const EMAIL_PROXY_URL = 'https://polsia.com/api/proxy/email';
const WINDOW_HOURS = 25;

// Mirrors `INSTRUCTOR_TIMEZONE` in src/app/api/bookings/route.ts.
// Only Stockholm / Göteborg are mapped; any other city falls through to
// the UTC fallback (same convention as the in-app helper).
const INSTRUCTOR_TIMEZONE = new Map([
  ['Stockholm', 'Europe/Stockholm'],
  ['Göteborg', 'Europe/Stockholm'],
]);

function formatLessonTime(city, when) {
  const tz = INSTRUCTOR_TIMEZONE.get(city);
  if (!tz) {
    return `${when.toISOString().replace('T', ' ').slice(0, 16)} (UTC)`;
  }
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: tz,
  }).format(when);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextHtml(text) {
  return text
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br>');
}

// Lock-step with `lessonReminderEmail({ recipientRole: 'student' })` in
// src/lib/email/templates.ts. Subject + body carry the lesson date/time
// and the OTHER party's name (the student sees the instructor).
function buildStudentReminderBody(input) {
  const subject = `Reminder: your lesson with ${input.otherPartyName} is tomorrow`;
  const text = [
    subject,
    '',
    `Hi ${input.recipientName},`,
    `Just a heads-up — your ${input.category} lesson with ${input.otherPartyName} is tomorrow at ${input.lessonDateTime} (${input.lessonCity} time).`,
    `Show up a few minutes early with your learner's permit ready. If something changed, contact your instructor directly using the details they shared when they confirmed the booking.`,
    '',
    `Boknings-id: ${input.bookingId}`,
  ].join('\n');
  return { subject, text };
}

// Lock-step with `lessonReminderEmail({ recipientRole: 'instructor' })`.
// Subject + body flip which side of the table sits in `recipientName` —
// the instructor sees the student.
function buildInstructorReminderBody(input) {
  const subject = `Reminder: lesson with ${input.otherPartyName} is tomorrow`;
  const text = [
    subject,
    '',
    `Hi ${input.recipientName},`,
    `Just a heads-up — your ${input.category} lesson with ${input.otherPartyName} is tomorrow at ${input.lessonDateTime} (${input.lessonCity} time).`,
    `Arrive at your usual meeting point a few minutes early. If you need to reschedule, reach out to the learner as soon as possible so they can plan around it.`,
    '',
    `Boknings-id: ${input.bookingId}`,
  ].join('\n');
  return { subject, text };
}

async function sendViaProxy(to, subject, text) {
  if (!process.env.POLSIA_API_KEY) {
    throw new Error('POLSIA_API_KEY is required for jobs/lesson-reminders.js');
  }
  const res = await nodeFetch(`${EMAIL_PROXY_URL}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.POLSIA_API_KEY}`,
    },
    body: JSON.stringify({
      to,
      subject,
      body: text,
      html: plainTextHtml(text),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`email proxy POST failed (${res.status} ${res.statusText}): ${detail}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for jobs/lesson-reminders.js');
  }

  const prisma = new PrismaClient({ log: ['error', 'warn'] });

  const start = new Date();
  const end = new Date(start.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  // Conditional select — keeps the row tight (no Slot / back-relations).
  // `bookedSlot` is intentionally NOT pulled in: `Booking.preferredAt`
  // already equals the slot's `startsAt` and works for legacy bookings
  // created before the slot feature shipped.
  const bookings = await prisma.booking.findMany({
    where: {
      preferredAt: { gte: start, lte: end },
      reminderSentAt: null,
    },
    select: {
      id: true,
      studentName: true,
      studentEmail: true,
      category: true,
      preferredAt: true,
      instructor: { select: { name: true, city: true, email: true } },
    },
  });

  for (const booking of bookings) {
    const instructor = booking.instructor;
    if (!instructor) {
      // Defensive: Booking.instructor is required by the schema, so this
      // shouldn't fire. If it does, skip rather than throw — the cron
      // shouldn't take the whole batch down on one orphan row.
      continue;
    }

    const lessonDateTime = formatLessonTime(instructor.city, booking.preferredAt);
    const lessonCity = instructor.city;

    const studentContent = buildStudentReminderBody({
      recipientName: booking.studentName,
      otherPartyName: instructor.name,
      category: booking.category,
      lessonDateTime,
      lessonCity,
      bookingId: booking.id,
    });

    const tasks = [sendViaProxy(booking.studentEmail, studentContent.subject, studentContent.text)];

    let instructorContent = null;
    if (instructor.email) {
      instructorContent = buildInstructorReminderBody({
        recipientName: instructor.name,
        otherPartyName: booking.studentName,
        category: booking.category,
        lessonDateTime,
        lessonCity,
        bookingId: booking.id,
      });
      tasks.push(sendViaProxy(instructor.email, instructorContent.subject, instructorContent.text));
    }

    const results = await Promise.allSettled(tasks);
    const studentOk = results[0].status === 'fulfilled';
    const instructorOk = !instructorContent || (results[1] && results[1].status === 'fulfilled');

    // Stamp `reminderSentAt` only when the student send succeeded AND
    // the instructor either sent OK or was legitimately skipped (no email
    // on file). One-side crash does NOT stamp — the next cron run will
    // retry the missing side (same convention as `POST /api/bookings`'s
    // notify block, which swallows one-side failures but accepts that
    // operator follow-up can re-fire).
    if (studentOk && instructorOk) {
      await prisma.booking.updateMany({
        where: { id: booking.id, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      });
    }
  }

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(() => {
    process.exit(1);
  });
