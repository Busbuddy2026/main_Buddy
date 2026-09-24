import type { Metadata } from "next";
import { FeatureTable, PlanCards } from "@/components/marketing/pricing";
import { Accent, Container, Eyebrow, Lede, Section } from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Parent-paid plans from ₹129 per student per month. Schools pay no licence fee.",
};

export default function PricingPage() {
  return (
    <>
      <Section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(100% 70% at 50% -20%,rgba(255,255,255,.1),transparent 60%)" }}
        />
        <Container className="relative pb-[60px] pt-[88px]">
          <Eyebrow>Pricing · per student, per month</Eyebrow>
          <h1 className="mt-[22px] max-w-[880px] text-[clamp(34px,5vw,70px)] font-extrabold leading-[0.99] tracking-[-0.05em] text-balance">
            Parents pay for what they need.
            <br />
            <Accent>Schools pay nothing.</Accent>
          </h1>
          <Lede className="max-w-[560px] text-[16.5px]">
            Billed directly to parents. The school provides transport and manages the platform.
          </Lede>
        </Container>
      </Section>

      <Section>
        <Container className="py-14">
          <PlanCards />
        </Container>
      </Section>

      <Section>
        <Container className="py-[70px]">
          <FeatureTable />
          <p className="mt-6 max-w-[780px] text-[12.5px] leading-[1.7] text-bb-muted-4">
            Commercial model: parents are billed directly. The school provides and manages the
            transport infrastructure and operational platform. GPS, camera, facial-recognition and
            fire-safety equipment are included in the applicable premium capability set and handled
            as deployment hardware during implementation.
          </p>
        </Container>
      </Section>
    </>
  );
}
