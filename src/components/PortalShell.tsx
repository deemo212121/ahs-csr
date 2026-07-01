"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Copy,
  Gauge,
  Home,
  Headphones,
  KeyRound,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Ticket,
  TrendingUp,
  UserCog,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationToastStack } from "@/components/NotificationToastStack";
import { NotificationSettings } from "@/components/NotificationSettings";
import { RealtimeStatus } from "@/components/RealtimeStatus";
import { useNotificationFeed } from "@/lib/notifications/useNotificationFeed";
import { useNotificationHistory } from "@/lib/notifications/useNotificationHistory";
import { useToastQueue } from "@/lib/notifications/useToastQueue";
import { playNotificationSound } from "@/lib/notifications/sounds";
import { dispatchLiveUpdate } from "@/lib/notifications/useLiveUpdate";
import { usePresenceHeartbeat } from "@/lib/presence/usePresenceHeartbeat";
import type { NotificationCategory } from "@/lib/notifications/settings";
import type { AppRole } from "@/lib/types";

type NavItem = { href: string; label: string; icon: React.ReactNode };

function navBasePath(href: string) {
  return href.split("?")[0];
}

const navByRole: Record<AppRole, NavItem[]> = {
  customer: [
    { href: "/customer/dashboard", label: "Home", icon: <Home size={18} /> },
    {
      href: "/customer/request",
      label: "Request",
      icon: <ClipboardPlus size={18} />,
    },
    {
      href: "/customer/requests",
      label: "My Requests",
      icon: <ClipboardList size={18} />,
    },
    {
      href: "/customer/messages",
      label: "Messages",
      icon: <MessageSquare size={18} />,
    },
    {
      href: "/customer/calls",
      label: "Call",
      icon: <Headphones size={18} />,
    },
    {
      href: "/customer/profile",
      label: "Profile",
      icon: <UserRound size={18} />,
    },
  ],
  csr: [
    { href: "/csr/dashboard", label: "Home", icon: <Gauge size={17} /> },
    {
      href: "/csr/request",
      label: "Request",
      icon: <ClipboardList size={17} />,
    },
    {
      href: "/csr/verification",
      label: "Verify",
      icon: <ShieldCheck size={17} />,
    },
    { href: "/csr/manual", label: "Manual", icon: <ClipboardPlus size={17} /> },
    { href: "/csr/messages", label: "Messages", icon: <MessageSquare size={17} /> },
    { href: "/csr/calls", label: "Calls", icon: <Headphones size={17} /> },
  ],
  team_leader: [
    {
      href: "/team-leader/dashboard",
      label: "Home",
      icon: <Gauge size={17} />,
    },
    {
      href: "/team-leader/requests",
      label: "Request",
      icon: <ClipboardList size={17} />,
    },
    {
      href: "/team-leader/verification",
      label: "Verify",
      icon: <ShieldCheck size={17} />,
    },
    {
      href: "/team-leader/manual",
      label: "Manual",
      icon: <ClipboardPlus size={17} />,
    },
    {
      href: "/team-leader/calls",
      label: "Calls",
      icon: <Headphones size={17} />,
    },
  ],
  csr_manager: [
    { href: "/manager/dashboard", label: "Home", icon: <Gauge size={17} /> },
    {
      href: "/manager/tickets",
      label: "Request",
      icon: <ClipboardList size={17} />,
    },
    {
      href: "/manager/verification",
      label: "Verify",
      icon: <ShieldCheck size={17} />,
    },
    {
      href: "/manager/manual",
      label: "Manual",
      icon: <ClipboardPlus size={17} />,
    },
    { href: "/manager/calls", label: "Calls", icon: <Headphones size={17} /> },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: <Gauge size={17} /> },
    { href: "/admin/requests", label: "Requests", icon: <Ticket size={17} /> },
    {
      href: "/admin/customers",
      label: "Customers",
      icon: <UserRound size={17} />,
    },
    {
      href: "/admin/activity-logs",
      label: "Logs",
      icon: <ClipboardList size={17} />,
    },
  ],
};

const managerDrawerLinks: NavItem[] = [
  {
    href: "/manager/dashboard?section=personal",
    label: "Personal Dashboard",
    icon: <Gauge size={18} />,
  },
  {
    href: "/manager/dashboard?section=team",
    label: "Team performance",
    icon: <TrendingUp size={18} />,
  },
  {
    href: "/manager/dashboard?section=management",
    label: "Team Management",
    icon: <Users size={18} />,
  },
  { href: "/manager/tickets", label: "Request", icon: <ClipboardList size={18} /> },
  {
    href: "/manager/verification?section=queue",
    label: "Verification queue",
    icon: <ShieldCheck size={18} />,
  },
  {
    href: "/manager/verification?section=related",
    label: "Related Tickets",
    icon: <Copy size={18} />,
  },
  {
    href: "/manager/verification?section=restore",
    label: "Restore Rejected Tickets",
    icon: <RotateCcw size={18} />,
  },
  {
    href: "/manager/manual",
    label: "Manual Ticket",
    icon: <ClipboardPlus size={18} />,
  },
  { href: "/manager/calls", label: "Calls", icon: <Headphones size={18} /> },
];

const teamLeaderDrawerLinks: NavItem[] = [
  {
    href: "/team-leader/dashboard",
    label: "Dashboard",
    icon: <Gauge size={18} />,
  },
  {
    href: "/team-leader/requests",
    label: "Team Requests",
    icon: <ClipboardList size={18} />,
  },
  {
    href: "/team-leader/verification",
    label: "Verification Queue",
    icon: <ShieldCheck size={18} />,
  },
  {
    href: "/team-leader/manual",
    label: "Manual Ticket",
    icon: <ClipboardPlus size={18} />,
  },
  {
    href: "/team-leader/technicians",
    label: "Technicians",
    icon: <Wrench size={18} />,
  },
  {
    href: "/team-leader/agents",
    label: "Team Agents",
    icon: <Users size={18} />,
  },
  {
    href: "/team-leader/calls",
    label: "Web Calls",
    icon: <Headphones size={18} />,
  },
  {
    href: "/team-leader/performance",
    label: "Team Performance",
    icon: <BarChart3 size={18} />,
  },
  {
    href: "/team-leader/mistake",
    label: "Mistake",
    icon: <AlertTriangle size={18} />,
  },
  {
    href: "/team-leader/warning",
    label: "Warning",
    icon: <AlertTriangle size={18} />,
  },
  {
    href: "/team-leader/messages",
    label: "Messages",
    icon: <MessageSquare size={18} />,
  },
  {
    href: "/team-leader/announcements",
    label: "Announcements",
    icon: <Megaphone size={18} />,
  },
  {
    href: "/team-leader/change-password",
    label: "Change Password",
    icon: <KeyRound size={18} />,
  },
];

const agentTitles: Record<string, { brand: string; subtitle: string }> = {
  csr: { brand: "CSR Dashboard", subtitle: "Latest: 6/18/26 - CSR Agent" },
  team_leader: {
    brand: "Team Leader Portal",
    subtitle: "Latest: 6/18/26 - Team Leader",
  },
  csr_manager: {
    brand: "CSR Dashboard",
    subtitle: "Latest: 6/18/26 - CSR Manager",
  },
};

function getRoleBase(role: AppRole | null) {
  if (role === "team_leader") return "/team-leader";
  if (role === "csr_manager") return "/manager";
  if (role === "csr") return "/csr";
  if (role === "admin") return "/admin";
  return "/customer";
}

export function PortalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { profile, role, logout, user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const nav = role ? navByRole[role] : [];
  const isCustomerPortal = role === "customer";

  usePresenceHeartbeat(user, isCustomerPortal);
  const isAgentPortal =
    role === "csr" || role === "team_leader" || role === "csr_manager";

  const base = useMemo(() => getRoleBase(role), [role]);

  const toastQueue = useToastQueue(3);
  const notifHistory = useNotificationHistory(base);

  // The branch/region filter lives on the user's profile (saved via
  // /api/me/preferences) so it's the same everywhere and on every device.
  const regionFilter = profile?.preferences?.filterRegions ?? [];

  function onArrival(category: NotificationCategory) {
    playNotificationSound(category);
    toastQueue.push(category);
    notifHistory.addRecord(category);
    dispatchLiveUpdate(category);
  }

  const verifyFeed = useNotificationFeed("verify", user, {
    enabled: isAgentPortal,
    onNewArrival: () => onArrival("verify"),
    onItemsProcessed: () => playNotificationSound("verify"),
    regionFilter,
  });
  const messagesFeed = useNotificationFeed("messages", user, {
    enabled: isAgentPortal,
    onNewArrival: () => onArrival("messages"),
  });
  const callsFeed = useNotificationFeed("calls", user, {
    enabled: isAgentPortal,
    onNewArrival: () => onArrival("calls"),
    regionFilter,
  });

  const liveNotificationCount = verifyFeed.count + messagesFeed.count + callsFeed.count;

  function badgeFor(href: string): number {
    if (href.includes("/verification")) return verifyFeed.count;
    if (href.includes("/messages")) return messagesFeed.count;
    if (href.includes("/calls")) return callsFeed.count;
    return 0;
  }

  function pulseFor(href: string): boolean {
    if (href.includes("/verification")) return verifyFeed.justArrived;
    if (href.includes("/messages")) return messagesFeed.justArrived;
    if (href.includes("/calls")) return callsFeed.justArrived;
    return false;
  }

  function markReadFor(href: string) {
    if (href.includes("/verification")) verifyFeed.markRead();
    if (href.includes("/messages")) messagesFeed.markRead();
    if (href.includes("/calls")) callsFeed.markRead();
  }

  function handleNotificationsClick() {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    setUserOpen(false);
    if (next) notifHistory.markAllRead();
  }
  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.email ||
    "Account";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AH";
  const agentTitle = role ? agentTitles[role] : null;
  const brandLabel =
    role === "customer"
      ? "US In Home Services"
      : role === "csr"
        ? "CSR Agent Portal"
        : role === "team_leader"
          ? "Team Leader Portal"
          : role === "csr_manager"
            ? "CSR Manager Portal"
            : "USHS Portal";
  const drawerLinks =
    role === "csr_manager"
      ? managerDrawerLinks
      : role === "team_leader"
        ? teamLeaderDrawerLinks
        : nav;

  const customerRoleLabel = "Customer";

  return (
    <div
      className={`portal ${isCustomerPortal ? "customer-portal" : ""} ${isAgentPortal ? "agent-portal" : ""}`}
    >
      {!isCustomerPortal ? (
        <aside className="sidebar" aria-label="Bottom navigation">
          <div className="sidebar-brand">
            <ClipboardCheck size={21} />
            <span>{brandLabel}</span>
          </div>
          <nav className="nav-list">
            {nav.map((item) => {
              const badge = badgeFor(item.href);
              const pulse = pulseFor(item.href);
              return (
                <Link
                  className={`nav-item ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "active" : ""}`}
                  href={item.href}
                  key={item.href}
                  onClick={() => markReadFor(item.href)}
                >
                  {item.icon}
                  {item.label}
                  {badge > 0 ? (
                    <span className={`nav-badge${pulse ? " nav-badge--pulse" : ""}`}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>
      ) : null}

      {isAgentPortal ? (
        <>
          <div
            className={`agent-drawer-backdrop ${drawerOpen ? "show" : ""}`}
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className={`agent-side-drawer ${drawerOpen ? "show" : ""}`}
            aria-label="Portal menu"
          >
            <div className="agent-side-head">
              <div className="agent-side-logo">
                <img alt="US In Home Services" src="/admin-hub-logo.png" />
                <div>
                  <strong>
                    {role === "csr_manager"
                      ? "CSR Manager"
                      : agentTitle?.brand || brandLabel}
                  </strong>
                  <span>{displayName}</span>
                </div>
              </div>
              <button
                className="agent-drawer-close"
                onClick={() => setDrawerOpen(false)}
                type="button"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="agent-side-nav">
              {drawerLinks.map((item) => {
                const badge = badgeFor(item.href);
                const pulse = pulseFor(item.href);
                const basePath = navBasePath(item.href);
                return (
                  <Link
                    className={
                      pathname === basePath ||
                      pathname.startsWith(`${basePath}/`)
                        ? "active"
                        : ""
                    }
                    href={item.href}
                    key={item.href}
                    onClick={() => { setDrawerOpen(false); markReadFor(item.href); }}
                  >
                    {item.icon}
                    {item.label}
                    {badge > 0 ? (
                      <span className={`nav-badge nav-badge--drawer${pulse ? " nav-badge--pulse" : ""}`}>
                        {badge > 9 ? "9+" : badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
              <button
                className="agent-side-logout"
                onClick={logout}
                type="button"
              >
                <LogOut size={18} />
                Logout
              </button>
            </nav>
          </aside>
        </>
      ) : null}

      <main className="main">
        {isCustomerPortal ? (
          <header className="customer-topbar">
            <div className="customer-topbar-left">
              <img alt="US In Home Services" src="/ushs_logo.png" />
              <div className="customer-brand-copy">
                <strong>US In Home Services</strong>
                <span>Customer Portal</span>
              </div>
              <b className="customer-page-title">{title}</b>
            </div>
            <div className="customer-topbar-actions">
              <div className="agent-popover-anchor">
                <button
                  aria-label="Notifications"
                  className="customer-icon-btn"
                  onClick={handleNotificationsClick}
                  type="button"
                >
                  <Bell size={16} />
                </button>
                {notificationsOpen ? (
                  <div className="customer-notification-menu">
                    <div className="agent-popover-head">
                      <strong>Notifications</strong>
                      <Link href="/customer/notifications">View all</Link>
                    </div>
                    {[
                      [
                        "Request received",
                        "Your newest service request is waiting for review.",
                      ],
                      [
                        "Support messages",
                        "Open Messages to continue a support conversation.",
                      ],
                      [
                        "Profile reminder",
                        "Keep your phone number and service address updated.",
                      ],
                    ].map(([heading, body]) => (
                      <div
                        className="customer-notification-menu-item"
                        key={`${heading}-${body}`}
                      >
                        <span>
                          <Bell size={14} />
                        </span>
                        <div>
                          <strong>{heading}</strong>
                          <p>{body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <Link
                aria-label="Messages"
                className="customer-icon-btn"
                href="/customer/messages"
              >
                <MessageSquare size={16} />
              </Link>
              <ThemeToggle />
              <div className="agent-popover-anchor">
                <button
                  className="customer-user-pill"
                  onClick={() => {
                    setUserOpen((value) => !value);
                    setNotificationsOpen(false);
                  }}
                  type="button"
                >
                  <span className="customer-avatar-mini">{initials}</span>
                  <span className="customer-user-copy">
                    <strong>{displayName}</strong>
                    <small>{customerRoleLabel}</small>
                  </span>
                  <ChevronDown size={16} />
                </button>
                {userOpen ? (
                  <div className="customer-user-menu">
                    <Link href="/customer/profile">
                      <UserRound size={16} /> Profile
                    </Link>
                    <Link href="/customer/requests">
                      <ClipboardList size={16} /> My Requests
                    </Link>
                    <button onClick={logout} type="button">
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
        ) : (
          <header className="topbar">
            {isAgentPortal ? (
              <div className="agent-header-left">
                <button
                  aria-label="Menu"
                  className="agent-icon-btn agent-menu-btn"
                  onClick={() => setDrawerOpen(true)}
                  type="button"
                >
                  <Menu size={20} />
                </button>
                <img alt="Admin Hub Solutions" src="/admin-hub-logo.png" />
                <div className="agent-brand-copy">
                  <strong>{agentTitle?.brand || brandLabel}</strong>
                  <span>{agentTitle?.subtitle}</span>
                </div>
                <b className="agent-page-title">{title}</b>
              </div>
            ) : (
              <strong>{title}</strong>
            )}
            <div className="button-row agent-header-actions">
              {isAgentPortal ? <RealtimeStatus /> : null}
              <ThemeToggle />
              {isAgentPortal ? <NotificationSettings /> : null}
              {isAgentPortal ? (
                <>
                  <div className="agent-popover-anchor">
                    <button
                      aria-label="Notifications"
                      className="agent-icon-btn"
                      onClick={handleNotificationsClick}
                      type="button"
                    >
                      <Bell size={16} />
                      {liveNotificationCount > 0 ? <span className="agent-dot">{liveNotificationCount > 9 ? "9+" : liveNotificationCount}</span> : null}
                    </button>
                    {notificationsOpen ? (
                      <div className="agent-notification-panel">
                        <div className="agent-popover-head">
                          <strong>Notifications</strong>
                          <Link href={`${base}/announcements`}>View all</Link>
                        </div>
                        {notifHistory.records.length > 0 ? (
                          notifHistory.records.map((record) => (
                            <Link
                              className={`agent-notification-item agent-notification-item--link${record.isRead ? "" : " agent-notification-item--unread"}`}
                              href={record.href}
                              key={record.id}
                              onClick={() => { notifHistory.markOneRead(record.id); setNotificationsOpen(false); }}
                            >
                              <span className="agent-notification-icon">{record.icon}</span>
                              <div>
                                <strong>{record.title}</strong>
                                <p>{record.body}</p>
                              </div>
                              {!record.isRead ? <span className="agent-notification-dot" /> : null}
                            </Link>
                          ))
                        ) : verifyFeed.count > 0 || callsFeed.count > 0 ? (
                          <>
                            {verifyFeed.count > 0 ? (
                              <Link
                                className="agent-notification-item agent-notification-item--link agent-notification-item--unread"
                                href={`${base}/verification`}
                                onClick={() => { verifyFeed.markRead(); setNotificationsOpen(false); }}
                              >
                                <span className="agent-notification-icon">✅</span>
                                <div>
                                  <strong>{verifyFeed.count} ticket{verifyFeed.count !== 1 ? 's' : ''} pending verification</strong>
                                  <p>Open the Verification Queue to review.</p>
                                </div>
                                <span className="agent-notification-dot" />
                              </Link>
                            ) : null}
                            {callsFeed.count > 0 ? (
                              <Link
                                className="agent-notification-item agent-notification-item--link agent-notification-item--unread"
                                href={`${base}/calls`}
                                onClick={() => { callsFeed.markRead(); setNotificationsOpen(false); }}
                              >
                                <span className="agent-notification-icon">📞</span>
                                <div>
                                  <strong>{callsFeed.count} call{callsFeed.count !== 1 ? 's' : ''} in queue</strong>
                                  <p>A customer is waiting in the call queue.</p>
                                </div>
                                <span className="agent-notification-dot" />
                              </Link>
                            ) : null}
                          </>
                        ) : (
                          <div className="agent-notification-empty">
                            <Bell size={20} />
                            <p>No new notifications</p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <Link
                    aria-label="Messages"
                    className="agent-icon-btn dark"
                    href={`${base}/messages`}
                  >
                    <MessageSquare size={16} />
                  </Link>
                  <div className="agent-popover-anchor">
                    <button
                      className="agent-user-pill"
                      onClick={() => {
                        setUserOpen((value) => !value);
                        setNotificationsOpen(false);
                      }}
                      type="button"
                    >
                      <span className="agent-avatar">{initials}</span>
                      <span className="agent-user-copy">
                        <strong>{displayName}</strong>
                        <small>
                          {role === "csr_manager"
                            ? "CSR Manager"
                            : role === "team_leader"
                              ? "Team Leader"
                              : "CSR Agent"}
                        </small>
                      </span>
                      <ChevronDown size={16} />
                    </button>
                    {userOpen ? (
                      <div className="agent-user-menu">
                        <Link href={`${base}/announcements`}>
                          <Megaphone size={16} /> Announcements
                        </Link>
                        <Link href={`${base}/change-password`}>
                          <KeyRound size={16} /> Change Password
                        </Link>
                        <button onClick={logout} type="button">
                          <LogOut size={16} /> Logout
                        </button>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <span className="muted">
                    <UserRound size={15} style={{ verticalAlign: "-2px" }} />{" "}
                    {displayName}
                  </span>
                  <button
                    className="btn btn-secondary"
                    onClick={logout}
                    type="button"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </>
              )}
            </div>
          </header>
        )}
        {isAgentPortal ? (
          <NotificationToastStack
            basePath={base}
            onDismiss={toastQueue.dismiss}
            onMarkRead={(cat: NotificationCategory) => {
              if (cat === "verify") verifyFeed.markRead();
              if (cat === "messages") messagesFeed.markRead();
              if (cat === "calls") callsFeed.markRead();
            }}
            toasts={toastQueue.visible}
          />
        ) : null}
        <div className="page">{children}</div>
        {isCustomerPortal ? (
          <nav
            className="customer-bottom-nav"
            aria-label="Customer bottom navigation"
          >
            {nav.map((item) => (
              <Link
                className={
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "active"
                    : ""
                }
                href={item.href}
                key={item.href}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        ) : null}
      </main>
    </div>
  );
}
