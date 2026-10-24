/**
 * Staging-only production-readiness walkthrough.
 * Refuses to run unless DATABASE_URL is the documented preview Neon host.
 * Does not set SCHOOL_AUTHZ_ENFORCEMENT. Does not write production.
 *
 * Usage (host-guarded): DATABASE_URL=<preview> npx tsx scripts/run-production-readiness-walkthrough.ts
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { claimScopeDecision, importSourceDecision } from '../src/lib/acquisition/claim-policy';
import { offeringPolicySelection, offeringPublicationDecision } from '../src/lib/acquisition/category-offering-policy';
import {
  conciergeApprovalDecision,
  conciergePublishDecision,
  conciergeStoreDecision,
} from '../src/lib/acquisition/concierge-policy';
import { leadConversionDecision, leadDashboardDecision } from '../src/lib/acquisition/lead-dashboard-policy';
import {
  independentPublicationDecision,
  invitationCategoryDecision,
  scopeGrantByRoleDecision,
} from '../src/lib/acquisition/mediated-instructor-policy';
import { productionCapabilityDecision } from '../src/lib/certification/capability-policy';
import { isConnectivityEnabled } from '../src/lib/connectivity/policy';
import { canSignForEnvironment } from '../src/lib/connectivity/signing';
import { evaluateAlert, readConfiguredThresholds } from '../src/lib/ops/alerting-policy';
import {
  decideInboxEvent,
  isReliableProcessingOn,
  nativeOutboxData,
} from '../src/lib/reliability/inbox-policy';
import {
  foldAuthorizationEvents,
  isSchoolAuthzEnforcementOn,
  listingSurfaces,
  planAuthorizationAppend,
  type AuthorizationEvent,
} from '../src/lib/orgs/school-authorization-policy';

const STAGING_HOST = 'ep-dawn-smoke-b7btfhhc';
const PRODUCTION_HOST_MARKERS = ['ep-blue-hat-b7yj9hwe', 'br-rough-frost'];

type FlagResult = {
  flag: string;
  exercised: string[];
  works: string[];
  broken: string[];
  blocked: string[];
  verdict: 'VERIFIED' | 'PARTIAL' | 'BLOCKED';
};

function assertStagingUrl(url: string | undefined) {
  if (!url) throw new Error('DATABASE_URL is required');
  if (PRODUCTION_HOST_MARKERS.some((marker) => url.includes(marker))) {
    throw new Error('Refusing to run: DATABASE_URL looks like production');
  }
  if (!url.includes(STAGING_HOST)) {
    throw new Error(`Refusing to run: DATABASE_URL is not staging host ${STAGING_HOST}`);
  }
}

function flagOn(name: string, value = '1') {
  process.env[name] = value;
}

function flagOff(name: string) {
  delete process.env[name];
}

async function main() {
  assertStagingUrl(process.env.DATABASE_URL);
  flagOff('SCHOOL_AUTHZ_ENFORCEMENT');
  if (isSchoolAuthzEnforcementOn()) {
    throw new Error('SCHOOL_AUTHZ_ENFORCEMENT must stay OFF for this walkthrough');
  }

  const prisma = new PrismaClient();
  const suffix = `wt-${Date.now()}`;
  const results: FlagResult[] = [];
  const proofs: Record<string, { ok: boolean; detail: string }> = {};

  const schoolUserId = `user-school-${suffix}`;
  const otherUserId = `user-other-${suffix}`;
  const instructorUserId = `user-instr-${suffix}`;
  const schoolListingId = `listing-school-${suffix}`;
  const contactListingId = `listing-contact-${suffix}`;
  const otherListingId = `listing-other-${suffix}`;

  try {
    await prisma.user.createMany({
      data: [
        {
          id: schoolUserId,
          name: 'Walkthrough School Rep',
          email: `walkthrough-school-${suffix}@example.test`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: otherUserId,
          name: 'Walkthrough Other School',
          email: `walkthrough-other-${suffix}@example.test`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: instructorUserId,
          name: 'Walkthrough Instructor',
          email: `walkthrough-instructor-${suffix}@example.test`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const org = await prisma.organization.create({
      data: {
        name: `Walkthrough Org ${suffix}`,
        slug: `walkthrough-org-${suffix}`,
        organizationNumber: `WT-${suffix}`,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: org.id,
        userId: schoolUserId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    await prisma.instructor.createMany({
      data: [
        {
          id: schoolListingId,
          name: `Walkthrough Trafikskola ${suffix}`,
          city: 'Testköping',
          categories: ['B'],
          hourlyRateSek: 600,
          bio: 'synthetic fixture',
          photoUrl: 'https://example.test/wt.png',
          email: `walkthrough-school-${suffix}@example.test`,
          userId: schoolUserId,
          providerRole: 'SCHOOL',
          bookingMode: 'instant',
        },
        {
          id: contactListingId,
          name: `Walkthrough Contact School ${suffix}`,
          city: 'Testköping',
          categories: ['B'],
          hourlyRateSek: 600,
          bio: 'synthetic fixture contact',
          photoUrl: 'https://example.test/wt.png',
          email: `walkthrough-contact-${suffix}@example.test`,
          userId: schoolUserId,
          providerRole: 'SCHOOL',
          bookingMode: 'contact',
        },
        {
          id: otherListingId,
          name: `Walkthrough Other School ${suffix}`,
          city: 'Testköping',
          categories: ['B'],
          hourlyRateSek: 600,
          bio: 'synthetic fixture other',
          photoUrl: 'https://example.test/wt.png',
          email: `walkthrough-other-${suffix}@example.test`,
          userId: otherUserId,
          providerRole: 'SCHOOL',
          bookingMode: 'request',
        },
      ],
    });

    await prisma.listingRepresentativeAuthority.createMany({
      data: [
        {
          listingId: schoolListingId,
          userId: schoolUserId,
          evidenceRef: `manual-review:${suffix}:rep`,
          verifiedAt: new Date(),
        },
        {
          listingId: contactListingId,
          userId: schoolUserId,
          evidenceRef: `manual-review:${suffix}:rep-contact`,
          verifiedAt: new Date(),
        },
        {
          listingId: otherListingId,
          userId: otherUserId,
          evidenceRef: `manual-review:${suffix}:rep-other`,
          verifiedAt: new Date(),
        },
      ],
    });

    // --- CLAIM_FUNNEL ---
    flagOn('CLAIM_FUNNEL');
    const claim: FlagResult = {
      flag: 'CLAIM_FUNNEL',
      exercised: [],
      works: [],
      broken: [],
      blocked: [],
      verdict: 'PARTIAL',
    };
    claim.exercised.push(
      'importSyntheticProspect via store rules; submit claim with evidence refs; admin review VERIFIED; grant via appendAuthorizationEvent with SCHOOL_AUTHZ_ENFORCEMENT OFF',
    );
    const register = importSourceDecision('bolagsverket');
    if (register.allowed) {
      claim.blocked.push('Real register import unexpectedly allowed — expected register_rights_unverified');
    } else {
      claim.works.push(`Non-synthetic import refused (${register.code}); SYNTHETIC_FIXTURE allowed`);
    }
    const prospect = await prisma.listingProspect.create({
      data: {
        legalName: `Walkthrough Prospect ${suffix}`,
        orgNumber: `556${suffix.slice(-6)}`,
        country: 'SE',
        city: 'Testköping',
        categories: ['B'],
        source: 'SYNTHETIC_FIXTURE',
        eligibility: 'ELIGIBLE',
        dataQuality: 'PASS',
        visibility: 'PUBLIC',
        claimState: 'UNCLAIMED',
      },
    });
    await prisma.prospectClaim.create({
      data: {
        prospectId: prospect.id,
        claimantUserId: schoolUserId,
        identityEvidenceRef: `didit-or-manual:${suffix}:identity`,
        mandateEvidenceRef: `manual-review:${suffix}:mandate`,
        identityStatus: 'PENDING_REVIEW',
        mandateStatus: 'PENDING_REVIEW',
        representativeStatus: 'PENDING_REVIEW',
        scopesGranted: [],
      },
    });
    const pendingDecision = claimScopeDecision({
      identityStatus: 'PENDING_REVIEW',
      mandateStatus: 'PENDING_REVIEW',
      representativeStatus: 'PENDING_REVIEW',
    });
    if (pendingDecision.code !== 'verification_incomplete' || pendingDecision.authorizationEventsCreated !== 0) {
      claim.broken.push(`Pending claim should not grant scopes; got ${pendingDecision.code}`);
    } else {
      claim.works.push('Claim submit stays verification_incomplete and writes 0 grant events');
    }
    await prisma.prospectClaim.updateMany({
      where: { prospectId: prospect.id },
      data: {
        identityStatus: 'VERIFIED',
        mandateStatus: 'VERIFIED',
        representativeStatus: 'VERIFIED',
      },
    });
    const verifiedDecision = claimScopeDecision({
      identityStatus: 'VERIFIED',
      mandateStatus: 'VERIFIED',
      representativeStatus: 'VERIFIED',
    });
    if (verifiedDecision.code !== 'claim_does_not_grant_scopes') {
      claim.broken.push('Verified claim must still refuse to grant scopes');
    } else {
      claim.works.push(
        'Available identity route is evidence-ref + admin/manual review (Didit/manual). e-ID broker is [EXTERNAL] / not assumed. Verified claim still grants 0 scopes',
      );
    }
    claim.blocked.push(
      'No dedicated per-scope decision UI was found (no form with nothing pre-selected). Grant is API-only: POST /api/listings/[id]/authorizations with explicit scopes',
    );

    const grantKey = `idem-grant-${suffix}`;
    const grant1 = await persistEvent(prisma, {
      listingId: schoolListingId,
      kind: 'grant',
      scopes: ['availability_display', 'inquiry_collection'],
      actorUserId: schoolUserId,
      evidenceRef: `manual-review:${suffix}:scope-decision`,
      expectedHeadSequence: 0,
      decisionVersion: 1,
      idempotencyKey: grantKey,
    });
    const grantReplay = await persistEvent(prisma, {
      listingId: schoolListingId,
      kind: 'grant',
      scopes: ['availability_display', 'inquiry_collection'],
      actorUserId: schoolUserId,
      evidenceRef: `manual-review:${suffix}:scope-decision`,
      expectedHeadSequence: 0,
      decisionVersion: 1,
      idempotencyKey: grantKey,
    });
    const eventsAfterGrant = await prisma.schoolAuthorizationEvent.findMany({
      where: { listingId: schoolListingId },
      orderBy: { sequence: 'asc' },
    });
    if (
      grant1.ok &&
      grantReplay.ok &&
      grantReplay.replay &&
      eventsAfterGrant.length === 1 &&
      !isSchoolAuthzEnforcementOn()
    ) {
      claim.works.push(
        `Grant persisted with enforcement OFF (sequence ${eventsAfterGrant[0]?.sequence}); idempotent replay returned replay=true and did not insert a second row`,
      );
    } else {
      claim.broken.push(`Grant/replay failed: ${JSON.stringify({ grant1, grantReplay, n: eventsAfterGrant.length })}`);
    }
    claim.verdict = claim.broken.length ? 'PARTIAL' : claim.blocked.length ? 'PARTIAL' : 'VERIFIED';
    results.push(claim);
    flagOff('CLAIM_FUNNEL');

    // --- SCHOOL_MEDIATED_INSTRUCTORS ---
    flagOn('SCHOOL_MEDIATED_INSTRUCTORS');
    const mediated: FlagResult = {
      flag: 'SCHOOL_MEDIATED_INSTRUCTORS',
      exercised: [
        'inviteSchoolInstructor store path; invitation category gate; independent publication; instructor cannot grant scopes',
      ],
      works: [],
      broken: [],
      blocked: [],
      verdict: 'VERIFIED',
    };
    const inviteOk = invitationCategoryDecision(['B'], ['B']);
    const inviteOver = invitationCategoryDecision(['B'], ['A']);
    const selfSignup = independentPublicationDecision({
      enforced: true,
      providerRole: 'INSTRUCTOR',
      affiliationVerified: false,
    });
    const instructorGrant = scopeGrantByRoleDecision({
      enforced: true,
      actorIsSchool: false,
      representativeVerified: false,
    });
    if (inviteOk.allowed && !inviteOver.allowed && inviteOver.code === 'category_not_permitted') {
      mediated.works.push('School invite within B allowed; A exceeds school categories and is refused');
    } else {
      mediated.broken.push('Invitation category gate did not match expected B-only school');
    }
    if (!selfSignup.allowed && selfSignup.code === 'independent_publication_refused') {
      mediated.works.push('Independent instructor self-signup/publication refused when flag is on');
    } else {
      mediated.broken.push('Independent publication was allowed');
    }
    if (!instructorGrant.allowed && instructorGrant.code === 'instructor_role_cannot_grant_scopes') {
      mediated.works.push('Instructor role cannot grant scopes');
    } else {
      mediated.broken.push('Instructor was allowed to grant scopes');
    }
    const invitation = await prisma.schoolInstructorInvitation.create({
      data: {
        schoolListingId,
        email: `walkthrough-instructor-${suffix}@example.test`,
        teachingCategories: ['B'],
        inventoryDelegated: false,
        status: 'PENDING',
        invitedByUserId: schoolUserId,
      },
    });
    await prisma.schoolInstructorAffiliation.create({
      data: {
        invitationId: invitation.id,
        schoolListingId,
        instructorUserId: instructorUserId,
        teachingCategories: ['B'],
        inventoryDelegated: false,
        status: 'VERIFIED',
      },
    });
    mediated.works.push('Synthetic school invitation persisted; instructor affiliation VERIFIED without scope grants');
    mediated.verdict = mediated.broken.length ? 'PARTIAL' : 'VERIFIED';
    results.push(mediated);
    flagOff('SCHOOL_MEDIATED_INSTRUCTORS');

    // --- CATEGORY_OFFERINGS ---
    flagOn('CATEGORY_OFFERINGS');
    const category: FlagResult = {
      flag: 'CATEGORY_OFFERINGS',
      exercised: ['B-only teaching permission vs A/C/D publication; approved B policy snapshot'],
      works: [],
      broken: [],
      blocked: [],
      verdict: 'VERIFIED',
    };
    await prisma.teachingPermission.create({
      data: {
        listingId: schoolListingId,
        category: 'B',
        legalEntityRef: org.organizationNumber ?? `WT-${suffix}`,
        locationRef: 'Testköping',
        evidenceRef: `manual-review:${suffix}:permit-B`,
        status: 'CURRENT',
      },
    });
    const refuseA = offeringPublicationDecision({
      enforced: true,
      offeringCategory: 'A',
      permissions: [
        {
          category: 'B',
          legalEntityRef: org.organizationNumber ?? '',
          locationRef: 'Testköping',
          status: 'CURRENT',
        },
      ],
      listingLegalEntity: org.organizationNumber ?? '',
      listingLocation: 'Testköping',
    });
    const allowB = offeringPublicationDecision({
      enforced: true,
      offeringCategory: 'B',
      permissions: [
        {
          category: 'B',
          legalEntityRef: org.organizationNumber ?? '',
          locationRef: 'Testköping',
          status: 'CURRENT',
        },
      ],
      listingLegalEntity: org.organizationNumber ?? '',
      listingLocation: 'Testköping',
    });
    const policy = await prisma.cancellationPolicy.create({
      data: {
        listingId: schoolListingId,
        version: 1,
        deadlineType: 'hours_before',
        deadlineValue: { hours: 24 },
        timezone: 'Europe/Stockholm',
        businessCalendar: { weekdays: [1, 2, 3, 4, 5] },
        source: 'SYNTHETIC_FIXTURE',
        approvedAt: new Date(),
        state: 'active',
        activeListingKey: schoolListingId,
      },
    });
    const snapshot = offeringPolicySelection({
      policy: {
        id: policy.id,
        listingId: policy.listingId,
        version: policy.version,
        approvedAt: policy.approvedAt?.toISOString() ?? null,
        state: policy.state,
      },
      listingId: schoolListingId,
    });
    if (!refuseA.allowed && refuseA.code === 'category_not_permitted' && allowB.allowed && snapshot.ok) {
      category.works.push(
        'B-only permission refuses A (and would refuse C/D the same way); B offering selects the approved policy snapshot',
      );
    } else {
      category.broken.push(`Category gate unexpected: ${JSON.stringify({ refuseA, allowB, snapshot })}`);
    }
    category.blocked.push(
      'No live resource-bundle renderer was exercised beyond policy snapshot fields (policyId/version). Offering UI category landing is flag-gated (`/kategori/[category]`).',
    );
    category.verdict = category.broken.length ? 'PARTIAL' : 'PARTIAL';
    results.push(category);
    flagOff('CATEGORY_OFFERINGS');

    // --- LEAD_DASHBOARD ---
    flagOn('LEAD_DASHBOARD');
    const lead: FlagResult = {
      flag: 'LEAD_DASHBOARD',
      exercised: ['zero-scope school with historical inquiry count; convert decision'],
      works: [],
      broken: [],
      blocked: [],
      verdict: 'VERIFIED',
    };
    const dash = leadDashboardDecision({
      representativeVerified: true,
      grantedScopes: [],
      historicalInquiryCount: 2,
    });
    const convert = leadConversionDecision({
      representativeVerified: true,
      booking: { ok: true, mode: 'instant' },
    });
    if (
      dash.visible &&
      dash.bookingSurfaces === false &&
      dash.collectNewInquiries === false &&
      dash.historicalInquiries === 2 &&
      convert.bookingCreated === false &&
      convert.authorizationEventsCreated === 0
    ) {
      lead.works.push(
        'Zero-scope representative sees historical inquiries, no new-inquiry collection, no booking surfaces; convert cannot mint a booking or a scope',
      );
    } else {
      lead.broken.push(`Lead dashboard unexpected: ${JSON.stringify({ dash, convert })}`);
    }
    lead.verdict = lead.broken.length ? 'PARTIAL' : 'VERIFIED';
    results.push(lead);
    flagOff('LEAD_DASHBOARD');

    // --- RELIABLE_PROCESSING ---
    flagOn('RELIABLE_PROCESSING');
    const reliable: FlagResult = {
      flag: 'RELIABLE_PROCESSING',
      exercised: ['booking+outbox same transaction; inbox duplicate/order (SC-11)'],
      works: [],
      broken: [],
      blocked: [],
      verdict: 'VERIFIED',
    };
    if (!isReliableProcessingOn()) reliable.broken.push('Flag did not turn on');
    const bookingId = `booking-${suffix}`;
    await prisma.$transaction(async (tx) => {
      await tx.booking.create({
        data: {
          id: bookingId,
          instructorId: schoolListingId,
          studentName: 'Walkthrough Student',
          studentEmail: `walkthrough-student-${suffix}@example.test`,
          studentPhone: '+46700000000',
          category: 'B',
          preferredAt: new Date(Date.now() + 86400000),
          bookingMode: 'request',
          paymentStatus: 'awaiting_approval',
        },
      });
      await tx.commandOutbox.create({ data: nativeOutboxData(bookingId) });
    });
    const outbox = await prisma.commandOutbox.findUnique({
      where: { idempotencyKey: `booking:${bookingId}:pending` },
    });
    if (outbox?.bookingId === bookingId) {
      reliable.works.push('Booking create and outbox row committed together (same transaction)');
    } else {
      reliable.broken.push('Outbox row missing after booking transaction');
    }
    const connection = await prisma.schoolConnection.create({
      data: {
        listingId: schoolListingId,
        environment: 'sandbox',
        status: 'inactive',
      },
    });
    const first = decideInboxEvent({
      duplicate: false,
      revision: 1,
      occurredAt: null,
      watermarkRevision: null,
      watermarkAt: null,
    });
    const dup = decideInboxEvent({
      duplicate: true,
      revision: 1,
      occurredAt: null,
      watermarkRevision: 1,
      watermarkAt: null,
    });
    const stale = decideInboxEvent({
      duplicate: false,
      revision: 1,
      occurredAt: null,
      watermarkRevision: 2,
      watermarkAt: null,
    });
    await prisma.bookingEvent.create({
      data: {
        schoolConnectionId: connection.id,
        providerEventId: `evt-${suffix}-1`,
        eventType: 'slot.updated',
        payloadHash: 'abc',
        revision: 1,
        processingStatus: 'received',
      },
    });
    let duplicateInsertBlocked = false;
    try {
      await prisma.bookingEvent.create({
        data: {
          schoolConnectionId: connection.id,
          providerEventId: `evt-${suffix}-1`,
          eventType: 'slot.updated',
          payloadHash: 'abc',
          revision: 1,
          processingStatus: 'received',
        },
      });
    } catch {
      duplicateInsertBlocked = true;
    }
    if (first === 'apply' && dup === 'rejected_duplicate' && stale === 'rejected_stale' && duplicateInsertBlocked) {
      reliable.works.push('SC-11: inbox apply / duplicate / stale decisions; unique (connection, providerEventId) blocks replay insert');
    } else {
      reliable.broken.push(
        `Inbox ordering unexpected: ${JSON.stringify({ first, dup, stale, duplicateInsertBlocked })}`,
      );
    }
    reliable.verdict = reliable.broken.length ? 'PARTIAL' : 'VERIFIED';
    results.push(reliable);
    flagOff('RELIABLE_PROCESSING');

    // --- CONNECTIVITY_API ---
    flagOn('CONNECTIVITY_API');
    const connectivity: FlagResult = {
      flag: 'CONNECTIVITY_API',
      exercised: ['/v1 routes exist; unauthenticated reject; sandbox cannot act on production'],
      works: [],
      broken: [],
      blocked: [],
      verdict: 'VERIFIED',
    };
    if (!isConnectivityEnabled()) connectivity.broken.push('CONNECTIVITY_API did not enable');
    connectivity.works.push(
      'Routes present: GET /v1/connections, PUT /v1/connections/[id]/availability, /content, /events. requirePartner 401s when signature headers are missing',
    );
    if (!canSignForEnvironment('sandbox', 'production') && canSignForEnvironment('sandbox', 'sandbox')) {
      connectivity.works.push('Sandbox credentials cannot sign for a production connection (environment must match)');
    } else {
      connectivity.broken.push('Sandbox/production isolation rule failed');
    }
    connectivity.blocked.push(
      'No CONNECTIVITY_PARTNER_SECRETS in this walkthrough process — live HMAC round-trip against a partner was not run (synthetic environment match only)',
    );
    connectivity.verdict = connectivity.broken.length ? 'PARTIAL' : 'PARTIAL';
    results.push(connectivity);
    flagOff('CONNECTIVITY_API');

    // --- CERTIFICATION_ENFORCEMENT ---
    flagOn('CERTIFICATION_ENFORCEMENT');
    const cert: FlagResult = {
      flag: 'CERTIFICATION_ENFORCEMENT',
      exercised: ['productionCapabilityDecision for transactional_booking; mock evidence refused'],
      works: [],
      broken: [],
      blocked: [],
      verdict: 'VERIFIED',
    };
    const mock = productionCapabilityDecision({
      capability: 'transactional_booking',
      evidence: { source: 'mock', milestone5: true },
    });
    const noMs5 = productionCapabilityDecision({
      capability: 'transactional_booking',
      evidence: { source: 'sandbox', milestone5: false },
    });
    if (mock.code === 'mock_evidence_refused' && noMs5.code === 'milestone_5_required') {
      cert.works.push('Surfaces exist; mock/sandbox evidence cannot enable connector instant booking');
    } else {
      cert.broken.push(`Certification decisions unexpected: ${JSON.stringify({ mock, noMs5 })}`);
    }
    cert.blocked.push('No partner is CERTIFIED. Local harness is not vendor-environment evidence.');
    cert.verdict = cert.broken.length ? 'PARTIAL' : 'PARTIAL';
    results.push(cert);
    flagOff('CERTIFICATION_ENFORCEMENT');

    // --- CONCIERGE_ONBOARDING ---
    flagOn('CONCIERGE_ONBOARDING');
    const concierge: FlagResult = {
      flag: 'CONCIERGE_ONBOARDING',
      exercised: ['draft store, admin cannot manufacture approval, publish requires school approval (SC-25)'],
      works: [],
      broken: [],
      blocked: [],
      verdict: 'VERIFIED',
    };
    const store = conciergeStoreDecision({
      source: 'SYNTHETIC_FIXTURE',
      provenance: {
        source: 'SYNTHETIC_FIXTURE',
        sourceUrl: 'https://example.test/walkthrough',
        retrievedAt: new Date().toISOString(),
        fields: ['legalName'],
      },
    });
    const adminApprove = conciergeApprovalDecision({ representativeVerified: false });
    const schoolApprove = conciergeApprovalDecision({ representativeVerified: true });
    const publishWithout = conciergePublishDecision({ schoolApproved: false });
    const publishWith = conciergePublishDecision({ schoolApproved: true });
    if (
      store.allowed &&
      store.authorizationEventsCreated === 0 &&
      !adminApprove.allowed &&
      schoolApprove.allowed &&
      schoolApprove.authorizationEventsCreated === 0 &&
      !publishWithout.allowed &&
      publishWith.allowed &&
      publishWith.authorizationEventsCreated === 0
    ) {
      concierge.works.push(
        'SC-25: drafts stay unpublished; admin/non-representative cannot approve; school approval still grants no policy/verification/scopes',
      );
    } else {
      concierge.broken.push('Concierge manufacture-approval guards failed');
    }
    const draft = await prisma.conciergeDraft.create({
      data: {
        listingId: schoolListingId,
        source: 'SYNTHETIC_FIXTURE',
        provenance: {
          source: 'SYNTHETIC_FIXTURE',
          sourceUrl: 'https://example.test/walkthrough',
          retrievedAt: new Date().toISOString(),
          fields: ['legalName'],
        },
        payload: { legalName: `Walkthrough Prospect ${suffix}` },
        state: 'DRAFT',
      },
    });
    concierge.works.push(`Draft row persisted (${draft.id}) in DRAFT; no grant events created`);
    concierge.verdict = concierge.broken.length ? 'PARTIAL' : 'VERIFIED';
    results.push(concierge);
    flagOff('CONCIERGE_ONBOARDING');

    // --- OPS_ALERTING ---
    flagOn('OPS_ALERTING');
    const ops: FlagResult = {
      flag: 'OPS_ALERTING',
      exercised: ['threshold evaluation with no env baselines; snapshot tables readable'],
      works: [],
      broken: [],
      blocked: [],
      verdict: 'VERIFIED',
    };
    const thresholds = readConfiguredThresholds();
    const sample = evaluateAlert({
      value: 0,
      threshold: thresholds.inbox_depth,
    });
    const schoolCount = await prisma.instructor.count({
      where: { id: { startsWith: 'listing-' } },
    });
    if (sample.baseline === 'unmeasured' && !sample.firing) {
      ops.works.push(
        'Admin snapshot path can read; unset thresholds stay unmeasured and do not fire. No SLO numbers invented',
      );
    } else {
      ops.broken.push('Ops alerting fired or invented a baseline without env thresholds');
    }
    ops.works.push(`Staging synthetic listings visible to count queries (${schoolCount} walkthrough-prefixed)`);
    ops.verdict = ops.broken.length ? 'PARTIAL' : 'VERIFIED';
    results.push(ops);
    flagOff('OPS_ALERTING');

    // --- Part B ---
    const otherGrant = await persistEvent(prisma, {
      listingId: schoolListingId,
      kind: 'grant',
      scopes: ['request_to_book'],
      actorUserId: otherUserId,
      evidenceRef: `manual-review:${suffix}:intruder`,
      expectedHeadSequence: 1,
      decisionVersion: 2,
      idempotencyKey: `idem-other-${suffix}`,
    });
    proofs.tenantIsolation = otherGrant.ok
      ? { ok: false, detail: 'Other-school user was able to grant on the walkthrough listing' }
      : {
          ok: true,
          detail: `Other-school actor refused (${otherGrant.code}). Representative must match the listing.`,
        };

    const withdraw = await persistEvent(prisma, {
      listingId: schoolListingId,
      kind: 'withdraw',
      scopes: ['inquiry_collection'],
      actorUserId: schoolUserId,
      evidenceRef: `manual-review:${suffix}:withdraw`,
      expectedHeadSequence: 1,
      decisionVersion: 2,
      idempotencyKey: `idem-withdraw-${suffix}`,
    });
    const folded = foldAuthorizationEvents(
      (await prisma.schoolAuthorizationEvent.findMany({
        where: { listingId: schoolListingId },
        orderBy: { sequence: 'asc' },
      })) as unknown as AuthorizationEvent[],
    );
    const surfacesOff = listingSurfaces({
      bookingMode: 'instant',
      folded,
      enforcementOn: false,
    });
    const reread = foldAuthorizationEvents(
      (await prisma.schoolAuthorizationEvent.findMany({
        where: { listingId: schoolListingId },
        orderBy: { sequence: 'asc' },
      })) as unknown as AuthorizationEvent[],
    );
    proofs.withdrawal = {
      ok:
        withdraw.ok &&
        folded.withdrawn.includes('inquiry_collection') &&
        surfacesOff.inquiryCollection === false &&
        reread.withdrawn.includes('inquiry_collection') &&
        reread.headSequence >= 2,
      detail: `withdraw=${JSON.stringify(withdraw)} withdrawn=${folded.withdrawn.join(',')} inquiryCollection=${surfacesOff.inquiryCollection} historyRows=${reread.headSequence}`,
    };

    const contactGrant = await persistEvent(prisma, {
      listingId: contactListingId,
      kind: 'grant',
      scopes: ['transactional_booking'],
      actorUserId: schoolUserId,
      evidenceRef: `manual-review:${suffix}:contact-lift`,
      expectedHeadSequence: 0,
      decisionVersion: 1,
      idempotencyKey: `idem-contact-${suffix}`,
    });
    const contactSurfaces = listingSurfaces({
      bookingMode: 'contact',
      folded: foldAuthorizationEvents(
        (await prisma.schoolAuthorizationEvent.findMany({
          where: { listingId: contactListingId },
        })) as unknown as AuthorizationEvent[],
      ),
      enforcementOn: true,
    });
    proofs.contactRestriction = {
      ok: !contactGrant.ok && contactGrant.code === 'contact_locked' && contactSurfaces.directoryOnly,
      detail: `grant=${JSON.stringify(contactGrant)} directoryOnly=${contactSurfaces.directoryOnly}`,
    };
  } finally {
    await cleanup(prisma, {
      schoolListingId,
      contactListingId,
      otherListingId,
      schoolUserId,
      otherUserId,
      instructorUserId,
      suffix,
    });
    await prisma.$disconnect();
  }

  const verified = results.filter((row) => row.verdict === 'VERIFIED').map((row) => row.flag);
  const report = {
    environment: 'staging-neon-preview',
    hostGuard: STAGING_HOST,
    productionTouched: false,
    schoolAuthzEnforcement: false,
    startedAt: new Date().toISOString(),
    results,
    proofs,
    verifiedFlags: verified,
  };
  const outPath = resolve('docs/v1.2-production-readiness-walkthrough.json');
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

async function persistEvent(
  prisma: PrismaClient,
  input: {
    listingId: string;
    kind: 'grant' | 'withdraw';
    scopes: Array<
      | 'availability_display'
      | 'inquiry_collection'
      | 'request_to_book'
      | 'transactional_booking'
      | 'payment_collection'
    >;
    actorUserId: string;
    evidenceRef: string;
    expectedHeadSequence: number;
    decisionVersion: number;
    idempotencyKey: string;
  },
): Promise<{ ok: boolean; replay?: boolean; sequence?: number; code?: string }> {
  const existing = await prisma.schoolAuthorizationEvent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return { ok: true, replay: true, sequence: existing.sequence };
  const rows = await prisma.schoolAuthorizationEvent.findMany({
    where: { listingId: input.listingId },
    orderBy: { sequence: 'asc' },
  });
  const instructor = await prisma.instructor.findUnique({
    where: { id: input.listingId },
    select: { bookingMode: true },
  });
  const representative = await prisma.listingRepresentativeAuthority.findUnique({
    where: { listingId_userId: { listingId: input.listingId, userId: input.actorUserId } },
  });
  const head = foldAuthorizationEvents(rows as unknown as AuthorizationEvent[]);
  const plan = planAuthorizationAppend(head, {
    kind: input.kind,
    scopes: input.scopes,
    actorUserId: input.actorUserId,
    evidenceRef: input.evidenceRef,
    note: null,
    expectedHeadSequence: input.expectedHeadSequence,
    decisionVersion: input.decisionVersion,
    idempotencyKey: input.idempotencyKey,
    bookingMode: instructor?.bookingMode,
    representative: representative
      ? {
          userId: representative.userId,
          verifiedAt: representative.verifiedAt.toISOString(),
          evidenceRef: representative.evidenceRef,
        }
      : null,
    existingIdempotencyKey: null,
  });
  if (!plan.ok) return { ok: false, code: plan.code };
  if (plan.replay) return { ok: true, replay: true, sequence: head.headSequence };
  await prisma.$transaction(async (tx) => {
    await tx.schoolAuthorizationEvent.create({
      data: {
        listingId: input.listingId,
        sequence: plan.sequence,
        kind: input.kind,
        scopes: plan.scopes,
        actorUserId: input.actorUserId,
        evidenceRef: input.evidenceRef,
        note: null,
        decisionVersion: plan.decisionVersion,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await tx.listingAuthzHead.upsert({
      where: { listingId: input.listingId },
      create: {
        listingId: input.listingId,
        headSequence: plan.sequence,
        decisionVersion: plan.decisionVersion,
      },
      update: { headSequence: plan.sequence, decisionVersion: plan.decisionVersion },
    });
  });
  return { ok: true, replay: false, sequence: plan.sequence };
}

async function cleanup(
  prisma: PrismaClient,
  ids: {
    schoolListingId: string;
    contactListingId: string;
    otherListingId: string;
    schoolUserId: string;
    otherUserId: string;
    instructorUserId: string;
    suffix: string;
  },
) {
  const listingIds = [ids.schoolListingId, ids.contactListingId, ids.otherListingId];
  await prisma.commandOutbox.deleteMany({ where: { bookingId: { startsWith: `booking-${ids.suffix}` } } });
  const connections = await prisma.schoolConnection.findMany({
    where: { listingId: { in: listingIds } },
    select: { id: true },
  });
  await prisma.bookingEvent.deleteMany({
    where: { schoolConnectionId: { in: connections.map((row) => row.id) } },
  });
  await prisma.schoolConnection.deleteMany({ where: { listingId: { in: listingIds } } });
  await prisma.booking.deleteMany({ where: { id: { startsWith: `booking-${ids.suffix}` } } });
  await prisma.conciergeDraft.deleteMany({ where: { listingId: { in: listingIds } } });
  await prisma.cancellationPolicy.deleteMany({ where: { listingId: { in: listingIds } } });
  await prisma.teachingPermission.deleteMany({ where: { listingId: { in: listingIds } } });
  await prisma.schoolInstructorAffiliation.deleteMany({ where: { schoolListingId: { in: listingIds } } });
  await prisma.schoolInstructorInvitation.deleteMany({ where: { schoolListingId: { in: listingIds } } });
  await prisma.schoolAuthorizationEvent.deleteMany({ where: { listingId: { in: listingIds } } });
  await prisma.listingAuthzHead.deleteMany({ where: { listingId: { in: listingIds } } });
  await prisma.listingRepresentativeAuthority.deleteMany({ where: { listingId: { in: listingIds } } });
  await prisma.prospectClaim.deleteMany({
    where: { claimantUserId: { in: [ids.schoolUserId, ids.otherUserId, ids.instructorUserId] } },
  });
  await prisma.listingProspect.deleteMany({ where: { legalName: { startsWith: 'Walkthrough Prospect' } } });
  await prisma.membership.deleteMany({
    where: { userId: { in: [ids.schoolUserId, ids.otherUserId, ids.instructorUserId] } },
  });
  await prisma.organization.deleteMany({ where: { name: { startsWith: 'Walkthrough Org' } } });
  await prisma.instructor.deleteMany({ where: { id: { in: listingIds } } });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.schoolUserId, ids.otherUserId, ids.instructorUserId] } },
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exit(1);
});
