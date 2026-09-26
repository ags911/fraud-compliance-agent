import { cn } from "@/lib/utils"

/**
 * The Averlynx mark: a tilted ring passing behind the planet on its back arc
 * and in front on its front arc, extending past the sphere's edges on both
 * sides. Built on a 24x24 grid — see work/kepler-logo.html for the full
 * light/dark/scale reference sheet this was ported from.
 */
export function AverlynxMark({
  className,
  eraseClassName = "fill-sidebar",
}: {
  className?: string
  /** Fill for the disc that "erases" the ring behind the planet — should
   * match whatever surface the mark sits on. Defaults to the sidebar
   * background since that's the mark's only current placement. */
  eraseClassName?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-5", className)}
      aria-hidden="true"
    >
      <g transform="rotate(-25 12 12)">
        <path
          d="M1.2 12A10.8 3 0 0 1 22.8 12"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </g>
      <circle cx="12" cy="12" r="6.4" className={eraseClassName} />
      <circle
        cx="12"
        cy="12"
        r="6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
      />
      <g transform="rotate(-25 12 12)">
        <path
          d="M1.2 12A10.8 3 0 0 0 22.8 12"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

/**
 * Experimental alternative mark: a hub-and-spoke node graph (one central
 * node, five satellite nodes) — the standard visual language for network
 * analysis / linked-account / fraud-ring detection. Doesn't tie back to
 * an orbital product identity; being used here as the primary Averlynx icon
 * per request, not yet a settled brand decision.
 */
export function NetworkMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-5", className)}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <line x1="12" y1="12" x2="5.5" y2="5.5" />
        <line x1="12" y1="12" x2="18" y2="4.5" />
        <line x1="12" y1="12" x2="20" y2="12.5" />
        <line x1="12" y1="12" x2="17" y2="19" />
        <line x1="12" y1="12" x2="5" y2="18" />
      </g>
      <circle cx="5.5" cy="5.5" r="2" fill="currentColor" />
      <circle cx="18" cy="4.5" r="2.6" fill="currentColor" />
      <circle cx="20" cy="12.5" r="1.6" fill="currentColor" />
      <circle cx="17" cy="19" r="2.2" fill="currentColor" />
      <circle cx="5" cy="18" r="2.6" fill="currentColor" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  )
}

/**
 * Compact routing mark: an outlined A with a single decision point.
 * Designed to remain legible in Radar's 16px top-bar slot.
 */
export function AverlynxRouteMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-5", className)}
      aria-hidden="true"
    >
      <path
        d="M4.5 19 12 4.5 19.5 19"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="2.4" className="fill-[#57e0c2]" />
    </svg>
  )
}

/** Mark + wordmark lockup — matches work/payments-design-concept.html's
 * .fc-sidebar-brand exactly: 16px/600 Satoshi, -0.01em tracking, #18181b. */
export function AverlynxBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-[#18181b]", className)}>
      <NetworkMark className="size-5 shrink-0" />
      <span className="text-base leading-5 font-semibold tracking-[-0.01em] group-data-[collapsible=icon]:hidden">
        Averlynx
      </span>
    </div>
  )
}
