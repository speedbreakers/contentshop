'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';

type CreditStatus = {
  hasSubscription: boolean;
  imageCredits: { remaining: number; included: number };
  textCredits: { remaining: number; included: number };
  imagePercentUsed: number;
  textPercentUsed: number;
};

export function LowCreditBanner() {
  const [data, setData] = useState<CreditStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch('/api/team/credits');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to fetch credits:', err);
      }
    }
    fetchCredits();
  }, []);

  if (dismissed || !data || !data.hasSubscription) {
    return null;
  }

  // Show warning when either credit type is >= 80% used
  const showImageWarning = data.imagePercentUsed >= 80;
  const showTextWarning = data.textPercentUsed >= 80;

  if (!showImageWarning && !showTextWarning) {
    return null;
  }

  const isExhausted = 
    data.imageCredits.remaining === 0 || 
    data.textCredits.remaining === 0;

  return (
    <div className={`relative px-4 py-3 ${
      isExhausted 
        ? 'bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800' 
        : 'bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800'
    }`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${
            isExhausted ? 'text-red-500' : 'text-amber-500'
          }`} />
          <div className="text-sm">
            <span className={`font-medium ${
              isExhausted 
                ? 'text-red-800 dark:text-red-200' 
                : 'text-amber-800 dark:text-amber-200'
            }`}>
              {isExhausted ? 'Credits exhausted!' : 'Credits running low'}
            </span>
            <span className={`ml-2 ${
              isExhausted 
                ? 'text-red-600 dark:text-red-300' 
                : 'text-amber-600 dark:text-amber-300'
            }`}>
              {showImageWarning && `${data.imageCredits.remaining} images`}
              {showImageWarning && showTextWarning && ', '}
              {showTextWarning && `${data.textCredits.remaining} text`}
              {' '}remaining
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link
            href="/pricing"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isExhausted
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            Upgrade
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className={`p-1.5 rounded-lg transition-colors ${
              isExhausted
                ? 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900'
                : 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

