import type { Business, BusinessDocument, Customer, DocumentLine } from './types';
import { formatTZS } from './money';
import { formatQty } from './units';

/**
 * Invoice PDFs are built on the phone, not the server: the document may have
 * been written offline and not synced yet, and the owner still needs to send
 * it. pdf-lib is imported lazily, so it costs nothing until the first PDF.
 */
export async function buildDocumentPdf(input: {
  business: Business;
  document: BusinessDocument;
  lines: readonly DocumentLine[];
  customer: Customer | null;
  labels: { title: string; subtotal: string; vat: string; total: string; customer: string; payTo: string };
}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const { business, document, lines, customer, labels } = input;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.08, 0.06);
  const soft = rgb(0.34, 0.32, 0.29);
  const brand = rgb(0.06, 0.42, 0.25);

  // Standard fonts are WinAnsi only; strip anything they cannot draw (emoji).
  const safe = (text: string) => text.replace(/[^\x20-\x7e -ÿ]/g, '').trim();
  let y = 790;
  const text = (value: string, x: number, size = 10, f = font, color = ink) => page.drawText(safe(value), { x, y, size, font: f, color });
  const right = (value: string, xRight: number, size = 10, f = font) => {
    const s = safe(value);
    page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y, size, font: f, color: ink });
  };

  text(business.name, 50, 18, bold, brand);
  right(labels.title, 545, 18, bold);
  y -= 20;
  if (business.phone) text(business.phone, 50, 10, font, soft);
  right(document.number, 545, 12, bold);
  y -= 14;
  if (business.tin) text(`TIN: ${business.tin}`, 50, 10, font, soft);
  right(new Date(document.clientCreatedAt).toLocaleDateString('en-GB'), 545, 10);
  y -= 14;
  if (business.vrn) text(`VRN: ${business.vrn}`, 50, 10, font, soft);

  y -= 36;
  text(labels.customer, 50, 9, bold, soft);
  y -= 14;
  text(customer?.name ?? '-', 50, 12, bold);
  if (customer?.phone) {
    y -= 14;
    text(customer.phone, 50, 10, font, soft);
  }

  y -= 34;
  page.drawRectangle({ x: 50, y: y - 6, width: 495, height: 22, color: rgb(0.93, 0.95, 0.93) });
  text('#', 56, 9, bold);
  text('Description', 76, 9, bold);
  right('Qty', 360, 9, bold);
  right('Price', 450, 9, bold);
  right('Amount', 540, 9, bold);
  y -= 24;

  lines.forEach((line, index) => {
    text(String(index + 1), 56);
    text(line.description.slice(0, 48) + (line.vatType === 'exempt' ? ' (E)' : ''), 76);
    right(formatQty(line.qty), 360);
    right(formatTZS(line.unitPrice), 450);
    right(formatTZS(line.lineTotal), 540);
    y -= 18;
  });

  y -= 8;
  page.drawLine({ start: { x: 330, y: y + 10 }, end: { x: 545, y: y + 10 }, thickness: 0.8, color: soft });
  y -= 6;
  text(labels.subtotal, 340);
  right(formatTZS(document.subtotal), 540);
  y -= 16;
  text(labels.vat, 340);
  right(formatTZS(document.vat), 540);
  y -= 20;
  text(labels.total, 340, 12, bold);
  right(`TSh ${formatTZS(document.total)}`, 540, 12, bold);

  const s = business.settings;
  if (s.bankName || s.bankAccount || s.payNumber) {
    y -= 50;
    text(labels.payTo, 50, 9, bold, soft);
    if (s.bankName || s.bankAccount) {
      y -= 14;
      text(`${s.bankName ?? ''} ${s.bankAccount ?? ''}`, 50);
    }
    if (s.payNumber) {
      y -= 14;
      text(`Lipa: ${s.payNumber}`, 50);
    }
  }
  if (document.notes) {
    y -= 28;
    text(document.notes.slice(0, 90), 50, 9, font, soft);
  }
  if (s.receiptFooter) {
    y = 50;
    text(s.receiptFooter.slice(0, 90), 50, 9, font, soft);
  }

  return pdf.save();
}
