const { S3Client, PutObjectCommand, GetObjectCommand} = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner"); // ✅ REQUIRED

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

async function uploadPdfToS3(buffer, certId) {
  const key = `certificates/${certId}-${crypto.randomBytes(6).toString("hex")}.pdf`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    })
  );

  return {
    key,
    url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
  };
} 

async function getSignedPdfUrl(key, expiresInSeconds = 300) {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3, command, {
    expiresIn: expiresInSeconds,
  });
}


module.exports = { uploadPdfToS3,
      getSignedPdfUrl, 
 };
