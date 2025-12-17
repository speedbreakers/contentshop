'use client';

import { Coins, ImageIcon, FileTextIcon, Loader2, CreditCard } from 'lucide-react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

type CreditBalanceData = {
  hasSubscription: boolean;
  planTier: string | null;
  imageCredits: { used: number; included: number; remaining: number };
  textCredits: { used: number; included: number; remaining: number };
  overage: { imageUsed: number; textUsed: number };
  imagePercentUsed: number;
  textPercentUsed: number;
  daysRemaining: number;
};

const CREDITS_KEY = '/api/team/credits';

/**
 * Call this function to refresh the credit balance after a generation
 */
export function refreshCredits() {
  mutate(CREDITS_KEY);
}

function ProgressBar({ percent, isLow }: { percent: number; isLow: boolean }) {
  return (
    <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full transition-all duration-300 ${
          isLow ? 'bg-amber-500' : 'bg-emerald-500'
        }`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

export function CreditBalance() {
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === 'collapsed' && !isMobile;

  const { data, isLoading } = useSWR<CreditBalanceData>(CREDITS_KEY, {
    revalidateOnFocus: true,
    refreshInterval: 0, // Don't auto-refresh, we'll trigger manually
  });

  const imageIsLow = (data?.imagePercentUsed ?? 0) >= 80;
  const textIsLow = (data?.textPercentUsed ?? 0) >= 80;

  const details = !data ? null : (
    <div className="space-y-3">
      {/* Image Credits */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Images</span>
          </div>
          <span
            className={`font-medium ${
              imageIsLow ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {data.imageCredits.remaining}/{data.imageCredits.included}
          </span>
        </div>
        <ProgressBar percent={100 - data.imagePercentUsed} isLow={imageIsLow} />
      </div>

      {/* Text Credits */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <FileTextIcon className="h-3.5 w-3.5" />
            <span>Text</span>
          </div>
          <span
            className={`font-medium ${
              textIsLow ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {data.textCredits.remaining}/{data.textCredits.included}
          </span>
        </div>
        <ProgressBar percent={100 - data.textPercentUsed} isLow={textIsLow} />
      </div>

      {/* Renewal info */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Resets in {data.daysRemaining} day{data.daysRemaining !== 1 ? 's' : ''}
      </div>

      {/* Overage indicator */}
      {(data.overage.imageUsed > 0 || data.overage.textUsed > 0) && (
        <div className="text-xs text-amber-600 dark:text-amber-500">
          Overage: {data.overage.imageUsed} images, {data.overage.textUsed} text
        </div>
      )}
    </div>
  );

  if (isCollapsed) {
    // Collapsed sidebar: show a single icon button with a rich tooltip.
    if (isLoading) {
      return (
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Loading credits">
              <Link href="/dashboard/usage">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Credits</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      );
    }

    if (!data || !data.hasSubscription) {
      return (
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Subscribe to generate">
              <Link href="/pricing">
                <CreditCard className="h-4 w-4" />
                <span>Subscribe</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      );
    }

    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            tooltip={{
              side: 'right',
              align: 'center',
              sideOffset: 8,
              className:
                'bg-popover text-popover-foreground border shadow-md rounded-lg p-3 w-72',
              children: details,
            }}
          >
            <Link href="/dashboard/usage">
              <Coins className="h-4 w-4" />
              <span>Credits</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!data || !data.hasSubscription) {
    return (
      <div className="px-3 py-2">
        <Link
          href="/pricing"
          className="block text-center py-2 px-3 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
        >
          Subscribe to generate
        </Link>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-3">
      {details}
    </div>
  );
}

