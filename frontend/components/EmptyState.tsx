import Link from "next/link";

interface EmptyStateProps {
  /** Large emoji or icon shown at the top */
  icon?: string;
  title: string;
  description?: string;
  /** Optional CTA button */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({
  icon = "🗺️",
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-6xl mb-5 select-none">{icon}</div>
      <h3 className="text-white text-xl font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-blue-300/70 text-sm max-w-xs mb-6">{description}</p>
      )}
      {action && (
        <>
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold text-sm shadow-lg shadow-blue-900/40"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold text-sm shadow-lg shadow-blue-900/40 cursor-pointer"
            >
              {action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
