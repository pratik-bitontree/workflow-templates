import Link from "next/link";

export default function TemplateNotFound() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-xl font-semibold text-primary-black mb-2">Template not found</h1>
      <p className="text-primary-grey mb-4">The template you’re looking for doesn’t exist or was removed.</p>
      <Link href="/templates" className="text-primary-green hover:underline">
        Back to templates
      </Link>
    </div>
  );
}
