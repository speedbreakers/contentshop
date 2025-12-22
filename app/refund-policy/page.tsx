import React from 'react';
import Link from 'next/link';

export default function RefundPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center px-4 md:px-6">
          <Link className="flex items-center space-x-2 font-bold" href="/">
            <span>Content Shop</span>
          </Link>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 md:px-6 md:py-12 max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Refund Policy</h1>
        
        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Subscription Refunds</h2>
            <p>
              We offer a 7-day money-back guarantee on all initial subscription purchases. If you are not satisfied with our service, you may request a full refund within 7 days of your initial purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Recurring Charges</h2>
            <p>
              Refunds for recurring subscription renewals are handled on a case-by-case basis. Generally, we do not offer refunds for partial months of service, but we may make exceptions for extenuating circumstances.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Credit Purchases</h2>
            <p>
              One-time purchases of extra credits are non-refundable once the credits have been used or after 7 days from the date of purchase, whichever comes first.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Cancellation</h2>
            <p>
              You can cancel your subscription at any time through your account dashboard. Upon cancellation, your access to premium features will continue until the end of your current billing period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. How to Request a Refund</h2>
            <p>
              To request a refund, please contact our support team at [email protected] with your account details and the reason for your request. We will review your request and process it within 5-7 business days.
            </p>
          </section>
          
          <p className="text-sm pt-4">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </main>
      
      <footer className="border-t py-6 md:py-0">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built for e-commerce brands. © {new Date().getFullYear()} Content Shop.
          </p>
        </div>
      </footer>
    </div>
  );
}

