import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-text-secondary">404</p>
      <h1 className="text-2xl font-semibold text-text">Page not found</h1>
      <p className="max-w-sm text-sm text-text-secondary">
        The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-text transition hover:opacity-90"
      >
        Go home
      </Link>
    </div>
  );
}
