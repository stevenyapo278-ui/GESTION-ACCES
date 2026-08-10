import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

import { requestDataPairs } from './requestData';

// ─────────────────────────────────────────────────────────────────────────────
// Fichier joint PDF récapitulatif d'une demande : logo à gauche dans l'en-tête,
// « DSI » à droite, tableau des informations saisies et section décision.
// ─────────────────────────────────────────────────────────────────────────────

const NAVY = '#0f172a';
const GOLD = '#d29922';
const LABEL_COLOR = '#64748b';
const VALUE_COLOR = '#0f172a';
const HAIRLINE = '#eef2f7';

// Le logo est lu depuis backend/assets/logo.png (peut être écrasé par .env
// via LOGO_PATH). S'il est absent, un bloc « GA » doré est dessiné à la place.
let logoCache: Buffer | null | undefined;

function resolveLogoPath(): string | null {
  const custom = process.env.LOGO_PATH;
  if (custom && fs.existsSync(custom)) return custom;
  const candidates = [
    path.join(__dirname, '../../assets/logo.png'),
    path.join(process.cwd(), 'assets/logo.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function loadLogo(): Buffer | null {
  if (logoCache !== undefined) return logoCache;
  const logoPath = resolveLogoPath();
  if (!logoPath) {
    logoCache = null;
    return null;
  }
  try {
    logoCache = fs.readFileSync(logoPath);
  } catch {
    logoCache = null;
  }
  return logoCache;
}

function drawHeader(doc: PDFKit.PDFDocument): void {
  const pageWidth = doc.page.width;
  const headerHeight = 72;

  doc.rect(0, 0, pageWidth, headerHeight).fill(NAVY);
  doc.rect(0, headerHeight, pageWidth, 3).fill(GOLD);

  const logo = loadLogo();
  if (logo) {
    try {
      doc.image(logo, 40, 16, { fit: [100, 40] });
    } catch {
      drawLogoFallback(doc, 40, 16, 44, 40);
    }
  } else {
    drawLogoFallback(doc, 40, 16, 44, 40);
  }

  doc
    .fontSize(22)
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .text('DSI', 0, 26, { width: pageWidth - 40, align: 'right' });
  doc
    .fontSize(9)
    .fillColor('#94a3b8')
    .font('Helvetica')
    .text('Direction des Systèmes d\'Information', 0, 50, { width: pageWidth - 40, align: 'right' });
}

function drawLogoFallback(doc: PDFKit.PDFDocument, x: number, y: number, size: number, height: number): void {
  doc.save();
  doc.roundedRect(x, y, size, height, 9).fill(GOLD);
  doc
    .fontSize(16)
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .text('GA', x, y + 10, { width: size, align: 'center' });
  doc.restore();
}

function drawDecisionBox(doc: PDFKit.PDFDocument, request: any): number {
  const status = request.status;
  const approved = status === 'APPROVED';
  const rejected = status === 'REJECTED';
  const bg = approved ? '#dcfce7' : rejected ? '#fee2e2' : '#f1f5f9';
  const fg = approved ? '#166534' : rejected ? '#991b1b' : '#475569';
  const label = approved ? 'Validée' : rejected ? 'Refusée' : 'En attente';

  const boxY = doc.y + 12;
  const width = doc.page.width - 80;
  const height = request.decisionComment ? 62 : 44;

  doc.roundedRect(40, boxY, width, height, 8).fill(bg);

  doc
    .fontSize(11)
    .fillColor(fg)
    .font('Helvetica-Bold')
    .text(`Décision : ${label}`, 52, boxY + 12);

  if (request.decisionComment) {
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Commentaire : ${request.decisionComment}`, 52, boxY + 30, {
        width: width - 24,
        lineBreak: true,
        ellipsis: true,
      });
  }
  if (request.decidedAt) {
    doc
      .fontSize(8)
      .fillColor('#64748b')
      .font('Helvetica')
      .text(`Décision le ${new Date(request.decidedAt).toLocaleString('fr-FR')}`, 52, boxY + height - 16);
  }

  return boxY + height;
}

function drawRows(doc: PDFKit.PDFDocument, request: any): void {
  const pairs = requestDataPairs(request);
  const labelWidth = 160;
  const valueX = 40 + labelWidth;

  for (const { label, value } of pairs) {
    if (doc.y > doc.page.height - 90) {
      doc.addPage();
    }

    doc
      .fontSize(9)
      .fillColor(LABEL_COLOR)
      .font('Helvetica')
      .text(label, 40, doc.y + 6, { width: labelWidth - 12, lineBreak: false });

    doc
      .fontSize(10)
      .fillColor(VALUE_COLOR)
      .font('Helvetica-Bold')
      .text(value, valueX, doc.y + 5, { width: doc.page.width - 80 - labelWidth });

    doc
      .moveTo(40, doc.y + 4)
      .lineTo(doc.page.width - 40, doc.y + 4)
      .lineWidth(0.5)
      .strokeColor(HAIRLINE)
      .stroke();
    doc.y += 5;
  }
}

function drawFooter(doc: PDFKit.PDFDocument): void {
  doc
    .fontSize(8)
    .fillColor('#94a3b8')
    .font('Helvetica')
    .text(
      `Document généré automatiquement par Gestions Access — ${new Date().toLocaleString('fr-FR')}`,
      40,
      doc.page.height - 40,
      { width: doc.page.width - 80, align: 'center' }
    );
}

export function buildRequestPdf(request: any): Promise<Buffer> {
  const title = (request.type?.name || 'Demande').toUpperCase();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: title,
        Author: 'Gestions Access',
        Producer: 'Gestions Access',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc);

    doc.y = 100;
    doc
      .fontSize(16)
      .fillColor(VALUE_COLOR)
      .font('Helvetica-Bold')
      .text(title, 40, 92);
    doc
      .fontSize(9)
      .fillColor(LABEL_COLOR)
      .font('Helvetica')
      .text('Récapitulatif des informations renseignées par l\'utilisateur', 40, 114);

    doc.y = 132;
    drawRows(doc, request);

    const afterBox = drawDecisionBox(doc, request);
    doc.y = afterBox + 20;

    drawFooter(doc);
    doc.end();
  });
}