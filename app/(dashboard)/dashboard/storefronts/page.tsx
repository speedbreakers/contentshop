'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import {
  Store,
  Plus,
  MoreHorizontal,
  Check,
  X,
  Pencil,
  Trash2,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertCircle,
  Package,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CommerceAccount {
  id: number;
  provider: string;
  displayName: string;
  status: string;
  shopDomain: string | null;
  scopes: string | null;
  installedAt: string | null;
  appUninstalledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SyncJob {
  id: number;
  type: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'canceled';
  progress: { cursor?: string; processed?: number } | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function ProviderBadge({ provider }: { provider: string }) {
  switch (provider) {
    case 'shopify':
      return (
        <Badge variant="outline" className="gap-1">
          Shopify
        </Badge>
      );
    default:
      return <Badge variant="outline">{provider}</Badge>;
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'connected') {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
        <Check className="mr-1 h-2 w-2" />
        Connected
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <X className="mr-1 h-3 w-3" />
      Disconnected
    </Badge>
  );
}

function SyncStatusBadge({ status }: { status: SyncJob['status'] }) {
  switch (status) {
    case 'queued':
      return <Badge variant="outline">Queued</Badge>;
    case 'running':
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Syncing
        </Badge>
      );
    case 'success':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          <Check className="mr-1 h-3 w-3" />
          Complete
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive">
          <X className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function StorefrontsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, error, isLoading } = useSWR<{ accounts: CommerceAccount[] }>(
    '/api/commerce/accounts',
    fetcher
  );

  // State for dialogs
  const [connectOpen, setConnectOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [connectError, setConnectError] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<CommerceAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAccount, setDeleteAccount] = useState<CommerceAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Sync wizard state
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncAccount, setSyncAccount] = useState<CommerceAccount | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncJob, setSyncJob] = useState<SyncJob | null>(null);
  const [syncPolling, setSyncPolling] = useState(false);

  // Show success/error messages from OAuth callback
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const errorMsg = searchParams.get('error');

    if (connected) {
      setNotification({
        type: 'success',
        message: `Successfully connected ${connected}`,
      });
      // Clear URL params
      window.history.replaceState({}, '', '/dashboard/storefronts');
    } else if (errorMsg) {
      setNotification({ type: 'error', message: errorMsg });
      window.history.replaceState({}, '', '/dashboard/storefronts');
    }
  }, [searchParams]);

  const accounts = data?.accounts ?? [];

  // Poll sync job status
  const pollSyncStatus = useCallback(async (accountId: number) => {
    try {
      const res = await fetch(`/api/commerce/accounts/${accountId}/sync`);
      const data = await res.json();
      if (data.job) {
        setSyncJob(data.job);
        // Continue polling if still running
        if (data.job.status === 'queued' || data.job.status === 'running') {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (syncPolling && syncAccount) {
      const poll = async () => {
        const shouldContinue = await pollSyncStatus(syncAccount.id);
        if (shouldContinue) {
          timeoutId = setTimeout(poll, 2000);
        } else {
          setSyncPolling(false);
        }
      };
      poll();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [syncPolling, syncAccount, pollSyncStatus]);

  // Connect Shopify store
  function handleConnect() {
    setConnectError('');

    let domain = shopDomain.trim().toLowerCase();

    // Add .myshopify.com if not present
    if (!domain.includes('.myshopify.com')) {
      domain = `${domain}.myshopify.com`;
    }

    // Validate format
    const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    if (!pattern.test(domain)) {
      setConnectError('Please enter a valid Shopify store domain');
      return;
    }

    // Redirect to OAuth install
    window.location.href = `/api/integrations/shopify/install?shop=${encodeURIComponent(domain)}`;
  }

  // Edit account name
  async function handleEditSave() {
    if (!editAccount || !editName.trim()) return;

    setEditLoading(true);
    try {
      const res = await fetch(`/api/commerce/accounts/${editAccount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: editName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      mutate('/api/commerce/accounts');
      setEditOpen(false);
      setEditAccount(null);
    } catch (err) {
      console.error(err);
    } finally {
      setEditLoading(false);
    }
  }

  // Delete account
  async function handleDelete() {
    if (!deleteAccount) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/commerce/accounts/${deleteAccount.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      mutate('/api/commerce/accounts');
      setDeleteOpen(false);
      setDeleteAccount(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  }

  // Disconnect (but keep) account
  async function handleDisconnect(account: CommerceAccount) {
    try {
      const res = await fetch(
        `/api/commerce/accounts/${account.id}?action=disconnect`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to disconnect');
      }

      mutate('/api/commerce/accounts');
    } catch (err) {
      console.error(err);
    }
  }

  // Open sync wizard
  async function openSyncWizard(account: CommerceAccount) {
    setSyncAccount(account);
    setSyncJob(null);
    setSyncLoading(false);
    setSyncPolling(false);
    setSyncOpen(true);

    // Load current sync status
    try {
      const res = await fetch(`/api/commerce/accounts/${account.id}/sync`);
      const data = await res.json();
      if (data.job) {
        setSyncJob(data.job);
        if (data.job.status === 'queued' || data.job.status === 'running') {
          setSyncPolling(true);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  // Start sync
  async function handleStartSync() {
    if (!syncAccount) return;

    setSyncLoading(true);
    try {
      const res = await fetch(`/api/commerce/accounts/${syncAccount.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ create_canonical: false }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start sync');
      }

      setSyncJob(data.job);
      setSyncPolling(true);
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to start sync',
      });
    } finally {
      setSyncLoading(false);
    }
  }

  // View external catalog
  function handleViewCatalog() {
    if (syncAccount) {
      router.push(`/dashboard/storefronts/${syncAccount.id}/catalog`);
    }
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg lg:text-2xl font-medium">Storefronts</h1>
        <Button onClick={() => setConnectOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Connect Store
        </Button>
      </div>

      {notification && (
        <Alert
          className={`mb-6 ${
            notification.type === 'success'
              ? 'border-green-500 bg-green-50 dark:bg-green-950'
              : 'border-red-500 bg-red-50 dark:bg-red-950'
          }`}
        >
          {notification.type === 'success' ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription
            className={
              notification.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
            }
          >
            {notification.message}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Connected Stores</CardTitle>
          <CardDescription>
            Manage your connected commerce platforms. Connect Shopify stores to sync
            products and publish generated images.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load accounts
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12">
              <Store className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No stores connected</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect your Shopify store to get started with syncing products and
                publishing generated images.
              </p>
              <Button className="mt-4" onClick={() => setConnectOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Connect Your First Store
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`flex items-center justify-between py-4 ${
                    account.status === 'connected'
                      ? 'cursor-pointer rounded-md px-2 -mx-2 hover:bg-muted/50'
                      : ''
                  }`}
                  onClick={() => {
                    if (account.status !== 'connected') return;
                    router.push(`/dashboard/storefronts/${account.id}/catalog`);
                  }}
                  role={account.status === 'connected' ? 'button' : undefined}
                  tabIndex={account.status === 'connected' ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (account.status !== 'connected') return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/dashboard/storefronts/${account.id}/catalog`);
                    }
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.displayName}</span>
                        <ProviderBadge provider={account.provider} />
                        <StatusBadge status={account.status} />
                      </div>
                      {account.shopDomain && (
                        <a
                          href={`https://${account.shopDomain}/admin`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {account.shopDomain}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {account.status === 'connected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSyncWizard(account)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditAccount(account);
                            setEditName(account.displayName);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        {account.status === 'connected' && (
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/storefronts/${account.id}/catalog`)}
                          >
                            <Package className="mr-2 h-4 w-4" />
                            View Catalog
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {account.status === 'connected' && (
                          <DropdownMenuItem
                            className="text-orange-600"
                            onClick={() => handleDisconnect(account)}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Disconnect
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            setDeleteAccount(account);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect Store Dialog */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Shopify Store</DialogTitle>
            <DialogDescription>
              Enter your Shopify store domain to connect. You&apos;ll be redirected to
              Shopify to authorize the connection.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="shop-domain">Store Domain</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id="shop-domain"
                  placeholder="mystore"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConnect();
                  }}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  .myshopify.com
                </span>
              </div>
              {connectError && (
                <p className="text-sm text-red-500 mt-1">{connectError}</p>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnect}>
              <Store className="mr-2 h-4 w-4" />
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Wizard Dialog */}
      <Dialog
        open={syncOpen}
        onOpenChange={(open) => {
          setSyncOpen(open);
          if (!open) {
            setSyncLoading(false);
            setSyncPolling(false);
            setSyncJob(null);
            setSyncAccount(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sync Catalog</DialogTitle>
            <DialogDescription>
              Import products from {syncAccount?.displayName} into your external catalog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current sync status */}
            {syncJob && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sync Status</span>
                  <SyncStatusBadge status={syncJob.status} />
                </div>

                {syncJob.progress?.processed !== undefined && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Products processed</span>
                      <span>{syncJob.progress.processed}</span>
                    </div>
                    {(syncJob.status === 'queued' || syncJob.status === 'running') && (
                      <Progress value={undefined} className="h-2" />
                    )}
                  </div>
                )}

                {syncJob.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{syncJob.error}</AlertDescription>
                  </Alert>
                )}

                {syncJob.completedAt && (
                  <p className="text-xs text-muted-foreground">
                    Completed {new Date(syncJob.completedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* No sync yet */}
            {!syncJob && (
              <div className="text-center py-6">
                <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-sm font-medium">No sync yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start a sync to import products from your Shopify store.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {syncJob?.status === 'success' && (
              <Button variant="outline" onClick={handleViewCatalog} className="w-full sm:w-auto">
                <Package className="mr-2 h-4 w-4" />
                View Catalog
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            <Button
              onClick={handleStartSync}
              disabled={syncLoading || syncJob?.status === 'running' || syncJob?.status === 'queued'}
              className="w-full sm:w-auto"
            >
              {syncLoading || syncJob?.status === 'running' || syncJob?.status === 'queued' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {syncLoading
                    ? 'Starting...'
                    : syncJob?.status === 'running'
                      ? 'Syncing'
                      : 'Queued'}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {syncJob ? 'Sync Again' : 'Start Sync'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Name Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Store</DialogTitle>
            <DialogDescription>
              Change the display name for this store connection.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-name">Display Name</FieldLabel>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditSave();
                }}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Store Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the connection to{' '}
              <strong>{deleteAccount?.displayName}</strong>? This will remove all
              synced products and variant links for this store. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
