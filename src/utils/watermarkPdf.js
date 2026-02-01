const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb, degrees, StandardFonts } = require("pdf-lib");
const QRCode = require("qrcode");

module.exports = async function watermarkPdf({
  inputBuffer,   // ✅ BUFFER (REQUIRED)
  watermarkText,
  qrText,
}) {
  if (!inputBuffer) {
    throw new Error("inputBuffer is required");
  }

  // ===========================
  // LOAD PDF FROM BUFFER
  // ===========================
  const pdfDoc = await PDFDocument.load(inputBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  /* ===========================
     LOAD LOGO (LOCAL IS OK)
  =========================== */
  const logoPath = path.join(__dirname, "../assets/logo.png");
  const logoBytes = fs.readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoBytes);

  /* ===========================
     GENERATE QR
  =========================== */
  const qrDataUrl = await QRCode.toDataURL(qrText, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 300,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const qrImageBytes = Buffer.from(
    qrDataUrl.split(",")[1],
    "base64"
  );
  const qrImage = await pdfDoc.embedPng(qrImageBytes);

  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    const { width, height } = page.getSize();

    /* ===========================
       DIAGONAL WATERMARK
    =========================== */
    page.drawText(watermarkText, {
      x: width * 0.15,
      y: height * 0.55,
      size: 24,
      rotate: degrees(-30),
      font,
      color: rgb(0.75, 0.75, 0.75),
      opacity: 0.22,
      lineHeight: 28,
    });

    /* ===========================
       FOOTER WATERMARK
    =========================== */
    page.drawText(watermarkText, {
      x: 100,
      y: 28,
      size: 8,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity: 0.85,
      lineHeight: 11,
    });

    /* ===========================
       VERIFICATION CARD
    =========================== */
    const cardWidth = 140;
    const cardHeight = 190;
    const cardX = width - cardWidth - 30;
    const cardY = 30;

    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1,
      borderRadius: 12,
    });

    /* ===========================
       LOGO
    =========================== */
    const logoSize = 32;
    page.drawImage(logoImage, {
      x: cardX + cardWidth / 2 - logoSize / 2,
      y: cardY + cardHeight - logoSize - 12,
      width: logoSize,
      height: logoSize,
    });

    /* ===========================
       TEXT
    =========================== */
    page.drawText("Verify on EduChain", {
      x: cardX + 33,
      y: cardY + cardHeight - 58,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });

    page.drawText(new Date().toLocaleString(), {
      x: cardX + 33,
      y: cardY + cardHeight - 72,
      size: 7,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });

    /* ===========================
       QR
    =========================== */
    const qrSize = 95;
    page.drawImage(qrImage, {
      x: cardX + cardWidth / 2 - qrSize / 2,
      y: cardY + 14,
      width: qrSize,
      height: qrSize,
    });
  });

  // ✅ RETURN BUFFER (FOR HASH + S3)
  return await pdfDoc.save();
};
