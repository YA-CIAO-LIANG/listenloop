import type { SVGProps } from "react";

/** Decorative icons. Always pair with visible or screen-reader text. */
export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

/** Points (shell): earned by practicing, spent on fish. */
export function PointsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M2.5 9.5a5.5 5.5 0 0 1 11 0L12 13H4z" />
      <path d="M8 4v9M5.2 5.2 6.4 13M10.8 5.2 9.6 13" />
    </svg>
  );
}

/** Fish feed (pellets): one portion a day, for feeding the fish. */
export function FeedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      aria-hidden="true"
      {...props}
    >
      <circle cx="5" cy="10.5" r="2" />
      <circle cx="10.5" cy="11" r="1.6" />
      <circle cx="8.5" cy="5.5" r="1.8" />
    </svg>
  );
}

/** A fish outline, used as the shop's placeholder thumbnail. */
export function FishIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M1.5 8c2-3 5.5-4 8.5-2.2L14.5 3v10L10 10.2C7 12 3.5 11 1.5 8z" />
      <circle cx="5" cy="7.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
