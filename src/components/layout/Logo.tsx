export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="ece-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d5fe6" />
          <stop offset="1" stopColor="#14a69b" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#141b34" />
      <rect x="20" y="20" width="24" height="24" rx="5" fill="url(#ece-g)" />
      <g stroke="#e8eaf4" strokeWidth="2.4" strokeLinecap="round" opacity="0.9">
        <path d="M26 14v6M32 14v6M38 14v6M26 44v6M32 44v6M38 44v6M14 26h6M14 32h6M14 38h6M44 26h6M44 32h6M44 38h6" />
      </g>
      <circle cx="32" cy="32" r="4" fill="#fff" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[1.05rem] font-semibold tracking-[0.08em] text-navy">ECE STUDY</span>
    </span>
  );
}
