import type { Metadata } from "next";
import {
  Accent,
  ButtonLink,
  Container,
  Eyebrow,
  HairGrid,
  Lede,
  Section,
  SectionTitle,
  StatCell,
} from "@/components/marketing/ui";
import { HARDWARE, MODULES, SERVICES, SLA } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Product & services",
  description:
    "Parent app, attendant app, school console and the device layer on the bus — plus the deployment and support that puts them on the road.",
};

const GLOW_LEFT =
  "radial-gradient(100% 70% at 30% -20%,rgba(255,255,255,.1),transparent 60%)";
const GLOW_RIGHT =
  "radial-gradient(100% 70% at 70% -20%,rgba(255,255,255,.1),transparent 60%)";

export default function ProductPage() {
  return (
    <>
      <Section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: GLOW_LEFT }} />
        <Container className="relative pb-[70px] pt-[88px]">
          <Eyebrow>Product</Eyebrow>
          <h1 className="mt-[22px] max-w-[900px] text-[clamp(38px,6vw,82px)] font-extrabold leading-[0.98] tracking-[-0.05em] text-balance">
            Four surfaces,
            <br />
            <Accent>one transport record</Accent>
          </h1>
          <Lede className="max-w-[600px] text-[17px]">
            Parent app, attendant app, school console and the device layer on the bus. Everything a
            trip touches lands in the same record — and everything below it, we deploy and run with
            you.
          </Lede>
          <div className="mt-[30px] flex flex-wrap gap-2.5">
            <ButtonLink href="#services" variant="ghost" size="sm">
              Jump to services ↓
            </ButtonLink>
            <ButtonLink href="/contact" size="sm">
              Book a demo
            </ButtonLink>
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="py-[70px]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
            {MODULES.map((m) => (
              <div
                key={m.name}
                data-reveal
                className="rounded-[18px] border border-bb-line-2 bg-bb-surface p-8 hover:border-bb-hover"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3.5">
                  <h2 className="text-[22px] font-semibold tracking-[-0.025em]">{m.name}</h2>
                  <span className="font-code text-[9.5px] uppercase tracking-[0.16em] text-bb-eyebrow">
                    {m.who}
                  </span>
                </div>
                <p className="mt-3.5 text-[14px] font-light leading-[1.65] text-bb-muted-2">
                  {m.blurb}
                </p>
                <ul className="mt-[22px] flex flex-col gap-px overflow-hidden rounded-xl border border-bb-line bg-bb-line">
                  {m.items.map((it) => (
                    <li
                      key={it}
                      className="flex items-center gap-[11px] bg-bb-raised px-[15px] py-3 text-[13px] text-bb-text-2"
                    >
                      <span aria-hidden className="size-1 shrink-0 rounded-full bg-bb-eyebrow" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="paper">
        <Container className="py-20">
          <Eyebrow tone="paper">On the bus</Eyebrow>
          <SectionTitle className="max-w-[640px] text-[clamp(26px,3.4vw,42px)]">
            Hardware handled at deployment.
          </SectionTitle>
          <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-px overflow-hidden rounded-[18px] border border-bb-paper-line bg-bb-paper-line">
            {HARDWARE.map((h) => (
              <div key={h.kind} className="bg-bb-paper-card p-[26px]">
                <div className="font-code text-[10px] font-medium tracking-[0.16em] text-[#8a8a86]">
                  {h.kind}
                </div>
                <div className="mt-3 text-[15px] font-semibold leading-[1.4]">{h.blurb}</div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section id="services" className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: GLOW_RIGHT }} />
        <Container className="relative pb-[60px] pt-[88px]">
          <Eyebrow>Services</Eyebrow>
          <h2 className="mt-[22px] max-w-[860px] text-[clamp(32px,4.6vw,64px)] font-extrabold leading-[0.99] tracking-[-0.05em] text-balance">
            We set it up,
            <br />
            <Accent>then stay on the line</Accent>
          </h2>
          <Lede className="max-w-[600px] text-[17px]">
            Schools run the transport. We run the platform under it — including getting parents
            onboard, which is usually the hard part.
          </Lede>
        </Container>
      </Section>

      <Section>
        <Container className="py-[70px]">
          <HairGrid>
            {SERVICES.map((s) => (
              <div
                key={s.phase}
                data-reveal
                className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] items-start gap-[26px] bg-bb-surface p-8 hover:bg-bb-raised-2"
              >
                <div className="font-code text-[10px] uppercase tracking-[0.16em] text-bb-eyebrow">
                  {s.phase}
                </div>
                <div>
                  <h3 className="text-[21px] font-semibold tracking-[-0.025em]">{s.name}</h3>
                  <p className="mt-[11px] text-[14px] font-light leading-[1.65] text-bb-muted-2">
                    {s.blurb}
                  </p>
                </div>
                <ul className="flex flex-wrap content-start gap-[7px]">
                  {s.tags.map((t) => (
                    <li
                      key={t}
                      className="rounded-full border border-bb-edge px-3 py-1.5 text-[11.5px] text-bb-muted"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </HairGrid>

          <div className="mt-[22px] grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-px overflow-hidden rounded-[18px] border border-bb-line bg-bb-line">
            {SLA.map((s) => (
              <StatCell key={s.label} value={s.value} label={s.label} className="py-7" />
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
