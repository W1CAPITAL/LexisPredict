"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { SuperadminControlPanel } from "@/components/superadmin/superadmin-control-panel";

export default function SuperadminPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <SuperadminControlPanel />
        </div>
      </main>
    </div>
  );
}
