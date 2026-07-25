// Official-style "Get it on Google Play" badge, inlined as SVG so it needs no
// external asset and stays crisp at any size. Wrapped in the store link.
export function GooglePlayBadge({
  href,
  className = "",
}: {
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get CTEVT Plus on Google Play"
      className={`inline-flex items-center gap-3 rounded-xl bg-black px-5 py-3 text-white shadow-lg ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-neutral-900 ${className}`}
    >
      <svg width="26" height="28" viewBox="0 0 512 512" aria-hidden="true">
        <path fill="#00d4ff" d="M47 20 300 256 47 492c-9-5-15-15-15-27V47c0-12 6-22 15-27z" />
        <path fill="#00f076" d="M47 20c5-3 11-3 17 1l280 158-64 64L47 20z" />
        <path fill="#ff3a44" d="M361 187 447 236c22 12 22 40 0 52l-86 49-64-64 64-86z" />
        <path fill="#ffc900" d="M280 315 64 491c-6 4-12 4-17 1l253-241 64 64-84 0z" />
      </svg>
      <span className="text-left leading-none">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-white/70">
          Get it on
        </span>
        <span className="block text-lg font-semibold">Google Play</span>
      </span>
    </a>
  );
}
