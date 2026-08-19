import { Link } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AuthChip() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <div
        className="h-9 w-20 animate-pulse rounded-full bg-surface-2"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link
        to="/login"
        className="inline-flex h-9 items-center rounded-full px-3 text-sm text-muted shadow-[var(--shadow-border)] transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        Sign in
      </Link>
    );
  }

  const label = user.displayName ?? user.primaryEmail ?? "Account";

  return (
    <div className="flex items-center gap-2 rounded-full bg-surface py-1 pr-2 pl-1 shadow-[var(--shadow-border)]">
      {user.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt=""
          className="size-7 rounded-full object-cover"
        />
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-xs">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="hidden max-w-28 truncate text-xs sm:inline">{label}</span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="pr-1 text-xs text-muted transition-colors duration-150 hover:text-fg"
      >
        Sign out
      </button>
    </div>
  );
}
