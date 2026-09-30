import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { NetworkProvider } from "@/components/providers/network-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "Floci Management Dashboard",
  description: "Production-grade console for managing local Floci AWS emulator instances",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex antialiased">
        <QueryProvider>
          <NetworkProvider>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
              <Header />
              <main className="flex-1 p-8 max-w-7xl w-full mx-auto">{children}</main>
            </div>
          </NetworkProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
