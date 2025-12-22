import React from 'react';
import Link from 'next/link';
import { PLANS, TRIAL_PERIOD_DAYS, formatPrice } from '@/lib/payments/plans';
import { Check, Sparkles, ImageIcon, FileTextIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PublicPricingPage() {
  const plans = Object.entries(PLANS).map(([tier, plan]) => ({
    id: tier,
    ...plan,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center px-4 md:px-6">
          <Link className="flex items-center space-x-2 font-bold" href="/">
            <span>Content Shop</span>
          </Link>
          <div className="flex flex-1 items-center justify-end space-x-4">
             <Link
                href="/sign-in"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign In
              </Link>
              <Link href="/sign-up">
                <Button size="sm">Get Started</Button>
              </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your content needs. All plans include a {TRIAL_PERIOD_DAYS}-day free trial.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-8 bg-card border shadow-sm ${
                  'recommended' in plan && plan.recommended
                    ? 'border-orange-500 ring-1 ring-orange-500 shadow-orange-100 dark:shadow-none'
                    : ''
                }`}
              >
                {'recommended' in plan && plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium bg-orange-500 text-white rounded-full">
                      <Sparkles className="h-3.5 w-3.5" />
                      Recommended
                    </span>
                  </div>
                )}

                <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                <p className="text-muted-foreground mb-4">
                   {TRIAL_PERIOD_DAYS}-day free trial
                </p>

                <p className="mb-6">
                  <span className="text-4xl font-bold">
                    ${plan.priceMonthly / 100}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </p>

                <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                      <span>Image generations</span>
                    </div>
                    <span className="font-semibold">
                      {plan.imageCredits}/mo
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileTextIcon className="h-4 w-4" />
                      <span>Text generations</span>
                    </div>
                    <span className="font-semibold">
                      {plan.textCredits}/mo
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link href="/sign-up" className="block">
                  <Button className="w-full" variant={'recommended' in plan && plan.recommended ? 'default' : 'outline'}>
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-6 md:py-0">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built for e-commerce brands. © {new Date().getFullYear()} Content Shop.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
             <Link href="/terms-and-conditions" className="hover:underline">
              Terms
            </Link>
            <Link href="/privacy-policy" className="hover:underline">
              Privacy
            </Link>
             <Link href="/refund-policy" className="hover:underline">
              Refunds
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

