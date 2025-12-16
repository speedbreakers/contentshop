import { put } from '@vercel/blob';
import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { createUploadedFile, listUploadedFiles, type UploadKind } from '@/lib/db/uploads';

const kindSchema = z.enum(['garment', 'product', 'model', 'background', 'moodboard']);

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'upload';
}

export async function GET(request: Request) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const kindRaw = url.searchParams.get('kind');
  const kind = kindRaw ? (kindSchema.safeParse(kindRaw).success ? (kindRaw as UploadKind) : null) : null;
  if (kindRaw && !kind) return Response.json({ error: 'Invalid kind' }, { status: 400 });

  const items = await listUploadedFiles(team.id, kind ?? undefined);

  // Return signed URLs via our proxy endpoint (client doesn't need blobUrl).
  const exp = Date.now() + 1000 * 60 * 60; // 1 hour
  const { signDownloadToken } = await import('@/lib/uploads/signing');
  const mapped = items.map((f) => {
    const sig = signDownloadToken({ fileId: f.id, teamId: team.id, exp } as any);
    return {
      id: f.id,
      kind: f.kind,
      originalName: f.originalName,
      contentType: f.contentType,
      size: f.size,
      createdAt: f.createdAt,
      url: `/api/uploads/${f.id}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`,
    };
  });

  return Response.json({ items: mapped });
}

export async function POST(request: Request) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: 'Invalid form data' }, { status: 400 });

  const kindRaw = form.get('kind');
  const kindParsed = kindSchema.safeParse(kindRaw);
  if (!kindParsed.success) return Response.json({ error: 'Invalid kind' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'file is required' }, { status: 400 });
  }

  // Vercel Blob SDK in this repo version enforces access="public" (see Vercel docs).
  // We still provide "private signed URLs" by returning app-signed proxy URLs that gate access.
  const filename = sanitizeFilename(file.name);
  const id = crypto.randomUUID();
  const pathname = `team-${team.id}/${kindParsed.data}/${Date.now()}-${id}-${filename}`;

  const result = await put(pathname, file, {
    access: 'public',
    contentType: file.type || undefined,
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  } as any);

  const created = await createUploadedFile(team.id, {
    kind: kindParsed.data,
    pathname: result.pathname,
    blobUrl: result.url,
    originalName: file.name,
    contentType: file.type || null,
    size: file.size ?? null,
  });

  if (!created) return Response.json({ error: 'Failed to persist upload record' }, { status: 500 });

  const exp = Date.now() + 1000 * 60 * 60; // 1 hour
  const { signDownloadToken } = await import('@/lib/uploads/signing');
  const sig = signDownloadToken({ fileId: created.id, teamId: team.id, exp } as any);

  return Response.json(
    {
      file: {
        id: created.id,
        kind: created.kind,
        originalName: created.originalName,
        contentType: created.contentType,
        size: created.size,
        createdAt: created.createdAt,
        url: `/api/uploads/${created.id}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`,
      },
    },
    { status: 201 }
  );
}


