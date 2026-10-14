/**
 * The app mark: a ruled book -- the daftari a trader already keeps -- in the
 * app's own colours. Same geometry as scripts/make-icons.mjs, which draws the
 * installed-app icons; change one, change the other.
 */
export function Logo({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Kitabu"
      className={className}
    >
      <rect width="24" height="24" rx="5.4" fill="var(--color-brand)" />
      {/* page edges */}
      <rect x="4.4" y="3.8" width="6.4" height="16.4" rx="1.8" fill="var(--color-line-strong)" />
      {/* cover */}
      <rect x="7.6" y="3.8" width="12" height="16.4" rx="1.8" fill="var(--color-paper)" />
      {/* ruled lines */}
      <rect x="10.2" y="7.8" width="6.6" height="1.35" rx="0.67" fill="var(--color-brand)" />
      <rect x="10.2" y="11.3" width="6.6" height="1.35" rx="0.67" fill="var(--color-brand)" />
      <rect x="10.2" y="14.8" width="4" height="1.35" rx="0.67" fill="var(--color-brand)" />
    </svg>
  );
}
