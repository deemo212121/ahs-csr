'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BookOpenText,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Megaphone,
  Menu,
  X,
  RefreshCw,
  Settings,
  ShieldAlert,
  Tags,
  TriangleAlert,
  Users,
  UserRoundCog,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/requests', label: 'Requests', icon: ClipboardList },
  { href: '/admin/cities', label: 'Cities', icon: Building2 },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/staff', label: 'Staff Management', icon: UserRoundCog },
  { href: '/admin/branch-assignments', label: 'Branch Assignment', icon: MapPinned },
  { href: '/admin/appliances', label: 'Appliances', icon: Wrench },
  { href: '/admin/brands', label: 'Brands', icon: Tags },
  { href: '/admin/activity-logs', label: 'Activity Logs', icon: BookOpenText },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/mistake', label: 'Mistake', icon: ShieldAlert },
  { href: '/admin/warning', label: 'Warning', icon: TriangleAlert },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'System Admin';
  const notificationKey = useMemo(() => {
    if (!profile?.id) return null;
    return `admin-notifications-read-${profile.id}`;
  }, [profile?.id]);

  useEffect(() => {
    if (!notificationKey) {
      setNotificationCount(0);
      return;
    }

    const wasRead = window.localStorage.getItem(notificationKey) === 'true';
    setNotificationCount(wasRead ? 0 : 5);
  }, [notificationKey]);

  function handleNotificationsClick() {
    setNotificationsOpen((value) => !value);
    setAccountOpen(false);
    setNotificationCount(0);
    if (notificationKey) {
      window.localStorage.setItem(notificationKey, 'true');
    }
  }

  const adminNotifications = [
    {
      title: 'Live ER tickets',
      body: 'Review the latest service requests from the ER tickets table.',
      href: '/admin/requests',
    },
    {
      title: 'Verification queue',
      body: 'Check customer-submitted tickets waiting for approval.',
      href: '/admin/requests',
    },
    {
      title: 'Activity logs',
      body: 'View recent ER ticket audit activity and status changes.',
      href: '/admin/activity-logs',
    },
    {
      title: 'Warnings and mistakes',
      body: 'Review recent discipline records for agents and teams.',
      href: '/admin/warning',
    },
    {
      title: 'Coverage records',
      body: 'Open ER-based city and ZIP coverage records.',
      href: '/admin/cities',
    },
  ];

  const initials = useMemo(() => {
    const parts = displayName.split(' ').filter(Boolean);
    return `${parts[0]?.[0] ?? 'S'}${parts[1]?.[0] ?? parts[0]?.[1] ?? 'A'}`.toUpperCase();
  }, [displayName]);

  return (
    <div className={`admin-shell admin-portal ${menuOpen ? 'menu-open' : ''}`}>
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <button
            aria-label="Toggle admin navigation"
            className="admin-icon-btn"
            onClick={() => setMenuOpen((value) => !value)}
            type="button"
          >
            <Menu size={18} />
          </button>
          <Link className="admin-brand" href="/admin/dashboard">
            <img alt="US In Home Services" src="/ushs_logo.png" />
            <div>
              <strong>US In Home Services</strong>
              <span>Admin Console</span>
            </div>
          </Link>
          <b className="admin-title">{title}</b>
        </div>
        <div className="admin-topbar-actions">
          <ThemeToggle />
          <button
            aria-label="Refresh page"
            className="admin-icon-btn ghost"
            onClick={() => window.location.reload()}
            type="button"
          >
            <RefreshCw size={16} />
          </button>
          <div className="admin-popover-anchor">
            <button
              aria-label="Notifications"
              className="admin-icon-btn ghost"
              onClick={handleNotificationsClick}
              type="button"
            >
              <Bell size={16} />
              {notificationCount > 0 ? <span className="agent-dot admin-dot">{notificationCount}</span> : null}
            </button>
            {notificationsOpen ? (
              <div className="admin-notification-panel">
                <div className="agent-popover-head">
                  <strong>Notifications</strong>
                  <span>Admin view</span>
                </div>
                {adminNotifications.map((notification) => (
                  <Link
                    className="admin-notification-item"
                    href={notification.href}
                    key={notification.title}
                    onClick={() => setNotificationsOpen(false)}
                  >
                    <span><Bell size={14} /></span>
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.body}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="admin-account-wrap">
            <button
              aria-expanded={accountOpen}
              className="admin-user-chip"
              onClick={() => {
                setAccountOpen((value) => !value);
                setNotificationsOpen(false);
              }}
              type="button"
            >
              <span>{initials}</span>
              <div>
                <strong>{displayName}</strong>
                <small>Administrator</small>
              </div>
            </button>
            {accountOpen ? (
              <div className="admin-account-menu">
                <Link href="/admin/settings" onClick={() => setAccountOpen(false)}>
                  <Settings size={15} />
                  Settings
                </Link>
                <button onClick={logout} type="button">
                  <LogOut size={15} />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <button
        aria-label="Close navigation"
        className="admin-backdrop"
        onClick={() => setMenuOpen(false)}
        type="button"
      />

      <aside className="admin-sidebar">
        <div className="admin-sidebar-head compact">
          <button aria-label="Close admin navigation" className="admin-sidebar-close" onClick={() => setMenuOpen(false)} type="button">
            <X size={16} />
          </button>
        </div>
        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={active ? 'active' : ''}
                href={item.href}
                key={item.href}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main">
        <div className="admin-page">{children}</div>
      </main>
    </div>
  );
}
