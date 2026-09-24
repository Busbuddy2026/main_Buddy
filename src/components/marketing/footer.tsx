import Image from "next/image";
import Link from "next/link";

const COLUMNS = [
  {
    heading: "Navigation",
    links: [
      { href: "/product", label: "Product & services" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Book a demo" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-bb-line">
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-9 px-[26px] py-[52px]">
        <div>
          <Image
            src="/busbuddy-logo.png"
            alt="Bus Buddy"
            width={800}
            height={219}
            sizes="106px"
            className="h-[26px] w-auto"
          />
          <p className="mt-4 max-w-[270px] text-[13px] font-light leading-[1.65] text-bb-muted-4">
            School transport tracking, attendance and safety — built for the ride in between.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading} className="flex flex-col gap-2.5">
            <div className="font-code text-[9.5px] font-medium uppercase tracking-[0.16em] text-bb-faint">
              {col.heading}
            </div>
            {col.links.map((l) => (
              <Link key={l.href} href={l.href} className="text-[13.5px] text-bb-muted hover:text-bb-text">
                {l.label}
              </Link>
            ))}
          </div>
        ))}

        <div className="flex flex-col gap-2.5">
          <div className="font-code text-[9.5px] font-medium uppercase tracking-[0.16em] text-bb-faint">
            Legal
          </div>
          {/* Not built yet — listed, per the handoff, but deliberately not links. */}
          <span className="text-[13.5px] text-bb-muted">Privacy policy</span>
          <span className="text-[13.5px] text-bb-muted">Terms of use</span>
        </div>
      </div>

      <div className="border-t border-[#101315]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap justify-between gap-3 px-[26px] py-5 font-code text-[10px] uppercase tracking-[0.12em] text-bb-faint">
          <span>Bus Buddy © 2026</span>
          <span>Parent-paid · School-managed</span>
        </div>
      </div>
    </footer>
  );
}
