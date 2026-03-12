"use client";

import { useState, useCallback } from "react";
import type { IntegrationDetail } from "@/lib/types";

function IconLink() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
  );
}
function IconCheck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  );
}
function IconX() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
  );
}

interface IntegrationCardsProps {
  integrations: IntegrationDetail[];
  onSelectIntegration: (integration: IntegrationDetail) => void;
  emptyMessage?: string;
}

function LogoOrPlaceholder({
  logo,
  integrationType,
  failedLogos,
  onLogoError,
}: {
  logo: string | undefined;
  integrationType: string;
  failedLogos: Set<string>;
  onLogoError: (type: string) => void;
}) {
  const showImg = logo && !failedLogos.has(integrationType);
  const placeholder = (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
      <span className="text-gray-500"><IconLink /></span>
    </div>
  );
  if (!showImg) return placeholder;
  return (
    <img
      src={logo}
      alt=""
      className="h-10 w-10 rounded-lg object-contain"
      onError={() => onLogoError(integrationType)}
    />
  );
}

export function IntegrationCards({ integrations, onSelectIntegration, emptyMessage }: IntegrationCardsProps) {
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const handleLogoError = useCallback((type: string) => {
    setFailedLogos((prev) => new Set(prev).add(type));
  }, []);

  if (integrations.length === 0) {
    return (
      <p className="text-gray-500">
        {emptyMessage ?? "No integrations configured. Ensure the backend is running and integration hub is set up."}
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {integrations.map((integration) => {
        const isConnected = integration.status === "connected";

        return (
          <button
            type="button"
            key={integration.type}
            onClick={() => onSelectIntegration(integration)}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-left hover:border-green-500 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <LogoOrPlaceholder
                  logo={integration.logo}
                  integrationType={integration.type}
                  failedLogos={failedLogos}
                  onLogoError={handleLogoError}
                />
                <div>
                  <h2 className="font-semibold text-gray-900">{integration.name}</h2>
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${
                      isConnected ? "text-green-600" : "text-gray-500"
                    }`}
                  >
                    {isConnected ? (
                      <>
                        <IconCheck /> Connected
                        {integration.email && (
                          <span className="truncate max-w-[140px]" title={integration.email}>
                            ({integration.email})
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <IconX /> Not connected
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-600">
                {isConnected ? "Manage" : "Connect"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
