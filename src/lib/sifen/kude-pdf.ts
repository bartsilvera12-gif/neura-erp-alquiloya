/**
 * Genera buffer PDF tipo KuDE (representación gráfica del DE aprobado).
 * Usa pdf-lib + StandardFonts (sin .afm en disco; compatible con Vercel serverless).
 */
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { KudeParsedFromXml } from "./parse-kude-from-signed-xml";

export type BuildKudePdfInput = {
  parsed: KudeParsedFromXml;
  numeroFactura: string;
  dProtAut: string | null;
  qrUrl: string;
};

const A4_W = 595.28;
const A4_H = 841.89;

function formatMonto(nStr: string, moneda: string): string {
  const n = Number.parseFloat(nStr.replace(",", "."));
  if (!Number.isFinite(n)) return nStr;
  if (moneda === "PYG" || moneda === "GS") {
    return `Gs. ${Math.round(n).toLocaleString("es-PY")}`;
  }
  return n.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function readLogoBytes(): Uint8Array | null {
  const p = path.join(process.cwd(), "public", "logo-neura.png");
  try {
    if (fs.existsSync(p)) return new Uint8Array(fs.readFileSync(p));
  } catch {
    /* ignore */
  }
  return null;
}

function wrapLines(text: string, maxW: number, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const pushBreakLong = (token: string) => {
    if (font.widthOfTextAtSize(token, size) <= maxW) {
      lines.push(token);
      return;
    }
    let chunk = "";
    for (const ch of token) {
      const next = chunk + ch;
      if (font.widthOfTextAtSize(next, size) > maxW && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    if (chunk) lines.push(chunk);
  };

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxW) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = "";
      if (font.widthOfTextAtSize(w, size) > maxW) {
        pushBreakLong(w);
      } else {
        line = w;
      }
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildKudePdfBuffer(input: BuildKudePdfInput): Promise<Buffer> {
  const { parsed, numeroFactura, dProtAut, qrUrl } = input;

  const qrPng = await QRCode.toBuffer(qrUrl, {
    type: "png",
    width: 160,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`KuDE — Factura ${numeroFactura}`);
  pdfDoc.setAuthor("Neura ERP");

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const slate = rgb(15 / 255, 23 / 255, 42 / 255);
  const green = rgb(22 / 255, 163 / 255, 74 / 255);
  const muted = rgb(100 / 255, 116 / 255, 139 / 255);
  const footerMuted = rgb(148 / 255, 163 / 255, 184 / 255);
  const lineGray = rgb(0.89, 0.91, 0.93);

  const margin = 48;
  let page = pdfDoc.addPage([A4_W, A4_H]);
  const pageW = () => page.getWidth();
  const pageH = () => page.getHeight();

  /** Cursor desde el borde superior (pt). */
  let ty = margin;

  const ensureSpace = (needFromTop: number) => {
    const h = pageH();
    if (ty + needFromTop > h - margin) {
      page = pdfDoc.addPage([A4_W, A4_H]);
      ty = margin;
    }
  };

  const drawText = (s: string, size: number, f = font, col = slate, x = margin) => {
    const h = pageH();
    const baseline = h - ty - size * 0.8;
    page.drawText(s, { x, y: baseline, size, font: f, color: col });
    ty += size * 1.25;
  };

  const drawTextCenter = (s: string, size: number, f = fontBold, col = slate) => {
    const h = pageH();
    const w = pageW();
    const tw = f.widthOfTextAtSize(s, size);
    const baseline = h - ty - size * 0.8;
    page.drawText(s, { x: (w - tw) / 2, y: baseline, size, font: f, color: col });
    ty += size * 1.25;
  };

  const drawLineFull = () => {
    const h = pageH();
    const w = pageW();
    const yLine = h - ty;
    page.drawLine({
      start: { x: margin, y: yLine },
      end: { x: w - margin, y: yLine },
      thickness: 0.5,
      color: lineGray,
    });
    ty += 6;
  };

  const logoBytes = readLogoBytes();
  if (logoBytes) {
    try {
      const img = await pdfDoc.embedPng(logoBytes);
      const imgW = 140;
      const scale = imgW / img.width;
      const imgH = img.height * scale;
      ensureSpace(imgH + 12);
      const h = pageH();
      page.drawImage(img, { x: margin, y: h - ty - imgH, width: imgW, height: imgH });
      ty += imgH + 10;
    } catch {
      /* sin logo */
    }
  }

  drawTextCenter("Factura electrónica — KuDE", 16, fontBold, slate);
  drawTextCenter("Documento aprobado por SIFEN / SET", 10, font, green);
  ty += 4;

  drawText(`Factura Nº ${numeroFactura}`, 9);
  drawText(
    `Timbrado: ${parsed.timbrado.dNumTim}  Est.: ${parsed.timbrado.dEst}  Exp.: ${parsed.timbrado.dPunExp}  Nro.: ${parsed.timbrado.dNumDoc}`,
    9
  );
  drawText(`Fecha y hora de emisión (DE): ${parsed.dFeEmiDE}`, 9);
  ty += 6;

  drawText("Emisor", 11, fontBold, slate);
  drawText(`${parsed.emisor.dNomEmi}`, 9);
  drawText(`RUC: ${parsed.emisor.dRucEm}-${parsed.emisor.dDVEmi}`, 9);
  drawText(`Dirección: ${parsed.emisor.dDirEmi}`, 9);
  drawText(`Tel.: ${parsed.emisor.dTelEmi}  Email: ${parsed.emisor.dEmailE}`, 9);
  ty += 4;

  drawText("Receptor", 11, fontBold, slate);
  drawText(`${parsed.receptor.nombre}`, 9);
  drawText(`${parsed.receptor.docLabel}: ${parsed.receptor.docValue}`, 9);
  if (parsed.receptor.direccion) drawText(`Dirección: ${parsed.receptor.direccion}`, 9);
  ty += 8;

  drawText("Detalle", 11, fontBold, slate);
  ty += 2;

  const w = pageW();
  const colDesc = margin;
  const colCant = w - margin - 220;
  const colPu = w - margin - 150;
  const colTot = w - margin - 70;
  const descW = colCant - colDesc - 8;

  const h0 = pageH();
  const headerY = ty;
  page.drawText("Descripción", { x: colDesc, y: h0 - headerY - 8 * 0.8, size: 8, font, color: muted });
  const wCant = font.widthOfTextAtSize("Cant.", 8);
  page.drawText("Cant.", { x: colCant + 40 - wCant, y: h0 - headerY - 8 * 0.8, size: 8, font, color: muted });
  const wPu = font.widthOfTextAtSize("P. unit.", 8);
  page.drawText("P. unit.", { x: colPu + 55 - wPu, y: h0 - headerY - 8 * 0.8, size: 8, font, color: muted });
  const wTot = font.widthOfTextAtSize("Total", 8);
  page.drawText("Total", { x: colTot + 60 - wTot, y: h0 - headerY - 8 * 0.8, size: 8, font, color: muted });
  ty = headerY + 12;
  drawLineFull();

  for (const row of parsed.items) {
    const desc = row.descripcion || "—";
    const lines = wrapLines(desc, descW, font, 8);
    const rowH = Math.max(22, lines.length * 10 + 4);
    ensureSpace(rowH + 8);

    const hh = pageH();
    const firstBaseline = hh - ty - 8 * 0.8;
    const cStr = row.cantidad || "—";
    const wC = font.widthOfTextAtSize(cStr, 8);
    page.drawText(cStr, { x: colCant + 40 - wC, y: firstBaseline, size: 8, font, color: slate });
    const puStr = formatMonto(row.precioUnit, parsed.monedaCodigo);
    const wPuStr = font.widthOfTextAtSize(puStr, 8);
    page.drawText(puStr, { x: colPu + 55 - wPuStr, y: firstBaseline, size: 8, font, color: slate });
    const tlStr = formatMonto(row.totalLinea, parsed.monedaCodigo);
    const wTl = font.widthOfTextAtSize(tlStr, 8);
    page.drawText(tlStr, { x: colTot + 60 - wTl, y: firstBaseline, size: 8, font, color: slate });

    let lineTy = ty;
    for (const ln of lines) {
      const hLn = pageH();
      const baseline = hLn - lineTy - 8 * 0.8;
      page.drawText(ln, { x: colDesc, y: baseline, size: 8, font, color: slate });
      lineTy += 10;
    }
    ty = lineTy + 6;
  }

  ty += 4;
  drawLineFull();

  drawText(`Subtotal operación: ${formatMonto(parsed.totales.dTotOpe, parsed.monedaCodigo)}`, 10);
  drawText(`IVA: ${formatMonto(parsed.totales.dTotIVA, parsed.monedaCodigo)}`, 10);
  drawText(`Total: ${formatMonto(parsed.totales.dTotGralOpe, parsed.monedaCodigo)}`, 12, fontBold, slate);
  if (parsed.monedaDescripcion) {
    drawText(`Moneda: ${parsed.monedaDescripcion} (${parsed.monedaCodigo})`, 8, font, muted);
  }
  ty += 6;

  drawText(`CDC: ${parsed.cdc}`, 8);
  if (dProtAut) {
    drawText(`dProtAut (autorización SET): ${dProtAut}`, 8);
  }
  ty += 8;

  ensureSpace(130);
  const qrImg = await pdfDoc.embedPng(new Uint8Array(qrPng));
  const qrSize = 100;
  const hQr = pageH();
  page.drawImage(qrImg, { x: margin, y: hQr - ty - qrSize, width: qrSize, height: qrSize });
  ty += qrSize + 4;
  drawText("Consulta QR e-kuatia / SET", 7, font, muted);

  const foot = "Generado con Neura ERP — representación gráfica del documento electrónico.";
  const lastPage = page;
  const hLast = lastPage.getHeight();
  const wLast = lastPage.getWidth();
  const footSize = 7;
  const footW = font.widthOfTextAtSize(foot, footSize);
  lastPage.drawText(foot, {
    x: (wLast - footW) / 2,
    y: 36,
    size: footSize,
    font,
    color: footerMuted,
  });

  const out = await pdfDoc.save();
  return Buffer.from(out);
}
