// @polsia:user-owned — your email templates. Edit, add, or delete freely.
// Each template returns { subject, html, text }; spread it into the framework transport:
//   import { sendEmail } from '@/lib/email/send';
//   await sendEmail({ to: user.email, ...someTemplate({ name: user.name, … }) });
// renderEmail() is a plain inline-styled shell — email clients drop <style>/<link>, so style inline.
// renderEmail() auto-escapes its heading/body/cta/footer, so pass RAW values (don't escapeHtml() them
// first — that double-escapes). escapeHtml() is only for when you hand-build an html string yourself.

/** Subject + rendered bodies — spread into sendEmail({ to, ... }). */
export interface EmailContent {
  subject: string;
  html: string;
  text?: string;
}

type BookingLocale = 'sv' | 'en';

export interface RenderEmailOptions {
  heading: string;
  /** Body paragraphs (plain text; escaped for you). */
  body: string[];
  /** Optional call-to-action button. */
  cta?: { label: string; url: string };
  /** Optional footer line under the divider. */
  footer?: string;
}

/** Escape a value for safe interpolation into an HTML attribute or text node. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wrap content in a minimal, inline-styled email shell. Restyle to match the brand. */
export function renderEmail(options: RenderEmailOptions): {
  html: string;
  text: string;
} {
  const paragraphs = options.body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;color:#333333;font-size:15px;line-height:1.6;">${escapeHtml(line)}</p>`,
    )
    .join('');
  const button = options.cta
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(options.cta.url)}" style="display:inline-block;padding:10px 20px;background:#111111;color:#ffffff;text-decoration:none;font-size:15px;">${escapeHtml(options.cta.label)}</a></p>`
    : '';
  const footer = options.footer
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;color:#999999;font-size:12px;">${escapeHtml(options.footer)}</div>`
    : '';
  const html = [
    '<div style="max-width:560px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;">',
    `<h1 style="margin:0 0 16px;color:#111111;font-size:22px;">${escapeHtml(options.heading)}</h1>`,
    paragraphs,
    button,
    footer,
    '</div>',
  ].join('');
  const text = [
    options.heading,
    '',
    ...options.body,
    ...(options.cta ? ['', `${options.cta.label}: ${options.cta.url}`] : []),
    ...(options.footer ? ['', options.footer] : []),
  ].join('\n');
  return { html, text };
}

// ─── Generic / utility templates ──────────────────────────────────────

/** Generic notification email. */
export function notificationEmail(input: {
  subject: string;
  title: string;
  lines: string[];
  cta?: { label: string; url: string };
}): EmailContent {
  const { html, text } = renderEmail({
    heading: input.title,
    body: input.lines,
    cta: input.cta,
  });
  return { subject: input.subject, html, text };
}

// ─── Waitlist / early-access templates ────────────────────────────────

/**
 * Confirmation sent immediately after someone joins the DriveLinkUp
 * early-access list. `role` flips which copy block is shown so a student
 * and an instructor don't get the same generic reply.
 */
export function waitlistConfirmationEmail(input: {
  name: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'HANDLEDARE';
}): EmailContent {
  const { name, role } = input;
  if (role === 'INSTRUCTOR') {
    const { html, text } = renderEmail({
      heading: `You're on the DriveLinkUp early-access list — thanks, ${name}`,
      body: [
        `We've got you down as an authorized driving school interested in listing on DriveLinkUp.`,
        `We'll review your school information and walk through the listing before it goes live.`,
        `In the meantime, we'd love to hear what scheduling categories you teach and a few openings you typically have, so we can prioritise the right city and category in the pilot.`,
      ],
      footer: 'DriveLinkUp · launching in Sweden',
    });
    return {
      subject: "You're on the DriveLinkUp early-access list",
      html,
      text,
    };
  }
  const { html, text } = renderEmail({
    heading: `You're on the DriveLinkUp early-access list — thanks, ${name}`,
    body: [
      `We've saved your spot on the DriveLinkUp launch list.`,
      `When we go live, you'll be able to compare authorized schools by licence category, language, neighbourhood, published price and availability.`,
      `No spam — you'll get one launch email, then only updates that matter for you.`,
    ],
    footer: 'DriveLinkUp · launching in Sweden',
  });
  return { subject: "You're on the DriveLinkUp early-access list", html, text };
}

/**
 * Launch-notify broadcast: sent when DriveLinkUp goes live to everyone who
 * joined the early-access list. Cron-driven (see jobs/waitlist-launch-notify.mjs).
 */
export function waitlistLaunchNotifyEmail(input: { name: string; ctaUrl: string }): EmailContent {
  const { html, text } = renderEmail({
    heading: `DriveLinkUp is live — sign in, ${input.name}`,
    body: [
      'The marketplace is open. Create your learner profile, compare authorized schools, and book your first slot with no separate DriveLinkUp fee.',
      'If you signed up as a school, your listing can show the price and availability your school controls.',
    ],
    cta: { label: 'Sign in to DriveLinkUp', url: input.ctaUrl },
    footer: 'DriveLinkUp · launching in Sweden',
  });
  return { subject: 'DriveLinkUp is live — sign in', html, text };
}

/**
 * Drop a circular avatar `<img>` into a rendered welcome email. Splits on
 * the closing `</h1>` so the avatar lands directly under the greeting
 * without disturbing the paragraph / CTA / footer layout downstream.
 */
function injectAvatar(html: string, imageUrl: string): string {
  const safeUrl = escapeHtml(imageUrl);
  const tag = `<img src="${safeUrl}" alt="" style="display:block;width:96px;height:96px;border-radius:9999px;object-fit:cover;margin:0 0 20px;">`;
  return html.replace('</h1>', `</h1>${tag}`);
}

/** Append the canonical avatar URL on its own line in the plain-text body
 *  so recipients on text-only clients can still see it. */
function appendImageUrl(text: string, imageUrl: string): string {
  return `${text}\n\nProfile picture: ${imageUrl}`;
}

// ─── Auth / account templates ──────────────────────────────────────────

/**
 * Welcome email after a new account creation. The `/api/auth/welcome` route
 * is the only place this is sent — fired exactly once per new account, gated
 * by `UserProfile.welcomeSentAt`. Role-flips the copy so a student and an
 * instructor don't get the same generic reply.
 *
 * `imageUrl` is optional: when present, the email renders an avatar circle
 * below the greeting and the subject + heading switch to "Your profile is
 * set up" — the honest signal that no follow-up step is required before
 * the learner can book a lesson. When missing (no picture uploaded), the
 * template falls back to the generic welcome so picture-less signups still
 * get a welcome row.
 */
export function signedUpWelcomeEmail(input: {
  name: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'HANDLEDARE';
  dashboardUrl: string;
  imageUrl?: string;
}): EmailContent {
  const { name, role, dashboardUrl, imageUrl } = input;
  const avatar = imageUrl?.trim();
  const heading = avatar
    ? `Your profile is set up — welcome to DriveLinkUp, ${name}`
    : `Welcome to DriveLinkUp, ${name}`;
  if (role === 'INSTRUCTOR') {
    const baseBody = [
      `Your school account is live. Next: set your categories, published price, and weekly availability — we'll review the school information before the listing becomes searchable.`,
      `You'll see booking requests come straight to your dashboard. Keep the published listing accurate and confirm or decline according to your own operations.`,
      avatar ? `Your profile is set up and you're ready to list your availability.` : null,
    ].filter((line): line is string => line !== null);
    const { html: baseHtml, text: baseText } = renderEmail({
      heading,
      body: baseBody,
      cta: { label: 'Open your school dashboard', url: dashboardUrl },
      footer: 'DriveLinkUp · launching in Sweden',
    });
    return {
      subject: avatar
        ? 'Your profile is set up — welcome to DriveLinkUp'
        : 'Welcome to DriveLinkUp',
      html: avatar ? injectAvatar(baseHtml, avatar) : baseHtml,
      text: avatar ? appendImageUrl(baseText, avatar) : baseText,
    };
  }
  const baseBody = [
    `Your learner account is live. Tell us your licence goal, preferred language, neighbourhood, schedule, and budget so you can compare authorized schools nearby.`,
    `You can browse the pilot cohort right now, or wait for the launch email with the full marketplace.`,
    avatar ? `Your profile is set up and you're ready to start.` : null,
  ].filter((line): line is string => line !== null);
  const { html: baseHtml, text: baseText } = renderEmail({
    heading,
    body: baseBody,
    cta: { label: 'Open your dashboard', url: dashboardUrl },
    footer: 'DriveLinkUp · launching in Sweden',
  });
  return {
    subject: avatar ? 'Your profile is set up — welcome to DriveLinkUp' : 'Welcome to DriveLinkUp',
    html: avatar ? injectAvatar(baseHtml, avatar) : baseHtml,
    text: avatar ? appendImageUrl(baseText, avatar) : baseText,
  };
}

// ─── Escrow-style booking templates ───────────────────────────────────

/**
 * Plain-text "we received your booking" note the learner gets after the
 * Instant-mode POST. Keeps the existing letter format the legacy
 * /api/bookings route used so we don't pull in a separate template
 * directory just to hold a one-paragraph confirmation.
 */
export function studentBookingRequestReceivedEmail(input: {
  studentName: string;
  category: string;
  bookingId: string;
  instructorName: string;
  preferredAtLocal: string;
  instructorCity: string;
  bookingUrl?: string;
  locale?: BookingLocale;
}): EmailContent {
  const isSwedish = input.locale === 'sv';
  const body = [
    isSwedish ? `Hej ${input.studentName},` : `Hi ${input.studentName},`,
    '',
    isSwedish
      ? `Tack för att du bokade en ${input.category}-lektion via DriveLinkUp. Din bokning har registrerats med id ${input.bookingId}. ${input.instructorName} återkommer inom en arbetsdag för att bekräfta ${input.preferredAtLocal} (lokal tid i ${input.instructorCity}) och berätta nästa steg.`
      : `Thanks for booking a ${input.category} lesson through DriveLinkUp. Your request has been logged with id ${input.bookingId}. ${input.instructorName} will reach out within one business day to confirm ${input.preferredAtLocal} (in ${input.instructorCity} time) and walk you through the next steps.`,
    '',
    '— DriveLinkUp',
  ].join('\n');

  const bookingCta = input.bookingUrl
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(input.bookingUrl)}" style="display:inline-block;padding:10px 20px;background:#111111;color:#ffffff;text-decoration:none;font-size:15px;">Open booking details</a></p>`
    : '';
  return {
    subject: isSwedish
      ? 'Vi har tagit emot din bokning — DriveLinkUp'
      : 'We received your booking request — DriveLinkUp',
    text: input.bookingUrl
      ? `${body}\n\n${isSwedish ? 'Öppna bokningsdetaljer' : 'Open booking details'}: ${input.bookingUrl}`
      : body,
    html:
      body
        .split('\n')
        .map(
          (line) =>
            `<p style="margin:0 0 8px;color:#333333;font-size:15px;line-height:1.5;">${escapeHtml(line) || '&nbsp;'}</p>`,
        )
        .join('') + bookingCta,
  };
}

/**
 * Receipt to the learner after Stripe confirms payment. Funds are held in
 * escrow until the lesson is marked complete. The action links carry the
 * booking's unguessable action token in the URL.
 */
export function paymentHeldReceiptEmail(input: {
  recipientName: string;
  bookingId: string;
  instructorName: string;
  completeUrl: string;
  disputeUrl: string;
  bookingUrl?: string;
}): EmailContent {
  const { html, text } = renderEmail({
    heading: 'Betalning mottagen — hålls i escrow tills din lektion är genomförd',
    body: [
      `Hej ${input.recipientName},`,
      `Vi har tagit emot din betalning för lektionen med ${input.instructorName}. Pengarna ligger säkert i escrow och släpps först till skolan när lektionen är genomförd.`,
      `Markera lektionen som genomförd: ${input.completeUrl}`,
      `Öppna en tvist om något gick fel: ${input.disputeUrl}`,
    ],
    cta: input.bookingUrl ? { label: 'Öppna bokningsdetaljer', url: input.bookingUrl } : undefined,
    footer: `Boknings-id: ${input.bookingId}`,
  });
  return { subject: 'Betalning mottagen — medlen ligger i escrow', html, text };
}

export function bookingReceiptEmail(input: {
  locale: 'sv' | 'en';
  recipientRole: 'learner' | 'instructor';
  recipientName: string;
  instructorName: string;
  category: string;
  lessonDate: string;
  receiptUrl: string;
  completeUrl?: string;
  disputeUrl?: string;
  bookingId: string;
  priceAmountSek: number;
  serviceFeeSek: number;
  grossChargedSek: number;
  commissionSek: number;
  netPayoutSek: number;
}): EmailContent {
  const isSwedish = input.locale === 'sv';
  const learner = input.recipientRole === 'learner';
  const lessonDate = formatBookingTimestamp(input.lessonDate, input.locale);
  const bookingIdLabel = isSwedish ? 'Boknings-id' : 'Booking ID';
  const heading = isSwedish
    ? learner
      ? 'Ditt bokningskvitto från DriveLinkUp'
      : 'Ditt skolkvitto från DriveLinkUp'
    : learner
      ? 'Your DriveLinkUp booking receipt'
      : 'Your DriveLinkUp school receipt';
  const actionLines =
    input.completeUrl && input.disputeUrl
      ? isSwedish
        ? [
            `Markera lektionen som genomförd: ${input.completeUrl}`,
            `Öppna en tvist om något gick fel: ${input.disputeUrl}`,
          ]
        : [
            `Mark the lesson complete: ${input.completeUrl}`,
            `Open a dispute if something went wrong: ${input.disputeUrl}`,
          ]
      : [];
  const body = isSwedish
    ? learner
      ? [
          `Hej ${input.recipientName},`,
          `Din betalning för lektionen med ${input.instructorName} är bekräftad.`,
          `Lektion: ${input.category} · ${lessonDate}`,
          `Lektionspris: ${input.priceAmountSek} SEK`,
          ...(input.serviceFeeSek > 0 ? [`DriveLinkUp-avgift: ${input.serviceFeeSek} SEK`] : []),
          `Totalt betalt: ${input.grossChargedSek} SEK`,
          ...actionLines,
        ]
      : [
          `Hej ${input.recipientName},`,
          `Här är ditt kvitto för lektionen med ${input.instructorName}.`,
          `Lektion: ${input.category} · ${lessonDate}`,
          `Brutto betalt av eleven: ${input.grossChargedSek} SEK`,
          ...(input.serviceFeeSek > 0 ? [`DriveLinkUp-avgift: ${input.serviceFeeSek} SEK`] : []),
          `Skolans provision efter genomförande: ${input.commissionSek} SEK`,
          `Nettoutbetalning: ${input.netPayoutSek} SEK`,
          'Nettoutbetalning = skolans pris − hänförlig skolprovision efter genomförd tjänst.',
          ...actionLines,
        ]
    : learner
      ? [
          `Hi ${input.recipientName},`,
          `Your payment for the lesson with ${input.instructorName} is confirmed.`,
          `Lesson: ${input.category} · ${lessonDate}`,
          `Lesson price: ${input.priceAmountSek} SEK`,
          ...(input.serviceFeeSek > 0 ? [`DriveLinkUp fee: ${input.serviceFeeSek} SEK`] : []),
          `Total paid: ${input.grossChargedSek} SEK`,
          ...actionLines,
        ]
      : [
          `Hi ${input.recipientName},`,
          `Here is your receipt for the lesson with ${input.instructorName}.`,
          `Lesson: ${input.category} · ${lessonDate}`,
          `Gross paid by learner: ${input.grossChargedSek} SEK`,
          ...(input.serviceFeeSek > 0 ? [`DriveLinkUp fee: ${input.serviceFeeSek} SEK`] : []),
          `School commission after completion: ${input.commissionSek} SEK`,
          `Net payout: ${input.netPayoutSek} SEK`,
          'Net payout = school price − attributable school commission after completion.',
          ...actionLines,
        ];
  const { html, text } = renderEmail({
    heading,
    body,
    cta: {
      label: isSwedish ? 'Öppna kvitto' : 'Open receipt',
      url: input.receiptUrl,
    },
    footer: `${bookingIdLabel}: ${input.bookingId}`,
  });
  return { subject: heading, html, text };
}

function formatBookingTimestamp(lessonDate: string, locale: 'sv' | 'en'): string {
  const date = new Date(lessonDate);
  if (Number.isNaN(date.getTime())) return lessonDate;

  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(date);
}

/**
 * Notify the *non*-completing party that a `complete` step ran. Used twice
 * per completion (learner→instructor and instructor→learner) with the same
 * body shape — `recipientRole` flips which copy block is shown.
 */
export function lessonCompletedEmail(input: {
  recipientRole: 'learner' | 'instructor';
  completedByLabel: string;
  bookingId: string;
  locale?: BookingLocale;
}): EmailContent {
  const isSwedish = input.locale !== 'en';
  const roleLine =
    input.recipientRole === 'learner'
      ? `${input.completedByLabel} har markerat din lektion som genomförd.`
      : `Din elev (${input.completedByLabel}) har bekräftat att lektionen är genomförd.`;
  const headline =
    input.recipientRole === 'learner'
      ? 'Lektion rapporterad som genomförd'
      : 'Lektion markerad som genomförd av din elev';
  const { html, text } = renderEmail({
    heading: isSwedish
      ? headline
      : input.recipientRole === 'learner'
        ? 'Lesson marked complete'
        : 'Your learner marked the lesson complete',
    body: isSwedish
      ? [
          roleLine,
          'Medlen släpps nu från escrow och bokas mot skolans utbetalning.',
          'Tack för att du använder DriveLinkUp.',
        ]
      : [
          input.recipientRole === 'learner'
            ? `${input.completedByLabel} marked your lesson as complete.`
            : `Your learner (${input.completedByLabel}) confirmed that the lesson is complete.`,
          'The funds are now released from escrow to the school payout.',
          'Thanks for using DriveLinkUp.',
        ],
    footer: `Boknings-id: ${input.bookingId}`,
  });
  return {
    subject: isSwedish
      ? 'Lektion genomförd — escrow frigjord'
      : 'Lesson complete — escrow released',
    html,
    text,
  };
}

/**
 * 24-hour-before reminder for a confirmed lesson. Sent to BOTH the learner
 * and the instructor by the `lesson-reminders` cron (one Booking -> two
 * emails, idempotent via `Booking.reminderSentAt`). `recipientRole` flips
 * which side of the table the recipient sits on so each gets a body that
 * names the OTHER party they should expect to see.
 */
export function lessonReminderEmail(input: {
  recipientRole: 'student' | 'instructor';
  recipientName: string;
  otherPartyName: string;
  category: string;
  lessonDateTime: string;
  lessonCity: string;
  bookingId: string;
}): EmailContent {
  const { recipientRole, recipientName, otherPartyName, lessonDateTime, lessonCity } = input;
  const heading =
    recipientRole === 'student'
      ? `Reminder: your lesson with ${otherPartyName} is tomorrow`
      : `Reminder: lesson with ${otherPartyName} is tomorrow`;
  const { html, text } = renderEmail({
    heading,
    body: [
      `Hi ${recipientName},`,
      recipientRole === 'student'
        ? `Just a heads-up — your ${input.category} lesson with ${otherPartyName} is tomorrow at ${lessonDateTime} (${lessonCity} time).`
        : `Just a heads-up — your ${input.category} lesson with ${otherPartyName} is tomorrow at ${lessonDateTime} (${lessonCity} time).`,
      recipientRole === 'student'
        ? `Show up a few minutes early with your learner's permit ready. If something changed, contact the school directly using the details they shared when they confirmed the booking.`
        : `Arrive at your usual meeting point a few minutes early. If you need to reschedule, reach out to the learner as soon as possible so they can plan around it.`,
    ],
    footer: `Boknings-id: ${input.bookingId}`,
  });
  return { subject: heading, html, text };
}

/**
 * Notify the *non*-opener party that a dispute was opened. The dispute page
 * (linked from the held-receipt email) accepts the same action token from
 * either party, so the non-opener has the resolve form at hand already.
 */
export function disputeOpenedEmail(input: {
  recipientRole: 'learner' | 'instructor';
  openerLabel: string;
  reasonSnippet: string;
  bookingId: string;
}): EmailContent {
  const headline =
    input.recipientRole === 'learner'
      ? 'Din instruktör har öppnat en tvist'
      : 'Din elev har öppnat en tvist';
  const { html, text } = renderEmail({
    heading: headline,
    body: [
      `${input.openerLabel} har öppnat en tvist på den här bokningen.`,
      `Anledning: “${input.reasonSnippet}”`,
      'Utbetalningen är pausad tills tvisten är löst. Du får ett mejl när ärendet är avgjort.',
    ],
    footer: `Boknings-id: ${input.bookingId}`,
  });
  return { subject: 'Tvist öppnad på din bokning', html, text };
}

/**
 * Notify the *non*-resolver party that a dispute was resolved, with the
 * chosen outcome. Refund wording is explicit about operator handling
 * (per the stripe-payments skill: app code cannot issue Stripe refunds;
 * the platform team settles them out-of-band).
 */
export function disputeResolvedEmail(input: {
  recipientRole: 'learner' | 'instructor';
  resolvedByLabel: string;
  outcome: 'released' | 'refunded';
  note: string | null;
  bookingId: string;
}): EmailContent {
  const headline =
    input.outcome === 'released'
      ? 'Tvisten löst — medlen frigjorda'
      : 'Tvisten löst — återbetalning på väg';
  const outcomeLine =
    input.outcome === 'released'
      ? 'Medlen har släppts från escrow till din instruktörs utbetalning.'
      : 'Återbetalningen hanteras av vår support — pengarna syns normalt på ditt konto inom 1–2 bankdagar.';
  const body = [
    `${input.resolvedByLabel} har avgjort tvisten.`,
    outcomeLine,
    ...(input.note && input.note.length > 0 ? [`Kommentar: “${input.note}”`] : []),
  ];
  const { html, text } = renderEmail({
    heading: headline,
    body,
    footer: `Boknings-id: ${input.bookingId}`,
  });
  return {
    subject: input.outcome === 'released' ? 'Tvist löst — frigjord' : 'Tvist löst — återbetalning',
    html,
    text,
  };
}

// ─── Booking-request (Instant vs Request) templates ──────────────────

/**
 * Notification to the instructor for a fresh booking. `bookingMode` flips
 * which copy block the template uses; `reviewUrl` is the deep-link into
 * the instructor dashboard shown only for Request-mode rows (Instant
 * doesn't get a CTA — the row is already locked in by the time the
 * learner gets the confirmation mail).
 */
export function bookingRequestSubmittedEmail(input: {
  recipientName: string;
  bookingMode: 'instant' | 'request';
  category: string;
  bookingId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  preferredAtLocal: string;
  instructorCity: string;
  /** Optional Request-mode deep link carrying the action token. */
  reviewUrl?: string;
  locale?: BookingLocale;
}): EmailContent {
  const isRequest = input.bookingMode === 'request';
  const isSwedish = input.locale === 'sv';
  const body = isRequest
    ? [
        isSwedish ? `Hej ${input.recipientName},` : `Hi ${input.recipientName},`,
        isSwedish
          ? 'En ny bokningsförfrågan väntar på ditt svar i dashboarden.'
          : 'A new booking request is waiting for your review on the dashboard —',
        isSwedish
          ? 'Svara inom en arbetsdag genom att acceptera eller neka. Därefter får eleven hjälp med betalning och lektionen.'
          : "review it within one business day and approve or decline it. We'll then walk the learner through payment and the lesson.",
        '',
        `  ${isSwedish ? 'Namn' : 'Name'}:     ${input.studentName}`,
        `  ${isSwedish ? 'E-post' : 'Email'}:    ${input.studentEmail}`,
        `  ${isSwedish ? 'Telefon' : 'Phone'}:    ${input.studentPhone}`,
        `  ${isSwedish ? 'Kategori' : 'Category'}: ${input.category}`,
        `  ${isSwedish ? 'Önskad tid' : 'Preferred'}: ${input.preferredAtLocal} (${input.instructorCity})`,
        `  ${isSwedish ? 'Boknings-id' : 'Booking id'}: ${input.bookingId}`,
      ]
    : [
        isSwedish ? `Hej ${input.recipientName},` : `Hi ${input.recipientName},`,
        '',
        isSwedish
          ? 'En ny elev har bokat en lektion med dig:'
          : 'A new learner has booked a lesson with you:',
        '',
        `  ${isSwedish ? 'Namn' : 'Name'}:     ${input.studentName}`,
        `  ${isSwedish ? 'E-post' : 'Email'}:    ${input.studentEmail}`,
        `  ${isSwedish ? 'Telefon' : 'Phone'}:    ${input.studentPhone}`,
        `  ${isSwedish ? 'Kategori' : 'Category'}: ${input.category}`,
        `  ${isSwedish ? 'Önskad tid' : 'Preferred'}: ${input.preferredAtLocal} (${input.instructorCity})`,
        `  ${isSwedish ? 'Boknings-id' : 'Booking id'}: ${input.bookingId}`,
        '',
        isSwedish
          ? 'Hör av dig inom en arbetsdag för att bekräfta eller boka om.'
          : 'Reach out within one business day to confirm or reschedule.',
      ];
  const { html, text } = renderEmail({
    heading: isRequest
      ? isSwedish
        ? 'Ny bokningsförfrågan — granska och svara'
        : 'New booking request — review and decide'
      : `${isSwedish ? 'Ny bokningsförfrågan' : 'New booking request'} — ${input.category} ${isSwedish ? 'den' : 'on'} ${input.preferredAtLocal}`,
    body,
    cta: input.reviewUrl
      ? {
          label: isSwedish ? 'Granska och acceptera / neka' : 'Review and accept / decline',
          url: input.reviewUrl,
        }
      : undefined,
    footer: `Boknings-id: ${input.bookingId}`,
  });
  return {
    subject: isRequest
      ? isSwedish
        ? 'Ny bokningsförfrågan — granska och svara'
        : 'New booking request — review and decide'
      : `${isSwedish ? 'Ny bokningsförfrågan' : 'New booking request'} — ${input.category} ${isSwedish ? 'den' : 'on'} ${input.preferredAtLocal}`,
    html,
    text,
  };
}

/**
 * Learner-side notification when the instructor approves a Request
 * booking. Carries the deep link to the new `confirm-payment` page
 * where the existing "Pay for the lesson" pattern runs.
 */
export function bookingRequestApprovedEmail(input: {
  recipientName: string;
  instructorName: string;
  category: string;
  preferredAtLocal: string;
  bookingId: string;
  confirmPaymentUrl: string;
  locale?: BookingLocale;
}): EmailContent {
  const isSwedish = input.locale === 'sv';
  const { html, text } = renderEmail({
    heading: isSwedish
      ? `${input.instructorName} har accepterat din bokning — bekräfta och betala`
      : `${input.instructorName} approved your booking — confirm and pay`,
    body: isSwedish
      ? [
          `Hej ${input.recipientName},`,
          `${input.instructorName} har accepterat din ${input.category}-bokning den ${input.preferredAtLocal}.`,
          'Bekräfta tiden och betala nedan. Pengarna hålls i escrow tills lektionen är genomförd.',
        ]
      : [
          `Hi ${input.recipientName},`,
          `${input.instructorName} has accepted your ${input.category} booking on ${input.preferredAtLocal}.`,
          'Confirm the time and pay below — the funds are held in escrow until the lesson is complete.',
        ],
    cta: {
      label: isSwedish ? 'Bekräfta och betala' : 'Confirm and pay',
      url: input.confirmPaymentUrl,
    },
    footer: `Boknings-id: ${input.bookingId}`,
  });
  return {
    subject: isSwedish
      ? `${input.instructorName} accepterade din bokning`
      : `${input.instructorName} accepted your booking`,
    html,
    text,
  };
}

/**
 * Instructor-side confirmatory copy the instructor-side gets on the
 * approve path. Sent only after accept commits so the instructor gets a
 * short "they're in checkout now" message and doesn't have to dig out the
 * dashboard row to know what happened.
 */
export function bookingRequestApprovedInstructorCopyEmail(input: {
  recipientName: string;
  category: string;
  buyerName: string;
  preferredAtLocal: string;
  bookingId: string;
  /** Required so we can build the dashboard deep-link to the row. */
  origin: string;
  locale?: BookingLocale;
}): EmailContent {
  const isSwedish = input.locale === 'sv';
  const dashboardUrl = `${input.origin}/dashboard/instructor`;
  const { html, text } = renderEmail({
    heading: isSwedish
      ? `Du accepterade ${input.buyerName}s ${input.category}-lektion den ${input.preferredAtLocal}`
      : `You approved ${input.buyerName}'s ${input.category} lesson on ${input.preferredAtLocal}`,
    body: [
      isSwedish
        ? `Tack — ${input.buyerName} har skickats till betalningen. Bokningen visas som "väntar" tills betalningen bekräftats och lektionen är då bokad.`
        : `Thanks — ${input.buyerName} has been routed to checkout. You'll see the booking as "pending" until Stripe confirms payment; after that, the row flips to held in escrow and the lesson is locked in.`,
    ],
    cta: {
      label: isSwedish ? 'Öppna instruktörens dashboard' : 'Open the instructor dashboard',
      url: dashboardUrl,
    },
    footer: `Boknings-id: ${input.bookingId}`,
  });
  return {
    subject: isSwedish
      ? `Bokning accepterad — ${input.category} den ${input.preferredAtLocal}`
      : `Booking approved — ${input.category} on ${input.preferredAtLocal}`,
    html,
    text,
  };
}

/**
 * Learner-side notification when the instructor declines a Request. Sent
 * when the row flips to `paymentStatus='declined'` — neutral tone, no fee,
 * "find another time" copy. The learner can also see this on their
 * dashboard / booking list.
 */
export function bookingRequestDeclinedEmail(input: {
  recipientName: string;
  instructorName: string;
  category: string;
  preferredAtLocal: string;
  bookingId: string;
  reason?: string;
  locale?: BookingLocale;
}): EmailContent {
  const isSwedish = input.locale === 'sv';
  const body = [
    isSwedish ? `Hej ${input.recipientName},` : `Hi ${input.recipientName},`,
    isSwedish
      ? `${input.instructorName} kunde inte acceptera din ${input.category}-förfrågan den ${input.preferredAtLocal}.`
      : `${input.instructorName} declined your ${input.category} request for ${input.preferredAtLocal}.`,
    ...(input.reason && input.reason.length > 0
      ? [isSwedish ? `Anledning: “${input.reason}”` : `Reason: “${input.reason}”`]
      : []),
    isSwedish
      ? 'Ingen betalning drogs. Öppna en annan instruktörs profil för att hitta en ny tid.'
      : "No payment was captured. Open another instructor's profile to find a new slot.",
  ];
  const { html, text } = renderEmail({
    heading: isSwedish
      ? `${input.instructorName} kunde inte acceptera din bokning`
      : `${input.instructorName} couldn't accept your booking`,
    body,
    footer: `Boknings-id: ${input.bookingId}`,
  });
  return {
    subject: isSwedish
      ? `${input.instructorName} nekade din bokning`
      : `${input.instructorName} declined your booking`,
    html,
    text,
  };
}

// ─── Cancellation templates ────────────────────────────────────────────

/**
 * Receipt the learner receives after a cancellation carrying a fee
 * (PARTIAL or LATE). `feePercent` (0–100) is the percent applied — used
 * to phrase a partial-fee cancel as "{X}% fee per your instructor's
 * policy" so the learner understands the refund window explains why
 * they were charged less than the full lesson cost. The fee (≤ the
 * lesson USD charge) is RETAINED on the platform — the instructor still
 * keeps the full lesson rate per the marketplace model. Per the
 * stripe-payments skill, app code never issues Stripe refunds or
 * re-routes: this email is an audit receipt, and the platform-team
 * reconciliation cycle captures the residual as part of the existing
 * payment-handling pipeline.
 */
export function cancellationFeeReceiptEmail(input: {
  recipientName: string;
  instructorName: string;
  feeUsd: number;
  lessonChargeUsd: number;
  bookingId: string;
  feePercent?: number;
  locale?: BookingLocale;
}): EmailContent {
  const { recipientName, instructorName, feeUsd, lessonChargeUsd, bookingId, feePercent } = input;
  const isSwedish = input.locale !== 'en';
  const heading = isSwedish
    ? `Avbokning registrerad — avgift ${feeUsd} USD`
    : `Cancellation recorded — fee ${feeUsd} USD`;
  const isPartial = typeof feePercent === 'number' && feePercent > 0 && feePercent < 100;
  const policyLine = isPartial
    ? isSwedish
      ? `${feePercent}% avgift tillkommer enligt din instruktörs avbokningspolicy.`
      : `${feePercent}% fee applies under your instructor's cancellation policy.`
    : isSwedish
      ? 'Hela lektionsavgiften behålls av plattformen enligt policyn för sen avbokning.'
      : 'The full lesson fee is retained under the late-cancellation policy.';
  const baseBody = isSwedish
    ? [
        `Hej ${recipientName},`,
        `Din avbokning av lektionen med ${instructorName} har registrerats. En avgift på ${feeUsd} USD (av lektionens ${lessonChargeUsd} USD) behålls av plattformen.`,
        policyLine,
        'Din instruktör behåller sin fulla lektionsavgift enligt marknadsplatsens modell — du behöver inte kontakta instruktören om betalningen.',
        'Frågor kan skickas till korprivat@polsia.app.',
      ]
    : [
        `Hi ${recipientName},`,
        `Your cancellation of the lesson with ${instructorName} was recorded. A fee of ${feeUsd} USD (from the ${lessonChargeUsd} USD lesson charge) is retained by the platform.`,
        policyLine,
        'Your instructor keeps the full lesson rate under the marketplace model — you do not need to contact them about payment.',
        'Questions can be sent to korprivat@polsia.app.',
      ];
  const { html, text } = renderEmail({
    heading,
    body: baseBody,
    footer: `Boknings-id: ${bookingId}`,
  });
  return {
    subject: isSwedish ? `Avbokningsavgift ${feeUsd} USD` : `Cancellation fee ${feeUsd} USD`,
    html,
    text,
  };
}

/**
 * Neutral notification for an EARLY cancellation (no fee) — sent to the
 * learner as the receipt and to the instructor as a heads-up that the
 * slot will open up. Both recipients see the same body shape; the
 * `recipientRole` flips which third party is referenced in the body.
 */
export function cancellationNeutralEmail(input: {
  recipientRole: 'learner' | 'instructor';
  recipientName: string;
  otherPartyName: string;
  bookingId: string;
  locale?: BookingLocale;
}): EmailContent {
  const { recipientRole, recipientName, otherPartyName, bookingId } = input;
  const isSwedish = input.locale !== 'en';
  const heading = isSwedish
    ? recipientRole === 'learner'
      ? 'Avbokning bekräftad — ingen avgift'
      : 'Lektion avbokad — tiden blir ledig'
    : recipientRole === 'learner'
      ? 'Cancellation confirmed — no fee'
      : 'Lesson cancelled — time is available again';
  const body = isSwedish
    ? recipientRole === 'learner'
      ? [
          `Hej ${recipientName},`,
          `Din bokning med ${otherPartyName} har avbokats. Eftersom avbokningen kom mer än 24 timmar före lektionsstart tillkommer ingen avgift.`,
          `Vi hoppas att du hittar en ny tid som passar — kika gärna i instruktörens kalender för nya öppningar.`,
        ]
      : [
          `Hej ${recipientName},`,
          `Din elev har avbokat lektionen med dig. Tiden är nu ledig i din kalender igen.`,
          `Eftersom avbokningen kom mer än 24 timmar före lektionsstart tillkommer ingen avgift — din utbetalning berörs inte.`,
        ]
    : recipientRole === 'learner'
      ? [
          `Hi ${recipientName},`,
          `Your booking with ${otherPartyName} was cancelled. Because it was cancelled more than 24 hours before the lesson, no fee applies.`,
          'We hope you find another time that works.',
        ]
      : [
          `Hi ${recipientName},`,
          `Your learner cancelled the lesson with you. The time is available in your calendar again.`,
          'No fee applies because the cancellation was made more than 24 hours before the lesson.',
        ];
  const { html, text } = renderEmail({
    heading,
    body,
    footer: `Boknings-id: ${bookingId}`,
  });
  return {
    subject: isSwedish
      ? recipientRole === 'learner'
        ? 'Avbokning bekräftad'
        : 'Lektion avbokad'
      : recipientRole === 'learner'
        ? 'Cancellation confirmed'
        : 'Lesson cancelled',
    html,
    text,
  };
}

// ─── Instructor onboarding ────────────────────────────────────────────

/**
 * Confirmation sent right after a school self-onboards and its
 * `/instructors/[id]` listing is live. Subject + heading mirror the
 * `lessonCompletedEmail` style — short, factual, action-led. Avatar appears
 * inline under the greeting when `imageUrl` is provided (same
 * `injectAvatar` / `appendImageUrl` helpers the welcome email uses, so a
 * recipient with an avatar in the welcome row now sees a matching one in
 * the profile-live row).
 */
export function instructorProfileLiveEmail(input: {
  name: string;
  profileUrl: string;
  imageUrl?: string;
  locale?: BookingLocale;
}): EmailContent {
  const { name, profileUrl, imageUrl } = input;
  const avatar = imageUrl?.trim();
  const isSwedish = input.locale !== 'en';
  const heading = isSwedish
    ? `Din skolprofil är live — välkommen, ${name}`
    : `Your driving-school listing is live — welcome aboard, ${name}`;
  const baseBody = isSwedish
    ? [
        'Tack för att du listar din trafikskola på DriveLinkUp. Skolprofilen är live och synlig för elever som jämför auktoriserade trafikskolor i din stad.',
        'Nästa steg: DriveLinkUp-teamet återkommer separat om verifieringen av ditt lärartillstånd från Transportstyrelsen.',
        'Du kan när som helst uppdatera skolans priser, tillgänglighet och presentation från skolöversikten.',
      ]
    : [
        'Thanks for listing your driving school on DriveLinkUp. Your school listing is live and visible to learners comparing authorized schools in your city.',
        'Next: the DriveLinkUp team will follow up separately about verification of your Transportstyrelsen teaching licence.',
        'You can update your school prices, availability, and profile anytime from your school dashboard.',
      ];
  const { html: baseHtml, text: baseText } = renderEmail({
    heading,
    body: baseBody,
    cta: {
      label: isSwedish ? 'Visa skolprofilen' : 'View your school listing',
      url: profileUrl,
    },
    footer: isSwedish ? 'DriveLinkUp · lanseras i Sverige' : 'DriveLinkUp · launching in Sweden',
  });
  return {
    subject: isSwedish ? 'Din skolprofil är live' : 'Your school listing is live',
    html: avatar ? injectAvatar(baseHtml, avatar) : baseHtml,
    text: avatar ? appendImageUrl(baseText, avatar) : baseText,
  };
}

// ─── Contact form (founder inbox) ─────────────────────────────────────

/**
 * Notification to the founder when a visitor sends an inquiry through the
 * guided `/contact` flow. The recipient is `process.env.POLSIA_COMPANY_EMAIL`
 * resolved at request time in the route handler — never hardcoded as a domain
 * address (which would bounce). The visitor themselves do NOT get an
 * auto-responder (the founder reads & replies personally).
 */
export function contactInquiryReceivedEmail(input: {
  topic: string;
  topicLabel: string;
  name: string;
  email: string;
  message: string;
  locale: string;
  receivedAt: Date;
}): EmailContent {
  const stamp = input.receivedAt.toISOString();
  const lines = [
    `Topic: ${input.topicLabel} (${input.topic})`,
    `From: ${input.name} <${input.email}>`,
    '',
    input.message,
    '',
    `Locale: ${input.locale}`,
    `Received: ${stamp}`,
  ];
  const { html, text } = renderEmail({
    heading: `New contact inquiry — ${input.topicLabel}`,
    body: lines,
    footer: `Inquiries are answered personally by the founder. Locale tag: ${input.locale}.`,
  });
  return { subject: `[Contact] ${input.topic} (${input.locale})`, html, text };
}

// ─── Handledare → Trafiklärare upgrade ─────────────────────────────────

/**
 * Fired exactly once per HANDLEDARE→INSTRUCTOR transition, by the admin
 * decision endpoint when it processes a VERIFIED decision on a row whose
 * user is still a HANDLEDARE. Re-verifications of an already-INSTRUCTOR
 * row (e.g. a re-upload that the same admin re-approves) do NOT re-send
 * this — the recipient already converted and "welcome" copy would be
 * misleading on a re-approval.
 *
 * `dashboardUrl` lands the recipient on the instructor dashboard where
 * onboarding (categories, hourly rate, weekly openings) continues.
 */
export function instructorUpgradeApprovedEmail(input: {
  name: string;
  dashboardUrl: string;
}): EmailContent {
  const { name, dashboardUrl } = input;
  const heading = `Your certified-instructor upgrade is approved — welcome, ${name}`;
  const baseBody = [
    `Your Transportstyrelsen teaching licence is verified. Your DriveLinkUp account now operates as a certified trafiklärare — the handledare dashboard is closed to you and the instructor dashboard is open.`,
    `Your prior handledare activity and clickwrap acceptance stay in your record but no longer surface as an active view — only instructor content shows from here on.`,
    `Next: set your categories, hourly rate, and weekly openings — once that's done, learners can book you directly with no trafikskola middleman.`,
  ];
  const { html, text } = renderEmail({
    heading,
    body: baseBody,
    cta: { label: 'Open your instructor dashboard', url: dashboardUrl },
    footer: 'DriveLinkUp · launching in Sweden',
  });
  return {
    subject: 'Your certified-instructor upgrade is approved',
    html,
    text,
  };
}

// (Learner recurring-subscription templates removed — DriveLinkUp does not
// charge a subscription. The per-booking fee model that replaced them sends
// the `paymentHeldReceiptEmail` template at held_escrow and the same string
// functions the lesson-complete side effects use.)
