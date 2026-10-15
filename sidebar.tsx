'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDemoStore } from '@/store/demo-store';
import {
  LayoutDashboard,
  Bell,
  Inbox,
  Users,
  Fingerprint,
  UserCheck,
  ShieldAlert,
  DoorOpen,
  BarChart3,
  ScanEye,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { notifications, visitorRequests, securityAlerts, currentUser } = useDemoStore();

  const unreadNotifications = notifications.filter((n) => !n.isRead && !n.isArchived).length;
  const pendingRequests = visitorRequests.filter((r) => r.requestStatus === 'Pending Approval').length;
  const openAlerts = securityAlerts.filter((a) => a.status === 'Open' || a.status === 'Under Review').length;

  const navItems = [
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    {
      name: 'Staff Notifications',
      href: '/notifications',
      icon: Bell,
      badge: unreadNotifications > 0 ? unreadNotifications : null,
      badgeColor: 'bg-blue-500 text-white',
    },
    {
      name: 'Visitor Requests',
      href: '/visitor-requests',
      icon: Inbox,
      badge: pendingRequests > 0 ? pendingRequests : null,
      badgeColor: 'bg-amber-500 text-slate-950 font-bold',
    },
    { name: 'Visitor Records', href: '/visitor-records', icon: Users },
    { name: 'Known Identity Registry', href: '/identity-registry', icon: Fingerprint },
    { name: 'Staff Management', href: '/staff', icon: UserCheck },
    {
      name: 'Security Monitoring',
      href: '/security',
      icon: ShieldAlert,
      badge: openAlerts > 0 ? openAlerts : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    { name: 'Entry/Exit Logs', href: '/entry-exit', icon: DoorOpen },
    { name: 'Reports & Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'AI Recognition Events', href: '/recognition-events', icon: ScanEye },
    { name: 'Audit Logs', href: '/audit-logs', icon: FileText },
    { name: 'System Settings', href: '/settings', icon: Settings },
  ];

  return (
    <>
    <nav aria-label="Primary navigation" className="md:hidden bg-navy-900 text-slate-300 flex gap-1 overflow-x-auto px-2 py-2 border-b border-navy-800">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined}
            className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-medium ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-navy-800'}`}>
            <Icon className="w-4 h-4" />
            <span>{item.name}</span>
            {item.badge !== null && item.badge !== undefined && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{item.badge}</span>}
          </Link>
        );
      })}
    </nav>
    <aside
      className={`hidden md:flex bg-navy-900 border-r border-navy-800 text-slate-300 flex-col justify-between transition-all duration-200 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-navy-800">
          {!isCollapsed && (
            <Link href="/" className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 rounded-lg shadow">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-base text-white tracking-tight">CampusSentry</span>
                <span className="text-[10px] block font-semibold text-blue-400 uppercase tracking-widest">
                  Admin Portal
                </span>
              </div>
            </Link>
          )}

          {isCollapsed && (
            <div className="mx-auto p-2 bg-blue-600 rounded-lg shadow">
              <Shield className="w-5 h-5 text-white" />
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-170px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                }`}
                title={isCollapsed ? item.name : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </div>

                {!isCollapsed && item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}

                {isCollapsed && item.badge !== null && item.badge !== undefined && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 absolute top-2 right-2" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-navy-800 bg-navy-950/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {currentUser.name.charAt(0)}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{currentUser.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{currentUser.department}</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <Link
              href="/login"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded hover:bg-navy-800 transition-colors"
              title="Logout / Switch Account"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}
