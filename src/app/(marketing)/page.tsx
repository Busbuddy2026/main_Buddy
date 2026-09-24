import { FaceScanFrame, FaceSequence, FaqList, PlatformTabs, StatCounters } from "@/components/marketing/home-widgets";
import { LiveRoutePanel } from "@/components/marketing/live-panel";
import {
  Accent,
  ButtonLink,
  Container,
  Eyebrow,
  HairGrid,
  Lede,
  Section,
  SectionTitle,
} from "@/components/marketing/ui";
import { QUOTES, SCHOOLS, TRUST, VISION, type TrustIcon } from "@/lib/marketing/content";

/** B0 — the landing page. Section order follows the handoff, "Screens §1". */

const HERO_GLOW =
  "radial-gradient(120% 80% at 50% -10%,rgba(255,255,255,.14) 0%,rgba(255,255,255,0) 55%)," +
  "radial-gradient(70% 50% at 18% 30%,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 60%)," +
  "radial-gradient(60% 45% at 85% 65%,rgba(255,255,255,.06) 0%,rgba(255,255,255,0) 60%)";

const HERO_MESH =
  "linear-gradient(#101315 1px,transparent 1px),linear-gradient(90deg,#101315 1px,transparent 1px)";

const MESH_MASK = "radial-gradient(70% 60% at 50% 20%,#000 0%,transparent 75%)";

const MARQUEE_MASK = "linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)";

export default function HomePage() {
  return (
    <>
      <Section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [animation:bb-drift_26s_ease-in-out_infinite]"
          style={{ background: HERO_GLOW }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: HERO_MESH,
            backgroundSize: "72px 72px",
            maskImage: MESH_MASK,
            WebkitMaskImage: MESH_MASK,
          }}
        />

        <Container className="relative pt-24 text-center">
          <div className="inline-flex items-center gap-[9px] rounded-full border border-[#23262a] px-[15px] py-[7px] font-code text-[10.5px] uppercase tracking-[0.16em] text-bb-muted">
            <span className="size-[5px] rounded-full bg-bb-text [animation:bb-blink_1.8s_infinite]" />
            The platform for school transport safety
          </div>

          <h1 className="mx-auto mt-[30px] max-w-[1020px] text-[clamp(46px,8.4vw,124px)] font-extrabold leading-[0.92] tracking-[-0.05em] text-balance">
            Every journey,
            <br />
            <Accent>accounted for</Accent>
          </h1>

          <p className="mx-auto mt-7 max-w-[600px] text-[clamp(15px,1.4vw,19px)] font-light leading-[1.6] text-bb-muted text-pretty">
            Live location, boarding confirmation and safety records for the twenty minutes of a
            school day nobody can see.
          </p>

          <div className="mt-[34px] flex flex-wrap justify-center gap-[11px]">
            <ButtonLink href="/contact">Book a demo</ButtonLink>
            <ButtonLink href="/product" variant="ghost">
              Explore the platform
            </ButtonLink>
          </div>
        </Container>

        <div className="relative mt-14">
          <LiveRoutePanel />
        </div>
      </Section>

      {/* ── Already in motion ─────────────────────────────────────────── */}
      <Section className="py-[34px]">
        <div className="text-center font-code text-[10px] uppercase tracking-[0.2em] text-bb-eyebrow">
          Already in motion
        </div>
        <div
          className="mt-[22px] overflow-hidden"
          style={{ maskImage: MARQUEE_MASK, WebkitMaskImage: MARQUEE_MASK }}
        >
          <div className="flex w-[200%] [animation:bb-marquee_34s_linear_infinite]">
            {[0, 1].map((half) => (
              <div key={half} aria-hidden={half === 1} className="flex w-1/2 gap-[18px] px-[9px]">
                {SCHOOLS.map((name) => (
                  <div
                    key={name}
                    className="flex min-w-[150px] flex-1 items-center gap-2.5 px-2.5 py-2"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      stroke="#5f666b"
                      strokeWidth="1.4"
                      className="shrink-0"
                      aria-hidden
                    >
                      <path d="M4 19V9.5l8-5.5 8 5.5V19z" />
                      <path d="M10 19v-5h4v5" />
                    </svg>
                    <span className="whitespace-nowrap text-[13.5px] font-medium text-bb-muted">
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── The vision ────────────────────────────────────────────────── */}
      <Section>
        <Container className="py-[90px]">
          <Eyebrow>The vision</Eyebrow>
          <SectionTitle className="max-w-[860px]">
            A school bus should file its own report.
          </SectionTitle>
          <HairGrid min={250} className="mt-[46px]">
            {VISION.map((v) => (
              <div
                key={v.num}
                data-reveal
                className="flex min-h-[250px] flex-col bg-bb-surface px-7 py-[34px] hover:bg-bb-raised-2"
              >
                <div className="font-code text-[34px] font-bold tracking-[-0.04em] text-[#23272a]">
                  {v.num}
                </div>
                <h3 className="mt-[22px] text-[19px] font-semibold tracking-[-0.02em]">{v.title}</h3>
                <p className="mt-3 text-[13.5px] font-light leading-[1.65] text-bb-muted-2">
                  {v.blurb}
                </p>
              </div>
            ))}
          </HairGrid>
        </Container>
      </Section>

      {/* ── The platform ──────────────────────────────────────────────── */}
      <Section>
        <Container className="py-[90px]">
          <Eyebrow>The platform</Eyebrow>
          <SectionTitle className="max-w-[760px]">
            One surface for the ride, the record and the proof.
          </SectionTitle>
          <Lede className="max-w-[620px]">
            Instrument the bus, watch the trip, confirm who boarded, and keep a record the school
            can stand behind.
          </Lede>
          <PlatformTabs />
        </Container>
      </Section>

      {/* ── Design for trust ──────────────────────────────────────────── */}
      <Section>
        <Container className="py-[90px]">
          <Eyebrow>Design for trust</Eyebrow>
          <SectionTitle className="max-w-[760px]">
            Children&rsquo;s data. Held on the school&rsquo;s terms.
          </SectionTitle>
          <div className="mt-[46px] grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-5">
            {TRUST.map((t) => (
              <div
                key={t.title}
                data-reveal
                className="relative overflow-hidden rounded-[18px] border border-bb-line-2 bg-bb-surface p-[30px] hover:border-bb-hover"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(90% 60% at 50% 0%,rgba(255,255,255,.05),transparent 70%)",
                  }}
                />
                <div className="relative grid size-10 place-items-center rounded-[11px] border border-bb-edge-2">
                  <TrustGlyph icon={t.icon} />
                </div>
                <h3 className="relative mt-[22px] text-[18.5px] font-semibold tracking-[-0.02em]">
                  {t.title}
                </h3>
                <p className="relative mt-3 text-[13.5px] font-light leading-[1.65] text-bb-muted-2">
                  {t.blurb}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── From the field ────────────────────────────────────────────── */}
      <Section tone="paper">
        <Container className="py-[90px]">
          <Eyebrow tone="paper">From the field</Eyebrow>
          <SectionTitle className="max-w-[700px]">What changes in the first month.</SectionTitle>
          <div className="mt-[46px] grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-5">
            {QUOTES.map((q) => (
              <figure
                key={q.who + q.where}
                data-reveal
                className="flex flex-col gap-5 rounded-[18px] border border-bb-paper-line bg-bb-paper-card p-7"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="#0a0a0a"
                  strokeWidth="1.3"
                  aria-hidden
                >
                  <path d="M9.5 5.5H6.5a2 2 0 00-2 2v3a2 2 0 002 2h3v-2.4c0 2.9-1.2 5-3.4 6.4" />
                  <path d="M19.5 5.5h-3a2 2 0 00-2 2v3a2 2 0 002 2h3v-2.4c0 2.9-1.2 5-3.4 6.4" />
                </svg>
                <blockquote className="flex-1 text-[15.5px] font-medium leading-[1.55] tracking-[-0.01em]">
                  {q.text}
                </blockquote>
                <figcaption>
                  <div className="text-[13px] font-semibold">{q.who}</div>
                  <div className="mt-0.5 text-[12px] text-bb-paper-muted">{q.where}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── Safety+ at the door ───────────────────────────────────────── */}
      <Section>
        <Container className="py-[90px]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-center gap-12">
            <div>
              <Eyebrow>Safety+ · at the door</Eyebrow>
              <h2 className="mt-5 text-[clamp(28px,3.6vw,46px)] font-extrabold leading-[1.04] tracking-[-0.04em] text-balance">
                The child steps in. The record writes itself.
              </h2>
              <Lede className="max-w-[520px]">
                No tapping, no roll call, no gaps. Identification, attendance and the parent&rsquo;s
                confirmation happen in one motion.
              </Lede>
              <FaceSequence />
            </div>
            <FaceScanFrame />
          </div>
        </Container>
      </Section>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <Section>
        <Container className="py-20">
          <StatCounters />
        </Container>
      </Section>

      {/* ── Questions ─────────────────────────────────────────────────── */}
      <Section>
        <div className="mx-auto w-full max-w-[940px] px-[26px] py-[90px]">
          <Eyebrow>Questions</Eyebrow>
          <SectionTitle className="mb-[34px] text-[clamp(28px,3.6vw,44px)]">
            What schools ask first.
          </SectionTitle>
          <FaqList />
        </div>
      </Section>

      {/* ── Closing ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [animation:bb-drift_30s_ease-in-out_infinite]"
          style={{
            background:
              "radial-gradient(90% 90% at 50% 120%,rgba(255,255,255,.16),transparent 65%)",
          }}
        />
        <Container className="relative py-[120px] text-center">
          <h2 className="mx-auto max-w-[900px] text-[clamp(34px,6.4vw,92px)] font-extrabold leading-[0.98] tracking-[-0.05em]">
            Change what parents
            <br />
            <Accent>worry about.</Accent>
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-[11px]">
            <ButtonLink href="/contact">Book a demo</ButtonLink>
            <ButtonLink href="/pricing" variant="ghost">
              See parent plans
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}

function TrustGlyph({ icon }: { icon: TrustIcon }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f2f3f4" strokeWidth="1.4" aria-hidden>
      {icon === "lock" ? (
        <>
          <rect x="5" y="10.5" width="14" height="9" rx="2" />
          <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
        </>
      ) : icon === "eye" ? (
        <>
          <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      ) : (
        <>
          <path d="M7 3.5h7l4 4v13H7z" />
          <path d="M9.6 12h6M9.6 15.4h6" />
        </>
      )}
    </svg>
  );
}
