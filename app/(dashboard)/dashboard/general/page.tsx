'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Moon, Sun, Monitor } from 'lucide-react';
import { updateAccount } from '@/app/(login)/actions';
import { User } from '@/lib/db/schema';
import useSWR from 'swr';
import { Suspense, useEffect, useState } from 'react';
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTheme } from 'next-themes';

type ActionState = {
  name?: string;
  error?: string;
  success?: string;
};

type AccountFormProps = {
  state: ActionState;
  nameValue?: string;
  emailValue?: string;
};

function AccountForm({
  state,
  nameValue = '',
  emailValue = ''
}: AccountFormProps) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="name">Name</FieldLabel>
        <Input
          id="name"
          name="name"
          placeholder="Enter your name"
          defaultValue={state.name || nameValue}
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="Enter your email"
          defaultValue={emailValue}
          required
        />
      </Field>
    </FieldGroup>
  );
}

function AccountFormWithData({ state }: { state: ActionState }) {
  const { data: user } = useSWR<User>('/api/user');
  return (
    <AccountForm
      state={state}
      nameValue={user?.name ?? ''}
      emailValue={user?.email ?? ''}
    />
  );
}

export default function GeneralPage() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateAccount,
    {}
  );
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">
        General Settings
      </h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" action={formAction}>
              <Suspense fallback={<AccountForm state={state} />}>
                <AccountFormWithData state={state} />
              </Suspense>
              {state.error && (
                <p className="text-red-500 text-sm">{state.error}</p>
              )}
              {state.success && (
                <p className="text-green-500 text-sm">{state.success}</p>
              )}
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white mt-4"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Theme</FieldLabel>
                <FieldDescription>
                  Choose how the app looks to you.
                </FieldDescription>
                {mounted ? (
                  <RadioGroup
                    value={theme}
                    onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
                    className="mt-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="light" id="theme-light" />
                      <label
                        htmlFor="theme-light"
                        className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                      >
                        <Sun className="h-4 w-4" />
                        Light
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="dark" id="theme-dark" />
                      <label
                        htmlFor="theme-dark"
                        className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                      >
                        <Moon className="h-4 w-4" />
                        Dark
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="system" id="theme-system" />
                      <label
                        htmlFor="theme-system"
                        className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                      >
                        <Monitor className="h-4 w-4" />
                        System
                      </label>
                    </div>
                  </RadioGroup>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  </div>
                )}
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
