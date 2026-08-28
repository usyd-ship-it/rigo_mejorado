import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET;

export async function subirEvidencia({ objectKey, buffer, mimeType }) {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType,
    })
  );
}

// URL firmada de solo lectura, expira corto — nunca URLs públicas
// permanentes (spec §3.6).
export async function urlFirmada(objectKey, expiresInSeconds = 900) {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: objectKey }), {
    expiresIn: expiresInSeconds,
  });
}
