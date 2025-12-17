'use client';

import useSWR from 'swr';
import { ImageIcon, FileTextIcon, TrendingUp, Calendar, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatPrice } from '@/lib/payments/plans';

type CreditBalance = {
  hasSubscription: boolean;
  planTier: string | null;
  imageCredits: { used: number; included: number; remaining: number };
  textCredits: { used: number; included: number; remaining: number };
  overage: { imageUsed: number; textUsed: number };
  overageCostCents?: number;
  periodEnd: string | null;
  daysRemaining: number;
};

type UsageRecord = {
  id: number;
  usageType: 'image' | 'text';
  creditsUsed: number;
  isOverage: boolean;
  referenceType: string | null;
  referenceId: number | null;
  createdAt: string;
};

type UsageStats = {
  imageUsed: number;
  textUsed: number;
  imageOverage: number;
  textOverage: number;
  totalRecords: number;
};

function ProgressRing({ percent, size = 120, strokeWidth = 12, isOverage }: { 
  percent: number; 
  size?: number; 
  strokeWidth?: number;
  isOverage?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(100, percent) / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        className="text-gray-200 dark:text-gray-700"
        strokeWidth={strokeWidth}
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        className={isOverage ? 'text-amber-500' : percent >= 80 ? 'text-amber-500' : 'text-emerald-500'}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
    </svg>
  );
}

export default function UsagePage() {
  const {
    data: balance,
    isLoading: balanceLoading,
    error: balanceError,
  } = useSWR<CreditBalance>('/api/team/credits');

  const {
    data: usage,
    isLoading: usageLoading,
    error: usageError,
  } = useSWR<{ records: UsageRecord[]; stats: UsageStats }>('/api/team/usage?limit=20');

  const loading = balanceLoading || usageLoading;
  const records = usage?.records ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (balanceError || usageError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Failed to load usage
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Please refresh the page. If the issue persists, contact support.
        </p>
      </div>
    );
  }

  if (!balance?.hasSubscription) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          No Active Subscription
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Subscribe to a plan to start tracking your usage.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
        >
          View Plans
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const imagePercent = balance.imageCredits.included > 0
    ? Math.round((balance.imageCredits.used / balance.imageCredits.included) * 100)
    : 0;
  const textPercent = balance.textCredits.included > 0
    ? Math.round((balance.textCredits.used / balance.textCredits.included) * 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Usage Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Track your credit usage and generation history
        </p>
      </div>

      {/* Credit Overview Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Image Credits Card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <ImageIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Image Credits
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <ProgressRing 
              percent={imagePercent} 
              isOverage={balance.overage.imageUsed > 0}
            />
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {balance.imageCredits.remaining}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                of {balance.imageCredits.included} remaining
              </div>
              {balance.overage.imageUsed > 0 && (
                <div className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  +{balance.overage.imageUsed} overage
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Text Credits Card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <FileTextIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Text Credits
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <ProgressRing 
              percent={textPercent}
              isOverage={balance.overage.textUsed > 0}
            />
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {balance.textCredits.remaining}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                of {balance.textCredits.included} remaining
              </div>
              {balance.overage.textUsed > 0 && (
                <div className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  +{balance.overage.textUsed} overage
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Billing Period Card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <Calendar className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Billing Period
              </h3>
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {balance.daysRemaining}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              days until credits reset
            </div>
            {balance.overageCostCents && balance.overageCostCents > 0 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  Overage charges this period
                </div>
                <div className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                  {formatPrice(balance.overageCostCents)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan Info */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 rounded-xl border border-orange-200 dark:border-orange-800 p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
              <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Current Plan: {balance.planTier?.charAt(0).toUpperCase()}{balance.planTier?.slice(1)}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Need more credits? Upgrade to get a higher allocation and lower overage rates.
              </p>
            </div>
          </div>
          <Link
            href="/pricing"
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
          >
            Upgrade Plan
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Recent Activity
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {records.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              No usage records yet. Start generating content to see your activity here.
            </div>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  {record.usageType === 'image' ? (
                    <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <ImageIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  ) : (
                    <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg">
                      <FileTextIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {record.usageType === 'image' ? 'Image generation' : 'Text generation'}
                      {record.isOverage && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full">
                          Overage
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(record.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {record.creditsUsed} credit{record.creditsUsed !== 1 ? 's' : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

