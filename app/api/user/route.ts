import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import {
  products,
  productVariants,
  productOptions,
  variantOptionValues,
  variantGenerations,
  variantImages,
  sets,
  setItems,
  setEvents,
  productDescriptions,
  commerceAccounts,
  externalProducts,
  externalVariants,
  productLinks,
  variantLinks,
  assetPublications,
  commerceJobs,
  batches,
  generationJobs,
  moodboards,
  moodboardAssets,
  teams,
  teamMembers,
} from '@/lib/db/schema';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json(null);
  }

  // Ensure the role the UI sees matches the team membership role.
  // (Users.role can drift; membership is the source of truth for permissions.)
  const membership = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
  });

  return Response.json({
    ...user,
    role: membership?.role ?? user.role,
  });
}

export async function DELETE(request: Request) {
  // Check admin API key for admin endpoints
  const authHeader = request.headers.get('authorization');
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    return Response.json({ error: 'Admin API key not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${adminApiKey}`) {
    return Response.json({ error: 'Invalid admin API key' }, { status: 401 });
  }

  // Get user ID from query parameter
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get('userId');

  if (!userIdParam) {
    return Response.json({ error: 'userId query parameter is required' }, { status: 400 });
  }

  const userId = parseInt(userIdParam, 10);
  if (isNaN(userId)) {
    return Response.json({ error: 'Invalid userId parameter' }, { status: 400 });
  }

  // Get team for the specified user
  const teamResult = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, userId),
    with: {
      team: true,
    },
  });

  if (!teamResult?.team) {
    return Response.json({ error: 'Team not found for user' }, { status: 404 });
  }

  const team = teamResult.team;

  try {
    // Delete in order to avoid foreign key constraint violations
    // Start with leaf nodes and work up the dependency tree

    const teamId = team.id;

    // 1. Delete set events and items (depend on sets)
    await db.delete(setEvents).where(eq(setEvents.teamId, teamId));
    await db.delete(setItems).where(eq(setItems.teamId, teamId));

    // 2. Delete generation jobs (depend on batches, so must delete before batches)
    await db.delete(generationJobs).where(eq(generationJobs.teamId, teamId));

    // 3. Delete batches (reference sets via folderId, so must delete before sets)
    await db.delete(batches).where(eq(batches.teamId, teamId));

    // 4. Delete sets (depend on products/variants and are referenced by batches)
    await db.delete(sets).where(eq(sets.teamId, teamId));

    // 3. Delete variant images (depend on variants and generations)
    await db.delete(variantImages).where(eq(variantImages.teamId, teamId));

    // 4. Delete variant generations (depend on variants)
    await db.delete(variantGenerations).where(eq(variantGenerations.teamId, teamId));

    // 5. Delete commerce-related data that depend on variants/products (must delete before variants/products)
    await db.delete(variantLinks).where(eq(variantLinks.teamId, teamId));
    await db.delete(productLinks).where(eq(productLinks.teamId, teamId));
    await db.delete(assetPublications).where(eq(assetPublications.teamId, teamId));

    // 6. Delete variant option values (depend on variants and product options)
    // Since variantOptionValues doesn't have teamId, we need to find them via variants
    const variantIds = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.teamId, teamId));
    if (variantIds.length > 0) {
      await db.delete(variantOptionValues).where(
        and(inArray(variantOptionValues.variantId, variantIds.map(v => v.id)))
      );
    }

    // 7. Delete product options (depend on products)
    await db.delete(productOptions).where(eq(productOptions.teamId, teamId));

    // 8. Delete product descriptions (depend on products)
    await db.delete(productDescriptions).where(eq(productDescriptions.teamId, teamId));

    // 9. Delete product variants (depend on products)
    await db.delete(productVariants).where(eq(productVariants.teamId, teamId));

    // 10. Delete products
    await db.delete(products).where(eq(products.teamId, teamId));

    // 11. Delete remaining commerce-related data (depend on commerce accounts)
    await db.delete(commerceJobs).where(eq(commerceJobs.teamId, teamId));
    await db.delete(externalVariants).where(eq(externalVariants.teamId, teamId));
    await db.delete(externalProducts).where(eq(externalProducts.teamId, teamId));

    // 12. Delete commerce accounts (storefronts)
    await db.delete(commerceAccounts).where(eq(commerceAccounts.teamId, teamId));

    // 13. Delete moodboard assets (depend on moodboards)
    await db.delete(moodboardAssets).where(eq(moodboardAssets.teamId, teamId));

    // 14. Delete moodboards
    await db.delete(moodboards).where(eq(moodboards.teamId, teamId));

    return Response.json({
      success: true,
      message: 'All team data has been cleared successfully'
    });

  } catch (error) {
    console.error('Error clearing user data:', error);
    return Response.json(
      { error: 'Failed to clear user data' },
      { status: 500 }
    );
  }
}
