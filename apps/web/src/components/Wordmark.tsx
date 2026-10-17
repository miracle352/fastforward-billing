/** Fastforward mark: two tracks — billing and access — joined by a check. */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="mark">
      <rect width="32" height="32" rx="8" fill="#3ddc97" />
      <path d="M8 11h16" stroke="#04140c" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8 21h5l2.5 2.5L22 17" stroke="#04140c" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
