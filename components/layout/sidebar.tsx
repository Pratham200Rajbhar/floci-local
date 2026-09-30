"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  HardDrive,
  Server,
  Zap,
  Cpu,
  MessageSquare,
  Mail,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkConfig } from "@/components/providers/network-provider";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/s3", label: "S3 Storage", icon: HardDrive },
  { href: "/rds", label: "RDS Databases", icon: Database },
  { href: "/ec2", label: "EC2 Instances", icon: Server },
  { href: "/elasticache", label: "ElastiCache", icon: Zap },
  { href: "/lambda", label: "Lambda Functions", icon: Cpu },
  { href: "/messaging", label: "Messaging (SQS/SNS)", icon: MessageSquare },
  { href: "/ses", label: "SES Email", icon: Mail },
  { href: "/settings/network", label: "Network & Access", icon: Network },
];

export function Sidebar() {
  const pathname = usePathname();
  const { config, isLocked } = useNetworkConfig();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 h-screen sticky top-0">
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
          F
        </div>
        <div>
          <h1 className="font-bold text-slate-900 leading-none text-base">Floci</h1>
          <span className="text-xs text-slate-500 font-medium">AWS Emulator Console</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="text-[11px] text-slate-500 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Access Mode:</span>
            <span className="capitalize font-medium text-blue-600">
              {config.mode} {isLocked && "(Locked)"}
            </span>
          </div>
          <div className="truncate font-mono text-[10px] text-slate-600" title={`${config.host}:${config.apiPort}`}>
            {config.protocol}://{config.host}:{config.apiPort}
          </div>
        </div>
      </div>
    </aside>
  );
}
