// @polsia:framework-owned - DO NOT EDIT. Code installed by polsia/modules/pdf@0.1.0. Drift = commit rejected.
//
// Server-only PDF renderer. Lays out a validated DocumentSpec into a single
// (paginating as needed) PDF using the pure-JS `pdf-lib` library — no native
// deps, serverless-safe. No secrets, no env, no network: rendering is local.
// Money fields are integer cents and are formatted to currency at render time.

import 'server-only';
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { DocumentSpec } from '@/lib/pdf/schema';

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TEXT = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.82, 0.84, 0.88);
const ZEBRA = rgb(0.96, 0.97, 0.98);

// Column layout for the line-item table (x offsets from the left margin).
const COL_DESCRIPTION = 0;
const COL_QTY = CONTENT_WIDTH * 0.56;
const COL_UNIT = CONTENT_WIDTH * 0.72;
const COL_AMOUNT_RIGHT = CONTENT_WIDTH; // right-aligned edge

function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, '0');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${grouped}.${frac}`;
}

// pdf-lib's WinAnsi StandardFonts cannot encode arbitrary Unicode; strip the
// characters they cannot draw so a stray emoji/glyph never throws mid-render.
function sanitize(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[^\x20-\x7E]/g, '');
}

function widthOf(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(sanitize(text), size);
}

// Greedy word-wrap into lines that fit `maxWidth`.
function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (widthOf(font, candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface RenderCursor {
  page: PDFPage;
  y: number;
}

export async function renderDocumentPdf(spec: DocumentSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const cursor: RenderCursor = { page, y: PAGE_HEIGHT - MARGIN };

  // Reserve vertical room; add a new page when the cursor would run past the
  // bottom margin so long invoices keep flowing.
  const ensureSpace = (needed: number) => {
    if (cursor.y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursor.page = page;
      cursor.y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawText = (
    text: string,
    opts: { x?: number; size?: number; font?: PDFFont; color?: typeof TEXT; rightX?: number } = {},
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 11;
    const clean = sanitize(text);
    const x =
      opts.rightX !== undefined
        ? MARGIN + opts.rightX - widthOf(f, clean, size)
        : MARGIN + (opts.x ?? 0);
    cursor.page.drawText(clean, { x, y: cursor.y, size, font: f, color: opts.color ?? TEXT });
  };

  // --- Header: title + optional subtitle ---
  ensureSpace(30);
  drawText(spec.title, { size: 22, font: bold });
  cursor.y -= 28;

  if (spec.subtitle) {
    for (const line of wrap(font, spec.subtitle, 12, CONTENT_WIDTH)) {
      ensureSpace(18);
      drawText(line, { size: 12, color: MUTED });
      cursor.y -= 16;
    }
  }
  cursor.y -= 8;

  // --- Meta rows (label / value) ---
  if (spec.meta && spec.meta.length > 0) {
    const labelWidth = Math.min(
      160,
      Math.max(...spec.meta.map((row) => widthOf(bold, `${row.label}:`, 10))) + 8,
    );
    for (const row of spec.meta) {
      ensureSpace(16);
      drawText(`${row.label}:`, { size: 10, font: bold, color: MUTED });
      for (const [i, line] of wrap(font, row.value, 10, CONTENT_WIDTH - labelWidth).entries()) {
        if (i > 0) {
          ensureSpace(14);
          cursor.y -= 14;
        }
        drawText(line, { x: labelWidth, size: 10 });
      }
      cursor.y -= 16;
    }
    cursor.y -= 8;
  }

  // --- Line-item table ---
  if (spec.lineItems && spec.lineItems.length > 0) {
    ensureSpace(22);
    cursor.page.drawLine({
      start: { x: MARGIN, y: cursor.y + 14 },
      end: { x: MARGIN + CONTENT_WIDTH, y: cursor.y + 14 },
      thickness: 1,
      color: RULE,
    });
    drawText('Description', { x: COL_DESCRIPTION, size: 9, font: bold, color: MUTED });
    drawText('Qty', { x: COL_QTY, size: 9, font: bold, color: MUTED });
    drawText('Unit', { x: COL_UNIT, size: 9, font: bold, color: MUTED });
    drawText('Amount', { rightX: COL_AMOUNT_RIGHT, size: 9, font: bold, color: MUTED });
    cursor.y -= 6;
    cursor.page.drawLine({
      start: { x: MARGIN, y: cursor.y },
      end: { x: MARGIN + CONTENT_WIDTH, y: cursor.y },
      thickness: 1,
      color: RULE,
    });
    cursor.y -= 16;

    spec.lineItems.forEach((item, index) => {
      const descLines = wrap(font, item.description, 10, COL_QTY - 8);
      const rowHeight = Math.max(18, descLines.length * 13 + 5);
      ensureSpace(rowHeight);

      if (index % 2 === 1) {
        cursor.page.drawRectangle({
          x: MARGIN - 6,
          y: cursor.y - (rowHeight - 13),
          width: CONTENT_WIDTH + 12,
          height: rowHeight,
          color: ZEBRA,
        });
      }

      const amountCents = item.quantity * item.unitAmountCents;
      const rowTop = cursor.y;
      descLines.forEach((line, i) => {
        cursor.y = rowTop - i * 13;
        drawText(line, { x: COL_DESCRIPTION, size: 10 });
      });
      cursor.y = rowTop;
      drawText(String(item.quantity), { x: COL_QTY, size: 10 });
      drawText(formatCents(item.unitAmountCents), { x: COL_UNIT, size: 10 });
      drawText(formatCents(amountCents), { rightX: COL_AMOUNT_RIGHT, size: 10 });
      cursor.y = rowTop - rowHeight;
    });

    cursor.page.drawLine({
      start: { x: MARGIN, y: cursor.y + 6 },
      end: { x: MARGIN + CONTENT_WIDTH, y: cursor.y + 6 },
      thickness: 1,
      color: RULE,
    });
    cursor.y -= 8;
  }

  // --- Total ---
  if (typeof spec.totalCents === 'number') {
    ensureSpace(24);
    drawText('Total', { rightX: COL_UNIT + 40, size: 12, font: bold });
    drawText(formatCents(spec.totalCents), { rightX: COL_AMOUNT_RIGHT, size: 12, font: bold });
    cursor.y -= 24;
  }

  // --- Notes ---
  if (spec.notes) {
    cursor.y -= 8;
    for (const line of wrap(font, spec.notes, 10, CONTENT_WIDTH)) {
      ensureSpace(15);
      drawText(line, { size: 10, color: MUTED });
      cursor.y -= 14;
    }
  }

  // --- Footer (bottom of the last page) ---
  if (spec.footer) {
    const footerLines = wrap(font, spec.footer, 9, CONTENT_WIDTH);
    let footerY = MARGIN - 8;
    for (const line of [...footerLines].reverse()) {
      cursor.page.drawText(sanitize(line), {
        x: MARGIN,
        y: footerY,
        size: 9,
        font,
        color: MUTED,
      });
      footerY += 12;
    }
  }

  return doc.save();
}
