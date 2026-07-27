import { Loader2 } from "lucide-react";

/**
 * The outermost pending boundary. It sits ABOVE the workspace layouts, so it
 * is what covers their own awaits (session, employer/talent row, unread
 * count) on a cold navigation — the per-workspace skeletons below it only
 * start once the shell has rendered.
 */
export default function RootLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-screen items-center justify-center bg-paper"
    >
      <Loader2 className="h-6 w-6 animate-spin text-brand" strokeWidth={1.75} />
    </div>
  );
}
