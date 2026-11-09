import Link from "next/link";
import type { ReactNode } from "react";
import { IdhLogo } from "@/components/IdhLogo";
import { NavLinks } from "@/components/NavLinks";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="px-6 pt-5 pb-0">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <Link href="/" aria-label="IDH home" className="lux-rise">
          <IdhLogo size={46} />
        </Link>
        <NavLinks />
      </div>
      <hr className="lux-hairline mt-4" />
      {title ? (
        <div className="lux-rise flex items-end justify-between gap-4 flex-wrap py-6" style={{ animationDelay: "0.25s" }}>
          <div>
            <h1 className="text-3xl leading-tight">{title}</h1>
            {subtitle ? <p className="text-muted-foreground text-base mt-1.5 max-w-2xl">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      ) : null}
    </header>
  );
}
