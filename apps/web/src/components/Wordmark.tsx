/** Fastforward mark: two lanes; the lower one dips and returns — a billing gap, closed. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="mark">
      <path d="M5 10.5h22" className="mark__top" />
      <path d="M5 21.5h6.5l3 3.2h3l3-3.2H27" className="mark__bottom" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Mark />
      <span className="wordmark__text">Fastforward</span>
    </span>
  );
}
