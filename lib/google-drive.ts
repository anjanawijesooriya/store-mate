import { Readable } from "stream";
import zlib from "zlib";

export function isDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

// Lazy-loaded — googleapis (~50 MB) is only imported when a backup actually runs,
// not on every cold start of unrelated routes.
async function getDriveClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("Google Drive credentials not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)");
  }
  const { google } = await import("googleapis");
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrCreateSubfolder(drive: any, parentId: string, name: string): Promise<string> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
  });
  if (res.data.files?.length > 0) return res.data.files[0].id as string;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });
  return created.data.id as string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteOldFiles(drive: any, folderId: string, keepCount: number): Promise<void> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    orderBy: "createdTime desc",
    fields: "files(id, name)",
    pageSize: 100,
  });
  const files: { id: string }[] = res.data.files ?? [];
  for (const file of files.slice(keepCount)) {
    await drive.files.delete({ fileId: file.id }).catch(() => {});
  }
}

const KEEP: Record<string, number> = { daily: 7, weekly: 4, manual: 5 };

export async function uploadToDrive(
  fileName: string,
  jsonContent: string,
  subfolder: "daily" | "weekly" | "manual",
): Promise<{ fileId: string; driveUrl: string; compressedSize: number }> {
  const drive = await getDriveClient();
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

  const subFolderId = await getOrCreateSubfolder(drive, rootFolderId, subfolder);

  // Gzip compress async
  const compressed = await new Promise<Buffer>((resolve, reject) => {
    zlib.gzip(Buffer.from(jsonContent, "utf8"), (err, buf) => {
      if (err) reject(err); else resolve(buf);
    });
  });

  const gzFileName = `${fileName}.gz`;

  const res = await drive.files.create({
    requestBody: {
      name: gzFileName,
      parents: [subFolderId],
    },
    media: {
      mimeType: "application/gzip",
      body: Readable.from(compressed),
    },
    fields: "id, webViewLink",
  });

  const fileId = res.data.id as string;
  const driveUrl = (res.data.webViewLink as string) ?? `https://drive.google.com/file/d/${fileId}/view`;

  await deleteOldFiles(drive, subFolderId, KEEP[subfolder] ?? 5);

  return { fileId, driveUrl, compressedSize: compressed.length };
}
