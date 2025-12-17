import { z } from 'zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { productVariants, uploadedFiles, variantImages } from '@/lib/db/schema';
import { signDownloadToken, signVariantImageToken } from '@/lib/uploads/signing';

export const runtime = 'nodejs';

const bodySchema = z.object({
  variantIds: z.array(z.number().int().positive()).min(1).max(100),
});

export async function POST(request: Request) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const variantIds = Array.from(new Set(parsed.data.variantIds));

  const variants = await db.query.productVariants.findMany({
    where: and(
      eq(productVariants.teamId, team.id),
      inArray(productVariants.id, variantIds),
      isNull(productVariants.deletedAt)
    ),
    columns: {
      id: true,
      productId: true,
      title: true,
      imageUrl: true,
    },
  });

  // Latest N generated images per variant (bounded).
  const maxImagesPerVariant = 50;
  const rawImages = await db
    .select({
      id: variantImages.id,
      variantId: variantImages.variantId,
      createdAt: variantImages.createdAt,
    })
    .from(variantImages)
    .where(and(eq(variantImages.teamId, team.id), inArray(variantImages.variantId, variantIds)))
    .orderBy(desc(variantImages.createdAt))
    .limit(Math.min(variantIds.length * maxImagesPerVariant, 5000));

  const exp = Date.now() + 1000 * 60 * 60; // 1 hour

  const imagesByVariantId = new Map<number, Array<{ id: number; url: string; createdAt: string }>>();
  for (const img of rawImages) {
    const arr = imagesByVariantId.get(img.variantId) ?? [];
    if (arr.length >= maxImagesPerVariant) continue;
    const sig = signVariantImageToken({ imageId: img.id, teamId: team.id, exp });
    arr.push({
      id: img.id,
      url: `/api/variant-images/${img.id}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`,
      createdAt: img.createdAt instanceof Date ? img.createdAt.toISOString() : String(img.createdAt),
    });
    imagesByVariantId.set(img.variantId, arr);
  }

  // Latest uploads (bounded).
  const maxUploads = 200;
  const uploads = await db
    .select({
      id: uploadedFiles.id,
      originalName: uploadedFiles.originalName,
      createdAt: uploadedFiles.createdAt,
    })
    .from(uploadedFiles)
    .where(eq(uploadedFiles.teamId, team.id))
    .orderBy(desc(uploadedFiles.createdAt))
    .limit(maxUploads);

  const mappedUploads = uploads.map((f) => {
    const sig = signDownloadToken({ fileId: f.id, teamId: team.id, exp } as any);
    return {
      id: f.id,
      url: `/api/uploads/${f.id}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`,
      originalName: f.originalName ?? null,
      createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
    };
  });

  const mappedVariants = variants.map((v) => ({
    variantId: v.id,
    productId: v.productId,
    variantTitle: v.title,
    variantImageUrl: v.imageUrl ?? null,
    generatedImages: imagesByVariantId.get(v.id) ?? [],
  }));

  return Response.json({
    variants: mappedVariants,
    uploads: mappedUploads,
  });
}


