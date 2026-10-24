/**
 * Writes unsent outreach-sequence drafts (collection-plan §4 / §10).
 * Does not open Gmail, Resend, or a database. Does not send.
 *
 * Usage: npm run outreach:draft
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildOutreachSequence,
  OUTREACH_FROM,
  outreachSendDecision,
} from '../src/lib/acquisition/outreach-sequence-policy';

function main() {
  const template = buildOutreachSequence({});
  const synthetic = buildOutreachSequence({
    schoolName: 'Example Trafikskola (synthetic)',
    listingId: 'listing-synthetic',
  });
  if (!template.allowed || !synthetic.allowed) {
    throw new Error('template draft refused');
  }
  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    productionTouched: false,
    flagsChanged: [],
    outreachSent: 0,
    from: OUTREACH_FROM,
    send: outreachSendDecision(),
    template,
    syntheticExample: synthetic,
  };
  const root = resolve(__dirname, '..');
  const jsonPath = resolve(root, 'docs/authorization-outreach-sequence.json');
  const mdPath = resolve(root, 'docs/authorization-outreach-sequence.md');
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(
    mdPath,
    `# Authorization outreach sequence drafts

Generated: ${generatedAt}

Unsent playbook drafts for \`docs/authorization-collection-plan.md\` §4 and §10.
From: \`${OUTREACH_FROM}\`. Signature: \`${template.signature}\`.
Send decision: \`${payload.send.code}\`. Sent: ${payload.send.sent}.
Public claim page: **missing**. Scopes pre-selected: none.

This file is not a send list. Contact-restricted listings are excluded.
Workspace confirmation and a named founder authorization are still required
before any school is contacted.

## Cadence

${template.cadence
  .map(
    (row) => `### Day ${row.day} — ${row.subject}

${row.body}
`,
  )
  .join('\n')}
`,
  );
  // biome-ignore lint/suspicious/noConsole: operator stdout
  console.log(
    JSON.stringify(
      {
        from: OUTREACH_FROM,
        sent: false,
        sendBlocked: payload.send.code,
        wrote: [
          'docs/authorization-outreach-sequence.json',
          'docs/authorization-outreach-sequence.md',
        ],
      },
      null,
      2,
    ),
  );
}

main();
