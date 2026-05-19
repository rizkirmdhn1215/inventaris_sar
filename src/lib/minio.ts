import { Client } from "minio";

// Normalize endpoint: minio SDK needs a hostname, not a URL.
// Accept "https://host", "http://host", "host:port", or "host".
function parseEndpoint(raw: string | undefined) {
  if (!raw) return { host: "localhost", inferredSSL: false, inferredPort: null as number | null };
  let s = raw.trim();
  let inferredSSL = false;
  let inferredPort: number | null = null;

  if (s.startsWith("https://")) {
    inferredSSL = true;
    s = s.slice("https://".length);
  } else if (s.startsWith("http://")) {
    inferredSSL = false;
    s = s.slice("http://".length);
  }
  // strip path & trailing slash
  s = s.split("/")[0];

  // split host:port if present
  const colonIdx = s.indexOf(":");
  if (colonIdx !== -1) {
    inferredPort = Number(s.slice(colonIdx + 1));
    s = s.slice(0, colonIdx);
  }

  return { host: s || "localhost", inferredSSL, inferredPort };
}

const { host, inferredSSL, inferredPort } = parseEndpoint(process.env.MINIO_ENDPOINT);

// Allow either the explicit MINIO_USE_SSL or infer from the URL scheme above.
const useSSL =
  process.env.MINIO_USE_SSL != null
    ? process.env.MINIO_USE_SSL === "true"
    : inferredSSL;

// Pick port: explicit MINIO_PORT > URL port > sensible default (443 / 80 / 9000).
const explicitPort = process.env.MINIO_PORT ? Number(process.env.MINIO_PORT) : null;
const port =
  explicitPort && !Number.isNaN(explicitPort)
    ? explicitPort
    : inferredPort && !Number.isNaN(inferredPort)
      ? inferredPort
      : useSSL
        ? 443
        : 9000;

// Accept both naming conventions:
// - MINIO_ACCESS_KEY / MINIO_SECRET_KEY (S3-style)
// - MINIO_ROOT_USER / MINIO_ROOT_PASSWORD (MinIO server root creds)
const accessKey = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER;
const secretKey = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD;

// Bucket env helpers (accept multiple aliases).
export const MINIO_BUCKETS = {
  qrs: process.env.MINIO_BUCKET_QRS || "item-qrs",
  docs:
    process.env.MINIO_BUCKET_DOCS ||
    process.env.MINIO_BUCKET_DOCUMENTS ||
    "loan-documents",
  photos: process.env.MINIO_BUCKET_PHOTOS || "condition-photos",
  avatars: process.env.MINIO_BUCKET_AVATARS || "admin-avatars",
};

export const minioClient = new Client({
  endPoint: host,
  port,
  useSSL,
  accessKey: accessKey || "",
  secretKey: secretKey || "",
});

function assertMinioEnv() {
  if (!process.env.MINIO_ENDPOINT || !accessKey || !secretKey) {
    throw new Error(
      "MinIO env belum lengkap. Isi MINIO_ENDPOINT, MINIO_ACCESS_KEY (atau MINIO_ROOT_USER), dan MINIO_SECRET_KEY (atau MINIO_ROOT_PASSWORD)."
    );
  }
}

export async function ensureBucket(bucketName: string) {
  assertMinioEnv();
  const exists = await minioClient.bucketExists(bucketName);
  if (!exists) {
    await minioClient.makeBucket(bucketName, "us-east-1");
  }
}

export async function uploadBufferToMinio(args: {
  bucketName: string;
  objectName: string;
  buffer: Buffer;
  contentType: string;
}) {
  assertMinioEnv();
  await ensureBucket(args.bucketName);

  await minioClient.putObject(
    args.bucketName,
    args.objectName,
    args.buffer,
    args.buffer.length,
    { "Content-Type": args.contentType }
  );

  // Public URL builder:
  // - If SSL + standard port (443), drop the port.
  // - If non-SSL + standard port (80), drop the port.
  const portPart =
    (useSSL && port === 443) || (!useSSL && port === 80) ? "" : `:${port}`;

  return {
    bucketName: args.bucketName,
    objectName: args.objectName,
    publicUrl: `${useSSL ? "https" : "http"}://${host}${portPart}/${args.bucketName}/${args.objectName}`,
  };
}
