const { PDFDocument, rgb } = require("pdf-lib");
const fs = require("fs");

module.exports.generateTranscript = async ({
  student,
  marksheets,
  qrText,
}) => {
  const pdfDoc = await PDFDocument.create();

  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  // HEADER
  page.drawText("OFFICIAL ACADEMIC TRANSCRIPT", {
    x: 80,
    y: height - 80,
    size: 18,
    color: rgb(0, 0, 0),
  });

  page.drawText(`Name: ${student.name}`, { x: 80, y: height - 130 });
  page.drawText(`Roll No: ${student.rollNumber}`, { x: 80, y: height - 160 });
  page.drawText(`Course: ${student.course}`, { x: 80, y: height - 190 });

  let y = height - 240;

  marksheets.forEach((m) => {
    page.drawText(
      `Semester ${m.semester} (${m.year}) - Verified`,
      { x: 80, y }
    );
    y -= 30;
  });

  // FOOTER
  page.drawText("Generated via EduChain", {
    x: 80,
    y: 80,
    size: 10,
    color: rgb(0.4, 0.4, 0.4),
  });

  return await pdfDoc.save();
};
