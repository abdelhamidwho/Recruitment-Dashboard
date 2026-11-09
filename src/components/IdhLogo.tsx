import { useId } from "react";

// IDH house mark: a guilloché-style double ring around a serif monogram, all
// painted from the active theme's gold tokens so it re-gilds with the theme.
export function IdhMark({ size = 44, animated = true }: { size?: number; animated?: boolean }) {
  const id = useId().replace(/:/g, "");
  const ring = animated
    ? { strokeDasharray: 300, strokeDashoffset: 300, animation: "lux-draw 2.2s 0.2s cubic-bezier(0.65,0,0.35,1) forwards" }
    : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="IDH"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--gold-1)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--gold-2)" }} />
          <stop offset="1" style={{ stopColor: "var(--gold-3)" }} />
        </linearGradient>
        <radialGradient id={`h${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: "var(--glow)" }} />
          <stop offset="1" stopColor="transparent" />
        </radialGradient>
        <clipPath id={`c${id}`}>
          <circle cx="32" cy="32" r="27" />
        </clipPath>
      </defs>

      <circle
        cx="32"
        cy="32"
        r="34"
        fill={`url(#h${id})`}
        style={animated ? { animation: "lux-breathe 5s ease-in-out infinite", transformOrigin: "32px 32px" } : undefined}
      />
      <circle cx="32" cy="32" r="30" fill="none" stroke={`url(#g${id})`} strokeWidth="1.6" style={ring} />
      <circle cx="32" cy="32" r="26.5" fill="none" stroke={`url(#g${id})`} strokeWidth="0.6" opacity="0.8" style={ring} />
      {/* eight cardinal studs between the rings */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <circle
            key={i}
            cx={32 + Math.cos(a) * 28.25}
            cy={32 + Math.sin(a) * 28.25}
            r="0.7"
            fill={`url(#g${id})`}
          />
        );
      })}
      <text
        x="32"
        y="38.5"
        textAnchor="middle"
        fill={`url(#g${id})`}
        style={{
          fontFamily: 'var(--font-display), "Cormorant Garamond", Georgia, serif',
          fontWeight: 600,
          fontSize: 19,
          letterSpacing: 1.2,
        }}
      >
        IDH
      </text>
      {/* slow light sweep, clipped to the medallion */}
      {animated ? (
        <g clipPath={`url(#c${id})`}>
          <rect
            x="0"
            y="0"
            width="14"
            height="64"
            fill="white"
            opacity="0.22"
            style={{ animation: "lux-sweep 6s 1.5s ease-in-out infinite", transformBox: "fill-box" }}
          />
        </g>
      ) : null}
    </svg>
  );
}

export function IdhLogo({ size = 44, stacked = false }: { size?: number; stacked?: boolean }) {
  return (
    <span className={`inline-flex items-center ${stacked ? "flex-col gap-3 text-center" : "gap-3.5"}`}>
      <IdhMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          className="lux-gold-text font-display font-semibold"
          style={{ fontSize: size * 0.5, letterSpacing: "0.2em", paddingLeft: "0.2em" }}
        >
          IDH
        </span>
        <span
          className="mt-1.5 text-muted-foreground"
          style={{ fontSize: Math.max(11, size * 0.26), letterSpacing: "0.12em" }}
        >
          Talent Sourcing
        </span>
      </span>
    </span>
  );
}
