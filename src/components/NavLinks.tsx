"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Briefcase, Eye, Heart, Upload } from "lucide-react";

const NAV = [
  { href: "/", label: "Find people", Icon: Search },
  { href: "/jobs", label: "Jobs", Icon: Briefcase },
  { href: "/watchlists", label: "Watchlists", Icon: Eye },
  { href: "/favorites", label: "Favourites", Icon: Heart },
  { href: "/import", label: "Import", Icon: Upload },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-2 flex-wrap">
      {NAV.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className="lux-nav-link" aria-current={active ? "page" : undefined}>
            <Icon aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
