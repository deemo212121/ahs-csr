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
  Gauge,
  Home,
  Headphones,
  KeyRound,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Ticket,
  UserCog,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AppRole } from "@/lib/types";

type NavItem = { href: string; label: string; icon: React.ReactNode };

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
  { href: "/manager/dashboard", label: "Overview", icon: <Gauge size={18} /> },
  { href: "/manager/tickets", label: "Tickets", icon: <Ticket size={18} /> },
  {
    href: "/manager/verification",
    label: "Verification Queue",
    icon: <ShieldCheck size={18} />,
  },
  {
    href: "/manager/branch-assignment",
    label: "Branch Assignment",
    icon: <ClipboardCheck size={18} />,
  },
  { href: "/manager/calls", label: "Calls", icon: <Headphones size={18} /> },
  {
    href: "/manager/activity-logs",
    label: "Activity Logs",
    icon: <ClipboardList size={18} />,
  },
  {
    href: "/manager/messages",
    label: "Messages",
    icon: <MessageSquare size={18} />,
  },
  {
    href: "/manager/manual",
    label: "Manual Ticket",
    icon: <ClipboardPlus size={18} />,
  },
  {
    href: "/manager/mistake",
    label: "Mistake",
    icon: <AlertTriangle size={18} />,
  },
  {
    href: "/manager/warning",
    label: "Warning",
    icon: <AlertTriangle size={18} />,
  },
  { href: "/manager/report", label: "Report", icon: <BarChart3 size={18} /> },
  {
    href: "/manager/announcements",
    label: "Announcements",
    icon: <Megaphone size={18} />,
  },
  {
    href: "/manager/change-password",
    label: "Change Password",
    icon: <KeyRound size={18} />,
  },
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
  const { profile, role, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const nav = role ? navByRole[role] : [];
  const isCustomerPortal = role === "customer";
  const isAgentPortal =
    role === "csr" || role === "team_leader" || role === "csr_manager";

  const notificationKey = useMemo(() => {
    if (!role || !profile?.id) return null;
    return `portal-notifications-read-${role}-${profile.id}`;
  }, [profile?.id, role]);

  useEffect(() => {
    if (!notificationKey) {
      setNotificationCount(0);
      return;
    }

    const wasRead = window.localStorage.getItem(notificationKey) === "true";
    setNotificationCount(wasRead ? 0 : isAgentPortal ? 4 : 0);
  }, [isAgentPortal, notificationKey]);

  function handleNotificationsClick() {
    setNotificationsOpen((value) => !value);
    setUserOpen(false);
    setNotificationCount(0);
    if (notificationKey) {
      window.localStorage.setItem(notificationKey, "true");
    }
  }
  const base = getRoleBase(role);
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
            {nav.map((item) => (
              <Link
                className={`nav-item ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "active" : ""}`}
                href={item.href}
                key={item.href}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
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
              {drawerLinks.map((item) => (
                <Link
                  className={
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`)
                      ? "active"
                      : ""
                  }
                  href={item.href}
                  key={item.href}
                  onClick={() => setDrawerOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
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
              <ThemeToggle />
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
                      {notificationCount > 0 ? <span className="agent-dot">{notificationCount}</span> : null}
                    </button>
                    {notificationsOpen ? (
                      <div className="agent-notification-panel">
                        <div className="agent-popover-head">
                          <strong>Notifications</strong>
                          <Link href={`${base}/announcements`}>View all</Link>
                        </div>
                        {[
                          [
                            "New Service Request",
                            "New request #SRV-20260616-5940 from Customer NumberOne (Normal)",
                          ],
                          [
                            "New Request Needs Verification",
                            "Customer request #SRV-20260616-5940 is waiting in the Verification Queue.",
                          ],
                          [
                            "New Service Request",
                            "New request #SRV-20260615-2005 from Bubble Max (Normal)",
                          ],
                          [
                            "New Request Needs Verification",
                            "Customer request #SRV-20260615-2005 is waiting in the Verification Queue.",
                          ],
                        ].map(([heading, body]) => (
                          <div
                            className="agent-notification-item"
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
