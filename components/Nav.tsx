"use client";

import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-[83rem] px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-lg font-semibold text-primary-black hover:text-primary-green transition-colors"
            >
              Workflow Templates
            </Link>
            <Link
              href="/templates"
              className="text-sm font-medium text-primary-grey hover:text-primary-green transition-colors"
            >
              Templates
            </Link>
            <Link
              href="/integrations"
              className="text-sm font-medium text-primary-grey hover:text-primary-green transition-colors"
            >
              Integrations
            </Link>
            <Link
              href="/history"
              className="text-sm font-medium text-primary-grey hover:text-primary-green transition-colors"
            >
              History
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
