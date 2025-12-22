import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, PenTool, Store, Upload, Sparkles, Send } from 'lucide-react';

export default async function HomePage() {
  const user = await getUser();

  if (user) {
    redirect('/dashboard/products');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center px-4 md:px-6">
          <div className="mr-4 flex">
            <Link className="mr-6 flex items-center space-x-2 font-bold" href="/">
              <span className="hidden font-bold sm:inline-block">Content Shop</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link
                href="/sign-in"
                className="text-foreground/60 transition-colors hover:text-foreground/80"
              >
                Sign In
              </Link>
              <Link href="/sign-up">
                <Button>Get Started</Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
          <div className="container mx-auto flex max-w-[64rem] flex-col items-center gap-4 text-center px-4">
            <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              Create Professional Product Content in Seconds
            </h1>
            <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
              Turn a single photo into a complete marketing kit. AI-generated photography and copywriting, synced directly to Shopify.
            </p>
            <div className="space-x-4">
              <Link href="/sign-up">
                <Button size="lg" className="h-11 px-8">
                  Start Generating Free
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto space-y-6 bg-slate-50 py-8 dark:bg-transparent md:py-12 lg:py-24 px-4 rounded-xl">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
            <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl font-bold">
              Features
            </h2>
            <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
              Everything you need to launch products faster and cheaper.
            </p>
          </div>
          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
            <Card>
              <CardHeader>
                <Camera className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>AI Photography</CardTitle>
                <CardDescription>
                  Generate lifestyle shots and studio settings from one generic image.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <PenTool className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>Smart Copywriting</CardTitle>
                <CardDescription>
                  Instantly create SEO-friendly descriptions and marketing copy.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Store className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>Shopify Sync</CardTitle>
                <CardDescription>
                  Push your new assets directly to your store with one click.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="container mx-auto py-8 md:py-12 lg:py-24 px-4">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center mb-10">
            <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl font-bold">
              How It Works
            </h2>
          </div>
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">1. Upload Image</h3>
              <p className="text-muted-foreground">
                Start with a single generic photo of your product.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">2. Generate Assets</h3>
              <p className="text-muted-foreground">
                Let AI create stunning variations and persuasive copy.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Send className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">3. Publish</h3>
              <p className="text-muted-foreground">
                Sync directly to Shopify or download for any platform.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 md:py-0">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built for e-commerce brands. © {new Date().getFullYear()} Content Shop.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/terms-and-conditions" className="hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

