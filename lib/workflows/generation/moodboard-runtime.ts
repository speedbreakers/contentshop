import { signDownloadToken } from '@/lib/uploads/signing';

export type MoodboardSnapshotV2 = {
  id: number;
  name: string;
  style_profile?: Record<string, unknown>;
  asset_file_ids?: number[];
  background_asset_file_ids?: number[];
  model_asset_file_ids?: number[];
  reference_positive_file_ids?: number[];
  reference_negative_file_ids?: number[];
  reference_positive_summary?: string;
  reference_negative_summary?: string;
  strength?: 'strict' | 'inspired';
};

export type RuntimeMoodboardV2 = {
  id: number;
  name: string;
  styleProfile: Record<string, unknown>;
  assetFileIds: number[];
  backgroundAssetFileIds: number[];
  modelAssetFileIds: number[];
  positiveAssetFileIds: number[];
  negativeAssetFileIds: number[];
  // Backward-compat: some call sites treat this as positive refs.
  assetUrls: string[];
  positiveAssetUrls: string[];
  negativeAssetUrls: string[];
  positiveSummary: string;
  negativeSummary: string;
  strength: 'strict' | 'inspired';
  styleAppendix: string;
};

function uniqNums(xs: unknown): number[] {
  if (!Array.isArray(xs)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of xs) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    const nn = Math.floor(n);
    if (nn <= 0) continue;
    if (seen.has(nn)) continue;
    seen.add(nn);
    out.push(nn);
  }
  return out;
}

function signedUploadUrl(args: { teamId: number; uploadedFileId: number; exp: number }) {
  const sig = signDownloadToken(
    { fileId: args.uploadedFileId, teamId: args.teamId, exp: args.exp } as any
  );
  return `/api/uploads/${args.uploadedFileId}/file?teamId=${args.teamId}&exp=${args.exp}&sig=${sig}`;
}

/**
 * Rehydrate moodboard asset URLs at execution time from persisted file ids.
 * This avoids relying on expiring signed URLs stored in job metadata.
 */
export function rehydrateMoodboardFromSnapshot(args: {
  teamId: number;
  snapshot: MoodboardSnapshotV2;
  styleAppendix: string;
  strength: 'strict' | 'inspired';
  /** Number of URLs to keep per section (defensive cap). */
  maxPerKind?: number;
  /** Signed URL TTL in ms. */
  expMs?: number;
}): RuntimeMoodboardV2 {
  const maxPerKind = Math.max(0, Math.min(10, Math.floor(args.maxPerKind ?? 3)));
  const exp = Date.now() + Math.max(5 * 60 * 1000, Math.floor(args.expMs ?? 60 * 60 * 1000));

  const backgroundAssetFileIds = uniqNums(args.snapshot.background_asset_file_ids).slice(0, maxPerKind);
  const modelAssetFileIds = uniqNums(args.snapshot.model_asset_file_ids).slice(0, maxPerKind);
  const positiveAssetFileIds = uniqNums(args.snapshot.reference_positive_file_ids).slice(0, maxPerKind);
  const negativeAssetFileIds = uniqNums(args.snapshot.reference_negative_file_ids).slice(0, maxPerKind);

  const assetFileIds = uniqNums(args.snapshot.asset_file_ids).length
    ? uniqNums(args.snapshot.asset_file_ids)
    : uniqNums([
        ...backgroundAssetFileIds,
        ...modelAssetFileIds,
        ...positiveAssetFileIds,
        ...negativeAssetFileIds,
      ]);

  const positiveAssetUrls = positiveAssetFileIds.map((fid) =>
    signedUploadUrl({ teamId: args.teamId, uploadedFileId: fid, exp })
  );
  const negativeAssetUrls = negativeAssetFileIds.map((fid) =>
    signedUploadUrl({ teamId: args.teamId, uploadedFileId: fid, exp })
  );
  const backgroundAssetUrls = backgroundAssetFileIds.map((fid) =>
    signedUploadUrl({ teamId: args.teamId, uploadedFileId: fid, exp })
  );
  const modelAssetUrls = modelAssetFileIds.map((fid) =>
    signedUploadUrl({ teamId: args.teamId, uploadedFileId: fid, exp })
  );

  // NOTE: runtime object includes kind-separated file ids + urls.
  // Callers can decide how to apply strict vs inspired.
  return {
    id: Number(args.snapshot.id),
    name: String(args.snapshot.name ?? ''),
    styleProfile: (args.snapshot.style_profile ?? {}) as Record<string, unknown>,
    assetFileIds,
    backgroundAssetFileIds,
    modelAssetFileIds,
    positiveAssetFileIds,
    negativeAssetFileIds,
    assetUrls: positiveAssetUrls, // backward-compat: positive refs
    positiveAssetUrls,
    negativeAssetUrls,
    positiveSummary: String(args.snapshot.reference_positive_summary ?? ''),
    negativeSummary: String(args.snapshot.reference_negative_summary ?? ''),
    strength: args.strength,
    styleAppendix: args.styleAppendix,
    // Extra: expose urls to callers via type widening (common pattern in this repo)
    ...(backgroundAssetUrls.length ? { backgroundAssetUrls } : {}),
    ...(modelAssetUrls.length ? { modelAssetUrls } : {}),
  } as any;
}


