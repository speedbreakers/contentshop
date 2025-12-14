import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './drizzle';
import { setEvents, setItems, sets } from './schema';

export async function ensureDefaultSet(teamId: number, input: {
  variantId: number;
  productId?: number | null;
  createdByUserId?: number | null;
}) {
  const existing = await db.query.sets.findFirst({
    where: and(
      eq(sets.teamId, teamId),
      eq(sets.variantId, input.variantId),
      eq(sets.isDefault, true),
      isNull(sets.deletedAt)
    ),
  });

  if (existing) return existing;

  const [created] = await db
    .insert(sets)
    .values({
      teamId,
      scopeType: 'variant',
      productId: input.productId ?? null,
      variantId: input.variantId,
      isDefault: true,
      name: 'Default',
      description: 'All generations (auto-created)',
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();

  if (!created) return null;

  await db.insert(setEvents).values({
    teamId,
    setId: created.id,
    actorUserId: input.createdByUserId ?? null,
    type: 'created',
    metadata: { name: created.name, isDefault: true },
  });

  return created;
}

export async function listSets(teamId: number, variantId: number, opts?: { productId?: number | null }) {
  // Backfill: ensure default set exists for this variant.
  await ensureDefaultSet(teamId, { variantId, productId: opts?.productId ?? null, createdByUserId: null });

  return await db
    .select()
    .from(sets)
    .where(and(eq(sets.teamId, teamId), eq(sets.variantId, variantId), isNull(sets.deletedAt)))
    .orderBy(desc(sets.isDefault), desc(sets.updatedAt));
}

export async function createSet(teamId: number, input: {
  scopeType?: string;
  productId?: number | null;
  variantId?: number | null;
  name: string;
  description?: string | null;
  createdByUserId?: number | null;
}) {
  const [created] = await db
    .insert(sets)
    .values({
      teamId,
      scopeType: input.scopeType ?? 'variant',
      productId: input.productId ?? null,
      variantId: input.variantId ?? null,
      isDefault: false,
      name: input.name,
      description: input.description ?? null,
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();
  return created ?? null;
}

export async function renameSet(teamId: number, setId: number, name: string) {
  const [updated] = await db
    .update(sets)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(sets.teamId, teamId), eq(sets.id, setId), isNull(sets.deletedAt)))
    .returning();
  return updated ?? null;
}

export async function deleteSet(teamId: number, setId: number) {
  const existing = await db.query.sets.findFirst({
    where: and(eq(sets.teamId, teamId), eq(sets.id, setId), isNull(sets.deletedAt)),
    columns: { id: true, isDefault: true },
  });

  if (!existing) return { ok: false as const, reason: 'not_found' as const };
  if (existing.isDefault) return { ok: false as const, reason: 'is_default' as const };

  const [updated] = await db
    .update(sets)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sets.teamId, teamId), eq(sets.id, setId), isNull(sets.deletedAt)))
    .returning();
  return updated ? ({ ok: true as const, set: updated } as const) : ({ ok: false as const, reason: 'not_found' as const } as const);
}

export async function listSetItems(teamId: number, setId: number) {
  return await db
    .select()
    .from(setItems)
    .where(and(eq(setItems.teamId, teamId), eq(setItems.setId, setId)))
    .orderBy(desc(setItems.createdAt));
}

export async function addSetItem(teamId: number, input: {
  setId: number;
  itemType: string;
  itemId: number;
  sortOrder?: number;
  addedByUserId?: number | null;
}) {
  const [created] = await db
    .insert(setItems)
    .values({
      teamId,
      setId: input.setId,
      itemType: input.itemType,
      itemId: input.itemId,
      sortOrder: input.sortOrder ?? 0,
      addedByUserId: input.addedByUserId ?? null,
    })
    .returning();
  return created ?? null;
}

export async function removeSetItem(
  teamId: number,
  setId: number,
  itemType: string,
  itemId: number
) {
  const [deleted] = await db
    .delete(setItems)
    .where(
      and(
        eq(setItems.teamId, teamId),
        eq(setItems.setId, setId),
        eq(setItems.itemType, itemType),
        eq(setItems.itemId, itemId)
      )
    )
    .returning();
  return deleted ?? null;
}

export async function appendSetEvent(teamId: number, input: {
  setId: number;
  actorUserId?: number | null;
  type: string;
  metadata?: any;
}) {
  const [created] = await db
    .insert(setEvents)
    .values({
      teamId,
      setId: input.setId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      metadata: input.metadata ?? null,
    })
    .returning();
  return created ?? null;
}


