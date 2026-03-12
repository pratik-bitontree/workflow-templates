import Link from "next/link";

export default function HomePage() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-3xl font-bold text-primary-black mb-4">
        Workflow Templates & Integrations
      </h1>
      <p className="text-primary-grey mb-8 max-w-xl mx-auto">
        Browse and run pre-built workflow templates. Connect your accounts in the
        Integration Hub to power automations.
      </p>
      <div className="flex gap-4 justify-center">
        <Link
          href="/templates"
          className="rounded-lg bg-primary-green px-6 py-3 text-white font-medium hover:opacity-90 transition-opacity"
        >
          Browse Templates
        </Link>
        <Link
          href="/integrations"
          className="rounded-lg border border-primary-green text-primary-green px-6 py-3 font-medium hover:bg-primary-light-gray transition-colors"
        >
          Integration Hub
        </Link>
      </div>
    </div>
  );
}
