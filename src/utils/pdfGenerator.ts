import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { FormDocument } from '../types/index.ts';

/**
 * Format number into Indonesian Rupiah format (e.g., Rp 1.500.000)
 */
export function formatRupiah(amount: number): string {
  return 'Rp ' + (amount || 0).toLocaleString('id-ID');
}

/**
 * Generate pixel-perfect official corporate PDF form matching physical standard
 */
export async function generateOfficialFormPdf(doc: FormDocument): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait (in points)
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette
  const colorPrimary = rgb(0.08, 0.18, 0.36); // Deep Navy CLX
  const colorDark = rgb(0.12, 0.14, 0.18); // Dark Slate Text
  const colorLightGray = rgb(0.93, 0.94, 0.96);
  const colorBorder = rgb(0.75, 0.78, 0.83);
  const colorSuccess = rgb(0.05, 0.55, 0.35);

  const margin = 36;
  const contentWidth = width - margin * 2;
  let cursorY = height - margin;

  // 1. TOP HEADER & LOGO BANNER
  // Draw top border accent
  page.drawRectangle({
    x: margin,
    y: cursorY - 4,
    width: contentWidth,
    height: 4,
    color: colorPrimary,
  });
  cursorY -= 14;

  // Company Name & Brand
  page.drawText('PT. Connectivity Leads eXcellence (CLX)', {
    x: margin,
    y: cursorY,
    size: 13,
    font: fontBold,
    color: colorPrimary,
  });

  // Document Number on Top Right
  const docNumText = `No. Dokumen: ${doc.docNumber}`;
  const docNumWidth = fontBold.widthOfTextAtSize(docNumText, 10);
  page.drawText(docNumText, {
    x: width - margin - docNumWidth,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: colorDark,
  });

  cursorY -= 14;
  page.drawText('Internal Financial, Operational & Purchase Control System', {
    x: margin,
    y: cursorY,
    size: 8,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.5),
  });

  const dateText = `Tanggal: ${doc.date}`;
  const dateWidth = fontRegular.widthOfTextAtSize(dateText, 9);
  page.drawText(dateText, {
    x: width - margin - dateWidth,
    y: cursorY,
    size: 9,
    font: fontRegular,
    color: colorDark,
  });

  cursorY -= 12;
  // Divider line
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: width - margin, y: cursorY },
    thickness: 1,
    color: colorBorder,
  });

  cursorY -= 20;

  // 2. FORM TITLE BANNER
  let formTitle = 'FORM PERMOHONAN UANG (FPU)';
  if (doc.formType === 'PFB') {
    formTitle = 'PERMOHONAN FAKTUR BIAYA & OPERASIONAL (PFB)';
  } else if (doc.formType === 'FPPB') {
    formTitle = 'FORM PERMOHONAN PEMBELIAN BARANG (FPPB)';
  }

  // Draw Title Box
  page.drawRectangle({
    x: margin,
    y: cursorY - 24,
    width: contentWidth,
    height: 28,
    color: colorLightGray,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  const titleWidth = fontBold.widthOfTextAtSize(formTitle, 12);
  page.drawText(formTitle, {
    x: margin + (contentWidth - titleWidth) / 2,
    y: cursorY - 17,
    size: 12,
    font: fontBold,
    color: colorPrimary,
  });

  cursorY -= 36;

  // 3. METADATA TWO-COLUMN SECTION
  const colW = contentWidth / 2;
  const metaBoxHeight = 72;

  page.drawRectangle({
    x: margin,
    y: cursorY - metaBoxHeight,
    width: contentWidth,
    height: metaBoxHeight,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  // Vertical divider between column 1 & column 2
  page.drawLine({
    start: { x: margin + colW, y: cursorY },
    end: { x: margin + colW, y: cursorY - metaBoxHeight },
    thickness: 1,
    color: colorBorder,
  });

  // Left Column: Requester & Division
  let leftY = cursorY - 14;
  const drawField = (label: string, value: string, xPos: number, yPos: number, isRight = false) => {
    page.drawText(label, {
      x: xPos,
      y: yPos,
      size: 8.5,
      font: fontBold,
      color: rgb(0.3, 0.35, 0.4),
    });
    page.drawText(`: ${value || '-'}`, {
      x: xPos + (isRight ? 95 : 85),
      y: yPos,
      size: 8.5,
      font: fontRegular,
      color: colorDark,
    });
  };

  drawField('DIVISI', doc.division.toUpperCase(), margin + 10, leftY);
  leftY -= 16;
  drawField('PEMOHON', doc.requesterName, margin + 10, leftY);
  leftY -= 16;
  drawField('JABATAN', doc.requesterRole, margin + 10, leftY);
  leftY -= 16;
  drawField('METODE BAYAR', doc.paymentMethod, margin + 10, leftY);

  // Right Column: Bank Info & Due Dates
  let rightY = cursorY - 14;
  drawField('BANK TUJUAN', doc.bankName || 'KAS / TUNAI', margin + colW + 10, rightY, true);
  rightY -= 16;
  drawField('NO. REKENING', doc.bankAccountNo || '-', margin + colW + 10, rightY, true);
  rightY -= 16;
  drawField('ATAS NAMA (A.N)', doc.bankAccountName || '-', margin + colW + 10, rightY, true);
  rightY -= 16;
  drawField('STATUS APPROVAL', doc.status.toUpperCase(), margin + colW + 10, rightY, true);

  cursorY -= (metaBoxHeight + 12);

  // 4. PURPOSE / KEPERLUAN BOX
  page.drawRectangle({
    x: margin,
    y: cursorY - 32,
    width: contentWidth,
    height: 32,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: colorBorder,
    borderWidth: 1,
  });

  page.drawText('KEPERLUAN / DESKRIPSI KEGIATAN:', {
    x: margin + 8,
    y: cursorY - 12,
    size: 8,
    font: fontBold,
    color: colorPrimary,
  });

  const purposeSafe = doc.purpose.length > 95 ? doc.purpose.substring(0, 92) + '...' : doc.purpose;
  page.drawText(purposeSafe, {
    x: margin + 8,
    y: cursorY - 24,
    size: 9,
    font: fontRegular,
    color: colorDark,
  });

  cursorY -= 42;

  // 5. LINE ITEMS TABLE
  const tableHeaders = [
    { text: 'NO', width: 30, align: 'center' },
    { text: 'URAIAN / RINCIAN BARANG ATAU BIAYA', width: 233, align: 'left' },
    { text: 'QTY', width: 45, align: 'center' },
    { text: 'SATUAN', width: 55, align: 'center' },
    { text: 'HARGA SATUAN (RP)', width: 80, align: 'right' },
    { text: 'TOTAL (RP)', width: 80, align: 'right' },
  ];

  const headerH = 20;
  const rowH = 18;

  // Draw Table Header Background
  page.drawRectangle({
    x: margin,
    y: cursorY - headerH,
    width: contentWidth,
    height: headerH,
    color: colorPrimary,
  });

  // Table header text
  let headerX = margin;
  for (const h of tableHeaders) {
    let textX = headerX + 4;
    if (h.align === 'center') {
      const tw = fontBold.widthOfTextAtSize(h.text, 7.5);
      textX = headerX + (h.width - tw) / 2;
    } else if (h.align === 'right') {
      const tw = fontBold.widthOfTextAtSize(h.text, 7.5);
      textX = headerX + h.width - tw - 4;
    }

    page.drawText(h.text, {
      x: textX,
      y: cursorY - 13,
      size: 7.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    headerX += h.width;
  }

  cursorY -= headerH;

  // Draw Rows
  const maxRows = Math.max(doc.items.length, 5); // Ensure at least 5 rows for authentic physical look
  for (let i = 0; i < maxRows; i++) {
    const item = doc.items[i];
    const isEven = i % 2 === 0;

    // Row background
    page.drawRectangle({
      x: margin,
      y: cursorY - rowH,
      width: contentWidth,
      height: rowH,
      color: isEven ? rgb(1, 1, 1) : rgb(0.97, 0.98, 0.99),
      borderColor: colorBorder,
      borderWidth: 0.5,
    });

    if (item) {
      let curX = margin;

      // No
      const noText = String(i + 1);
      const noW = fontRegular.widthOfTextAtSize(noText, 8);
      page.drawText(noText, {
        x: curX + (tableHeaders[0].width - noW) / 2,
        y: cursorY - 12,
        size: 8,
        font: fontRegular,
        color: colorDark,
      });
      curX += tableHeaders[0].width;

      // Description
      const descText = item.description.length > 48 ? item.description.slice(0, 45) + '...' : item.description;
      page.drawText(descText, {
        x: curX + 6,
        y: cursorY - 12,
        size: 8,
        font: fontRegular,
        color: colorDark,
      });
      curX += tableHeaders[1].width;

      // Qty
      const qtyText = String(item.qty);
      const qtyW = fontRegular.widthOfTextAtSize(qtyText, 8);
      page.drawText(qtyText, {
        x: curX + (tableHeaders[2].width - qtyW) / 2,
        y: cursorY - 12,
        size: 8,
        font: fontRegular,
        color: colorDark,
      });
      curX += tableHeaders[2].width;

      // Unit
      const unitText = item.unit || 'Unit';
      const unitW = fontRegular.widthOfTextAtSize(unitText, 8);
      page.drawText(unitText, {
        x: curX + (tableHeaders[3].width - unitW) / 2,
        y: cursorY - 12,
        size: 8,
        font: fontRegular,
        color: colorDark,
      });
      curX += tableHeaders[3].width;

      // Unit Price
      const priceText = (item.unitPrice || 0).toLocaleString('id-ID');
      const priceW = fontRegular.widthOfTextAtSize(priceText, 8);
      page.drawText(priceText, {
        x: curX + tableHeaders[4].width - priceW - 6,
        y: cursorY - 12,
        size: 8,
        font: fontRegular,
        color: colorDark,
      });
      curX += tableHeaders[4].width;

      // Total
      const totText = (item.total || 0).toLocaleString('id-ID');
      const totW = fontBold.widthOfTextAtSize(totText, 8);
      page.drawText(totText, {
        x: curX + tableHeaders[5].width - totW - 6,
        y: cursorY - 12,
        size: 8,
        font: fontBold,
        color: colorDark,
      });
    }

    cursorY -= rowH;
  }

  // 6. TOTAL ROW
  page.drawRectangle({
    x: margin,
    y: cursorY - 22,
    width: contentWidth,
    height: 22,
    color: colorLightGray,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  page.drawText('TOTAL PEMBAYARAN / TOTAL AMOUNT:', {
    x: margin + 140,
    y: cursorY - 14,
    size: 8.5,
    font: fontBold,
    color: colorPrimary,
  });

  const grandTotalText = formatRupiah(doc.totalAmount);
  const grandTotalW = fontBold.widthOfTextAtSize(grandTotalText, 10);
  page.drawText(grandTotalText, {
    x: width - margin - grandTotalW - 8,
    y: cursorY - 15,
    size: 10,
    font: fontBold,
    color: colorPrimary,
  });

  cursorY -= 30;

  // 7. AUTO-TERBILANG BOX
  page.drawRectangle({
    x: margin,
    y: cursorY - 30,
    width: contentWidth,
    height: 30,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.8, 0.85, 0.95),
    borderWidth: 1,
  });

  page.drawText('TERBILANG (INDONESIAN WORDS):', {
    x: margin + 8,
    y: cursorY - 11,
    size: 7.5,
    font: fontBold,
    color: colorPrimary,
  });

  const terbilangFormatted = `# ${doc.terbilang || 'Nol Rupiah'} #`;
  const terbilangSafe = terbilangFormatted.length > 98 ? terbilangFormatted.slice(0, 95) + '...' : terbilangFormatted;
  page.drawText(terbilangSafe, {
    x: margin + 8,
    y: cursorY - 22,
    size: 8.5,
    font: fontOblique,
    color: colorDark,
  });

  cursorY -= 40;

  // 8. NOTES & ATTACHMENT SUMMARY
  const noteBoxH = 26;
  page.drawRectangle({
    x: margin,
    y: cursorY - noteBoxH,
    width: contentWidth,
    height: noteBoxH,
    borderColor: colorBorder,
    borderWidth: 0.5,
  });

  const attachCount = doc.attachments?.length || 0;
  const attachText = `Lampiran: ${attachCount} Dokumen / Faktur Pendukung. Google Drive Parent ID: 1hgUyTqNsfJsC30pY7O2kPS95DqEEySm9`;
  page.drawText(attachText, {
    x: margin + 8,
    y: cursorY - 11,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.5),
  });

  const noteText = `Catatan: ${doc.notes || 'Pengajuan biaya internal diverifikasi dan diproses sesuai SOP Perusahaan CLX.'}`;
  page.drawText(noteText.slice(0, 110), {
    x: margin + 8,
    y: cursorY - 20,
    size: 7.5,
    font: fontRegular,
    color: colorDark,
  });

  cursorY -= 36;

  // 9. SIGNATURES & APPROVAL MATRIX (5 BOXES)
  page.drawText('MATRIKS PERSETUJUAN & TANDA TANGAN ELEKTRONIK (APPROVAL MATRIX):', {
    x: margin,
    y: cursorY,
    size: 8,
    font: fontBold,
    color: colorPrimary,
  });

  cursorY -= 10;

  const sigBoxW = contentWidth / 5;
  const sigBoxH = 92;

  const sigBoxes = [
    { title: 'PEMOHON', role: 'Staff', stamp: doc.signatures.maker, defaultName: doc.requesterName },
    { title: 'DIPERIKSA', role: 'CSO', stamp: doc.signatures.cso, defaultName: 'Chief Strategy Officer' },
    { title: 'DISETUJUI', role: 'COO', stamp: doc.signatures.coo, defaultName: 'Chief Operating Officer' },
    { title: 'DIVERIFIKASI', role: 'CFO', stamp: doc.signatures.cfo, defaultName: 'Chief Financial Officer' },
    { title: 'DISETUJUI AKHIR', role: 'CEO', stamp: doc.signatures.ceo, defaultName: 'Chief Executive Officer' },
  ];

  for (let i = 0; i < sigBoxes.length; i++) {
    const sb = sigBoxes[i];
    const boxX = margin + i * sigBoxW;

    // Outer border
    page.drawRectangle({
      x: boxX,
      y: cursorY - sigBoxH,
      width: sigBoxW,
      height: sigBoxH,
      borderColor: colorBorder,
      borderWidth: 1,
    });

    // Box Header (Role title)
    page.drawRectangle({
      x: boxX,
      y: cursorY - 16,
      width: sigBoxW,
      height: 16,
      color: colorLightGray,
      borderColor: colorBorder,
      borderWidth: 0.5,
    });

    const headerTitleW = fontBold.widthOfTextAtSize(sb.title, 7);
    page.drawText(sb.title, {
      x: boxX + (sigBoxW - headerTitleW) / 2,
      y: cursorY - 11,
      size: 7,
      font: fontBold,
      color: colorPrimary,
    });

    // If signed, draw official digital stamp with seal
    if (sb.stamp) {
      // Draw Seal Badge
      const stampBoxY = cursorY - 58;
      page.drawRectangle({
        x: boxX + 6,
        y: stampBoxY,
        width: sigBoxW - 12,
        height: 38,
        color: rgb(0.92, 0.98, 0.94),
        borderColor: colorSuccess,
        borderWidth: 1,
      });

      const stampVerified = 'DIGITALLY SIGNED';
      const svW = fontBold.widthOfTextAtSize(stampVerified, 6.5);
      page.drawText(stampVerified, {
        x: boxX + 6 + (sigBoxW - 12 - svW) / 2,
        y: stampBoxY + 28,
        size: 6.5,
        font: fontBold,
        color: colorSuccess,
      });

      const signerName = sb.stamp.userName || sb.defaultName;
      const signerSafe = signerName.length > 15 ? signerName.slice(0, 14) + '.' : signerName;
      const snW = fontBold.widthOfTextAtSize(signerSafe, 6.5);
      page.drawText(signerSafe, {
        x: boxX + 6 + (sigBoxW - 12 - snW) / 2,
        y: stampBoxY + 18,
        size: 6.5,
        font: fontBold,
        color: colorDark,
      });

      const dateOnly = sb.stamp.signedAt?.split('T')[0] || doc.date;
      const dtW = fontRegular.widthOfTextAtSize(dateOnly, 5.5);
      page.drawText(dateOnly, {
        x: boxX + 6 + (sigBoxW - 12 - dtW) / 2,
        y: stampBoxY + 10,
        size: 5.5,
        font: fontRegular,
        color: rgb(0.3, 0.35, 0.4),
      });

      const hashShort = `ID: ${sb.stamp.digitalHash?.slice(0, 8) || 'VERIFIED'}`;
      const hsW = fontRegular.widthOfTextAtSize(hashShort, 5);
      page.drawText(hashShort, {
        x: boxX + 6 + (sigBoxW - 12 - hsW) / 2,
        y: stampBoxY + 3,
        size: 5,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      });
    } else {
      // Empty waiting placeholder
      const waitText = '(Menunggu)';
      const wtW = fontOblique.widthOfTextAtSize(waitText, 7);
      page.drawText(waitText, {
        x: boxX + (sigBoxW - wtW) / 2,
        y: cursorY - 45,
        size: 7,
        font: fontOblique,
        color: rgb(0.6, 0.65, 0.7),
      });
    }

    // Bottom name bar
    const botName = sb.stamp?.userName || sb.defaultName;
    const botSafe = botName.length > 16 ? botName.slice(0, 15) + '.' : botName;
    const bnW = fontRegular.widthOfTextAtSize(botSafe, 6.5);
    page.drawText(botSafe, {
      x: boxX + (sigBoxW - bnW) / 2,
      y: cursorY - sigBoxH + 6,
      size: 6.5,
      font: fontRegular,
      color: colorDark,
    });
  }

  // 10. FOOTER WATERMARK & SECURITY HASH
  const footerY = margin + 12;
  page.drawLine({
    start: { x: margin, y: footerY + 12 },
    end: { x: width - margin, y: footerY + 12 },
    thickness: 0.5,
    color: colorBorder,
  });

  const footerText = 'Dihasilkan secara otomatis oleh Sistem Formulir Keuangan & Operasional CLX | Verified Internal Document';
  page.drawText(footerText, {
    x: margin,
    y: footerY,
    size: 6.5,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6),
  });

  const pageText = 'Halaman 1 dari 1 (Formulir Utama)';
  const ptW = fontRegular.widthOfTextAtSize(pageText, 6.5);
  page.drawText(pageText, {
    x: width - margin - ptW,
    y: footerY,
    size: 6.5,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6),
  });

  return pdfDoc;
}

/**
 * Merge the official form PDF with all uploaded attachment files (PDF, JPG, PNG)
 * into a single unified PDF document.
 */
export async function generateMergedPdf(doc: FormDocument): Promise<Uint8Array> {
  // Step 1: Generate the primary official form page
  const mainPdfDoc = await generateOfficialFormPdf(doc);

  // Step 2: Loop through attachments and append them
  if (doc.attachments && doc.attachments.length > 0) {
    for (let i = 0; i < doc.attachments.length; i++) {
      const att = doc.attachments[i];
      try {
        if (att.type === 'application/pdf' && att.dataUrl) {
          // Convert base64 data url to Uint8Array
          const base64Data = att.dataUrl.split(',')[1] || att.dataUrl;
          const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const attachmentPdf = await PDFDocument.load(pdfBytes);
          const copiedPages = await mainPdfDoc.copyPages(
            attachmentPdf,
            attachmentPdf.getPageIndices()
          );
          for (const cp of copiedPages) {
            mainPdfDoc.addPage(cp);
          }
        } else if ((att.type.startsWith('image/') || att.dataUrl.startsWith('data:image/')) && att.dataUrl) {
          // Embed image onto a new page with official header
          const base64Data = att.dataUrl.split(',')[1];
          const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          let embeddedImage;
          if (att.type.includes('png') || att.dataUrl.startsWith('data:image/png')) {
            embeddedImage = await mainPdfDoc.embedPng(imgBytes);
          } else {
            embeddedImage = await mainPdfDoc.embedJpg(imgBytes);
          }

          const page = mainPdfDoc.addPage([595.28, 841.89]);
          const { width, height } = page.getSize();
          const fontBold = await mainPdfDoc.embedFont(StandardFonts.HelveticaBold);
          const fontReg = await mainPdfDoc.embedFont(StandardFonts.Helvetica);

          // Top Header for Attachment Page
          page.drawRectangle({
            x: 36,
            y: height - 50,
            width: width - 72,
            height: 24,
            color: rgb(0.08, 0.18, 0.36),
          });

          const title = `LAMPIRAN BUKTI #${i + 1}: ${att.name.toUpperCase()}`;
          page.drawText(title.slice(0, 60), {
            x: 48,
            y: height - 42,
            size: 9,
            font: fontBold,
            color: rgb(1, 1, 1),
          });

          page.drawText(`Lampiran untuk dokumen: ${doc.docNumber}`, {
            x: 36,
            y: height - 65,
            size: 8,
            font: fontReg,
            color: rgb(0.4, 0.45, 0.5),
          });

          // Scale image to fit within printable bounds
          const maxWidth = width - 72;
          const maxHeight = height - 120;
          const imgDims = embeddedImage.scaleToFit(maxWidth, maxHeight);

          page.drawImage(embeddedImage, {
            x: 36 + (maxWidth - imgDims.width) / 2,
            y: height - 85 - imgDims.height,
            width: imgDims.width,
            height: imgDims.height,
          });
        }
      } catch (err) {
        console.error(`Failed to merge attachment ${att.name}:`, err);
      }
    }
  }

  return await mainPdfDoc.save();
}

/**
 * Trigger client-side browser download for PDF bytes
 */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Open PDF in an iframe or new browser tab for preview/print
 */
export function openPdfBlobUrl(bytes: Uint8Array): string {
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}
