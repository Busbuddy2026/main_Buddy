import type { Metadata } from "next";
import {
  Accent,
  Container,
  Eyebrow,
  HairGrid,
  Lede,
  Section,
  SectionTitle,
} from "@/components/marketing/ui";
import { ADOPTION_STATS, MILESTONES, PRINCIPLES, TEAM } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "About us",
  description:
    "A school day is well documented at both ends. The bus ride in between usually isn't — Bus Buddy closes that gap.",
};

export default function AboutPage() {
  return (
    <>
      <Section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(100% 70% at 40% -20%,rgba(255,255,255,.1),transparent 60%)" }}
        />
        <Container className="relative pb-[70px] pt-[88px]">
          <Eyebrow>About us</Eyebrow>
          <h1 className="mt-[22px] max-w-[960px] text-[clamp(34px,5.2vw,74px)] font-extrabold leading-[0.98] tracking-[-0.05em] text-balance">
            Built for the twenty minutes
            <br />
            <Accent>nobody can see</Accent>
          </h1>
          <Lede className="max-w-[640px] text-[17px]">
            A school day is well documented at both ends. The bus ride in between usually
            isn&rsquo;t. Bus Buddy closes that gap with a record a parent reads in one glance and a
            school can stand behind.
          </Lede>
        </Container>
      </Section>

      <Section>
        <Container className="py-[70px]">
          <HairGrid min={250}>
            {PRINCIPLES.map((p) => (
              <div key={p.num} className="bg-bb-surface p-8">
                <div className="font-code text-[10px] tracking-[0.16em] text-bb-eyebrow">
                  {p.num}
                </div>
                <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.02em]">{p.title}</h2>
                <p className="mt-[11px] text-[13.5px] font-light leading-[1.65] text-bb-muted-2">
                  {p.blurb}
                </p>
              </div>
            ))}
          </HairGrid>

          <div className="mt-[70px] grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-12">
            <div>
              <Eyebrow>How we work with schools</Eyebrow>
              <SectionTitle className="text-[clamp(26px,3.2vw,40px)]">
                No budget line required.
              </SectionTitle>
              <Lede className="text-[15.5px]">
                The school gets the console and the operational platform; parents choose the plan
                that fits them. That keeps adoption honest — features have to be worth paying for.
              </Lede>
              <dl className="mt-[30px] flex flex-wrap gap-[34px]">
                {ADOPTION_STATS.map((s) => (
                  <div key={s.label}>
                    <dt className="sr-only">{s.label}</dt>
                    <dd>
                      <span className="block font-code text-[28px] font-bold tracking-[-0.03em]">
                        {s.value}
                      </span>
                      <span className="mt-[5px] block text-[12.5px] text-bb-muted-3">
                        {s.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-4">
              {TEAM.map((p, i) => (
                <li
                  key={`${p.role}-${i}`}
                  className="rounded-2xl border border-bb-line-2 bg-bb-surface p-[18px]"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#9aa0a5" strokeWidth="1.3" aria-hidden>
                    <circle cx="12" cy="8.5" r="3.5" />
                    <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
                  </svg>
                  <div className="mt-3.5 text-[14px] font-semibold">{p.name}</div>
                  <div className="mt-[3px] text-[11.5px] text-bb-muted-3">{p.role}</div>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="py-[70px]">
          <Eyebrow>How we got here</Eyebrow>
          <HairGrid className="mt-7">
            {MILESTONES.map((m) => (
              <div
                key={m.when}
                className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] items-baseline gap-[22px] bg-bb-surface px-[30px] py-[26px] hover:bg-bb-raised-2"
              >
                <div className="font-code text-[10.5px] uppercase tracking-[0.16em] text-bb-eyebrow">
                  {m.when}
                </div>
                <div className="text-[15.5px] font-light leading-[1.6] text-bb-text-2 sm:col-span-2">
                  {m.what}
                </div>
              </div>
            ))}
          </HairGrid>
        </Container>
      </Section>
    </>
  );
}
