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
 * Designed to remain legible in Risk Console's 16px top-bar slot.
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

/**
 * Option 06: a protective boundary crossed by one clear routed decision.
 * Kept intentionally spare for use in compact app-chrome positions.
 */
export function AverlynxShieldMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-5", className)}
      aria-hidden="true"
    >
      <path
        d="M12 3.5 19 6.5v5.1c0 4.3-2.65 7.75-7 9.1-4.35-1.35-7-4.8-7-9.1V6.5l7-3Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="m7.2 15.9 3.15-3.15 2.25 1.55 4.2-4.2"
        stroke="#57e0c2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Lynx Gate: two mirrored sentinels form a protected route around a single
 * decision point. The solid geometry stays recognisable at favicon scale.
 */
export function AverlynxLynxGateMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-5", className)}
      aria-hidden="true"
    >
      <path d="m3.5 4.25 6.75 6.75-2 2L3.5 8.25Z" fill="#57e0c2" />
      <path d="m20.5 4.25-6.75 6.75 2 2 4.75-4.75Z" fill="#57e0c2" />
      <path d="m12 10.5 1.5 1.5-1.5 1.5-1.5-1.5 1.5-1.5Z" fill="currentColor" />
    </svg>
  )
}

/**
 * Sliced A: the selected Averlynx monogram. A unified silhouette is cut by
 * one forward route, retaining its identity at both title and favicon scale.
 */
export function AverlynxSlicedAMark({ className }: { className?: string }) {
  return (
    <img
      src="/averlynx-sliced-a-64.png"
      alt=""
      className={cn("size-5", className)}
      aria-hidden="true"
    />
  )
}

/** Mark + wordmark lockup — matches work/payments-design-concept.html's
 * .fc-sidebar-brand exactly: 16px/600 Satoshi, -0.01em tracking, #18181b. */
export function AverlynxBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-[#18181b]", className)}>
      <AverlynxSlicedAMark className="size-5 shrink-0" />
      <span className="text-base leading-5 font-semibold tracking-[-0.01em] group-data-[collapsible=icon]:hidden">
        Averlynx
      </span>
    </div>
  )
}
