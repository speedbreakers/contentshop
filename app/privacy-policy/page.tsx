import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl font-bold tracking-tight mb-8">Privacy Policy</h1>
        
        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, such as when you create an account, update your profile, or use our content generation features. This may include your name, email address, payment information, and uploaded images.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Information</h2>
            <p>
              We use the information we collect to operate, maintain, and provide the features of Content Shop. We also use the information to communicate with you, such as to send you email messages, including updates, security alerts, and support messages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Data Security</h2>
            <p>
              We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Third-Party Services</h2>
            <p>
              We may share information with third-party vendors, consultants, and other service providers who need access to such information to carry out work on our behalf, such as payment processing (Stripe) and AI generation (Google Vertex AI).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Your Choices</h2>
            <p>
              You may update, correct, or delete information about you at any time by logging into your online account. If you wish to delete or deactivate your account, please contact us, but note that we may retain certain information as required by law or for legitimate business purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at [email protected].
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

