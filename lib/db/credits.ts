import { db } from './drizzle';
import { teamCredits, usageRecords, teams } from './schema';
import { eq, and, lte, gte, desc, sql } from 'drizzle-orm';
import type { TeamCredits, NewTeamCredits, UsageRecord, NewUsageRecord } from './schema';

/**
 * Get the current active credit period for a team
 */
export async function getCurrentTeamCredits(teamId: number): Promise<TeamCredits | null> {
  const now = new Date();
  
  const result = await db
    .select()
    .from(teamCredits)
    .where(
      and(
        eq(teamCredits.teamId, teamId),
        lte(teamCredits.periodStart, now),
        gte(teamCredits.periodEnd, now)
      )
    )
    .orderBy(desc(teamCredits.periodStart))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get credit period by ID
 */
export async function getTeamCreditsById(id: number): Promise<TeamCredits | null> {
  const result = await db
    .select()
    .from(teamCredits)
    .where(eq(teamCredits.id, id))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Create a new credit allocation for a team
 */
export async function createTeamCredits(data: NewTeamCredits): Promise<TeamCredits> {
  const result = await db
    .insert(teamCredits)
    .values(data)
    .returning();

  return result[0];
}

/**
 * Update credit usage counters
 */
export async function incrementCreditUsage(
  creditsId: number,
  usageType: 'image' | 'text',
  count: number,
  isOverage: boolean
): Promise<void> {
  if (isOverage) {
    if (usageType === 'image') {
      await db
        .update(teamCredits)
        .set({
          imageOverageUsed: sql`${teamCredits.imageOverageUsed} + ${count}`,
          updatedAt: new Date(),
        })
        .where(eq(teamCredits.id, creditsId));
    } else {
      await db
        .update(teamCredits)
        .set({
          textOverageUsed: sql`${teamCredits.textOverageUsed} + ${count}`,
          updatedAt: new Date(),
        })
        .where(eq(teamCredits.id, creditsId));
    }
  } else {
    if (usageType === 'image') {
      await db
        .update(teamCredits)
        .set({
          imageCreditsUsed: sql`${teamCredits.imageCreditsUsed} + ${count}`,
          updatedAt: new Date(),
        })
        .where(eq(teamCredits.id, creditsId));
    } else {
      await db
        .update(teamCredits)
        .set({
          textCreditsUsed: sql`${teamCredits.textCreditsUsed} + ${count}`,
          updatedAt: new Date(),
        })
        .where(eq(teamCredits.id, creditsId));
    }
  }
}

/**
 * Create a usage record for audit trail
 */
export async function createUsageRecord(data: NewUsageRecord): Promise<UsageRecord> {
  const result = await db
    .insert(usageRecords)
    .values(data)
    .returning();

  return result[0];
}

/**
 * Get usage records for a team with pagination
 */
export async function getTeamUsageRecords(
  teamId: number,
  options: {
    limit?: number;
    offset?: number;
    usageType?: 'image' | 'text';
  } = {}
): Promise<UsageRecord[]> {
  const { limit = 50, offset = 0, usageType } = options;

  let query = db
    .select()
    .from(usageRecords)
    .where(
      usageType
        ? and(eq(usageRecords.teamId, teamId), eq(usageRecords.usageType, usageType))
        : eq(usageRecords.teamId, teamId)
    )
    .orderBy(desc(usageRecords.createdAt))
    .limit(limit)
    .offset(offset);

  return query;
}

/**
 * Get usage statistics for a credit period
 */
export async function getUsageStats(teamCreditsId: number): Promise<{
  imageUsed: number;
  textUsed: number;
  imageOverage: number;
  textOverage: number;
  totalRecords: number;
}> {
  const credits = await getTeamCreditsById(teamCreditsId);
  
  if (!credits) {
    return {
      imageUsed: 0,
      textUsed: 0,
      imageOverage: 0,
      textOverage: 0,
      totalRecords: 0,
    };
  }

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(usageRecords)
    .where(eq(usageRecords.teamCreditsId, teamCreditsId));

  return {
    imageUsed: credits.imageCreditsUsed,
    textUsed: credits.textCreditsUsed,
    imageOverage: credits.imageOverageUsed,
    textOverage: credits.textOverageUsed,
    totalRecords: Number(countResult[0]?.count ?? 0),
  };
}

/**
 * Get team's plan tier
 */
export async function getTeamPlanTier(teamId: number): Promise<string | null> {
  const result = await db
    .select({ planTier: teams.planTier })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  return result[0]?.planTier ?? null;
}

/**
 * Update team's plan tier
 */
export async function updateTeamPlanTier(
  teamId: number,
  planTier: string
): Promise<void> {
  await db
    .update(teams)
    .set({
      planTier,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

/**
 * Get team's overage settings
 */
export async function getTeamOverageSettings(teamId: number): Promise<{
  overageEnabled: boolean;
  overageLimitCents: number | null;
}> {
  const result = await db
    .select({
      overageEnabled: teams.overageEnabled,
      overageLimitCents: teams.overageLimitCents,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  return {
    overageEnabled: result[0]?.overageEnabled ?? true,
    overageLimitCents: result[0]?.overageLimitCents ?? null,
  };
}

/**
 * Update Stripe meter IDs for a team
 */
export async function updateTeamMeterIds(
  teamId: number,
  imageMeterId: string,
  textMeterId: string
): Promise<void> {
  await db
    .update(teams)
    .set({
      stripeImageMeterId: imageMeterId,
      stripeTextMeterId: textMeterId,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

/**
 * Get credit history for a team
 */
export async function getTeamCreditHistory(
  teamId: number,
  limit: number = 12
): Promise<TeamCredits[]> {
  return db
    .select()
    .from(teamCredits)
    .where(eq(teamCredits.teamId, teamId))
    .orderBy(desc(teamCredits.periodStart))
    .limit(limit);
}

