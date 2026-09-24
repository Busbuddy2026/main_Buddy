import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";
import { Accent, Eyebrow, Lede } from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "Book a demo",
  description:
    "Send a few details and we'll come back with a demo slot on your own route within one working day.",
};

export default function ContactPage() {
  return (
    <section>
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(min(330px,100%),1fr))] gap-14 px-[26px] pb-[90px] pt-[88px]">
        <div>
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-[22px] text-[clamp(32px,4.4vw,58px)] font-extrabold leading-none tracking-[-0.05em] text-balance">
            Book a demo on
            <br />
            <Accent>your own route</Accent>
          </h1>
          <Lede className="mt-[22px] max-w-[420px] text-[16.5px]">
            Send a few details and we&rsquo;ll come back with a slot within one working day. Bring
            your transport head if you can.
          </Lede>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
