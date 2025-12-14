'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { useTheme } from 'next-themes';
import { Box, LogOut, Moon, Settings, Shield, Sun, Activity, Users, Store } from 'lucide-react';

import type { User } from '@/lib/db/schema';
import { signOut } from '@/app/(login)/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function ThemeMenu() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Sun className="h-[1.1rem] w-[1.1rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.1rem] w-[1.1rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setTheme('light')}>Light</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('dark')}>Dark</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('system')}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserFooter() {
  const router = useRouter();
  const { open, setOpenMobile } = useSidebar();
  const { data: user } = useSWR<User>('/api/user', fetcher);

  async function handleSignOut() {
    await signOut();
    mutate('/api/user');
    setOpenMobile(false);
    router.push('/');
  }

  const email = user?.email ?? '';
  const initials =
    email
      ? email
          .split(' ')
          .map((n) => n[0])
          .join('')
      : 'U';

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="size-9">
          <AvatarImage alt={user?.name || ''} />
          <AvatarFallback className='bg-primary text-primary-foreground'>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-sm font-medium leading-none truncate">
            {user?.name ? user.name : 'Account'}
          </div>
          <div className="text-xs text-muted-foreground truncate">{email || '—'}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* <ThemeMenu /> */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleSignOut}
          title="Sign out"
          disabled={!user}
          className={cn(!open && 'hidden')}
        >
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Sign out</span>
        </Button>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  const isProducts = pathname.startsWith('/dashboard/products');
  const isTeam = pathname === '/dashboard';
  const isGeneral = pathname.startsWith('/dashboard/general');
  const isActivity = pathname.startsWith('/dashboard/activity');
  const isSecurity = pathname.startsWith('/dashboard/security');

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="ContentShop">
              <Link href="/dashboard/products">
                <Store />
                <span>Content Shop</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <hr />

      <SidebarContent className='mt-2'>
        <SidebarGroup>
          <SidebarGroupLabel>Products</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isProducts} tooltip="Products">
                  <Link href="/dashboard/products">
                    <Box />
                    <span>Products</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <hr />

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isTeam} tooltip="Team">
                  <Link href="/dashboard">
                    <Users />
                    <span>Team</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isGeneral} tooltip="General">
                  <Link href="/dashboard/general">
                    <Settings />
                    <span>General</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActivity} tooltip="Activity">
                  <Link href="/dashboard/activity">
                    <Activity />
                    <span>Activity</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isSecurity} tooltip="Security">
                  <Link href="/dashboard/security">
                    <Shield />
                    <span>Security</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserFooter />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}


