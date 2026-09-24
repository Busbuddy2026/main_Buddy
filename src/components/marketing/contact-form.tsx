"use client";

import { useId, useState } from "react";
import { INTERESTS } from "@/lib/marketing/content";

/*
 * Demo request form.
 *
 * Validation and the success state are real; the submit itself is not wired to
 * anything yet. Pointing `onSubmit` at a provider (Formspree, Resend, a route
 * handler) is the one outstanding integration — see the handoff README,
 * "Screens §5". Until then the notice under the button says so plainly rather
 * than pretending the request was sent somewhere.
 */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Fields {
  name: string;
  email: string;
  school: string;
  buses: string;
  note: string;
}

const EMPTY: Fields = { name: "", email: "", school: "", buses: "", note: "" };

type Errors = Partial<Record<"name" | "email" | "school", string>>;

export function ContactForm() {
  const uid = useId();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [interests, setInterests] = useState<string[]>(["Live tracking"]);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (key: keyof Fields) => (value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!fields.name.trim()) next.name = "Please tell us your name";
    if (!EMAIL.test(fields.email.trim())) next.email = "A valid work email, please";
    if (!fields.school.trim()) next.school = "Which school?";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSentTo(fields.email.trim());
  };

  if (sentTo) {
    return (
      <div className="rounded-[20px] border border-bb-line-2 bg-bb-surface p-8">
        <div className="flex min-h-[420px] flex-col items-start justify-center gap-4">
          <span
            aria-hidden
            className="grid size-[46px] place-items-center rounded-full bg-bb-text text-[20px] text-bb-bg"
          >
            ✓
          </span>
          <h2 className="text-[27px] font-bold tracking-[-0.03em]">Request received</h2>
          <p className="max-w-[380px] text-[15px] font-light text-bb-muted-2">
            We&rsquo;ll email {sentTo} with a demo slot within one working day.
          </p>
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setFields(EMPTY);
              setErrors({});
            }}
            className="mt-2 rounded-full border border-bb-edge-2 px-[18px] py-3 text-[13.5px] font-semibold hover:border-bb-hover-2"
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-[18px] rounded-[20px] border border-bb-line-2 bg-bb-surface p-8"
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
        <Field
          id={`${uid}-name`}
          label="Your name"
          placeholder="Priya Sharma"
          value={fields.name}
          onChange={set("name")}
          error={errors.name}
          autoComplete="name"
        />
        <Field
          id={`${uid}-email`}
          label="Work email"
          placeholder="priya@school.edu.in"
          value={fields.email}
          onChange={set("email")}
          error={errors.email}
          type="email"
          autoComplete="email"
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
        <Field
          id={`${uid}-school`}
          label="School"
          placeholder="Greenfield International"
          value={fields.school}
          onChange={set("school")}
          error={errors.school}
          autoComplete="organization"
        />
        <Field
          id={`${uid}-buses`}
          label="Buses in service"
          placeholder="12"
          value={fields.buses}
          onChange={set("buses")}
          inputMode="numeric"
        />
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="font-code text-[9.5px] uppercase tracking-[0.16em] text-bb-muted-3">
          I&rsquo;m most interested in
        </legend>
        <div className="flex flex-wrap gap-[9px]">
          {INTERESTS.map((label) => {
            const on = interests.includes(label);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setInterests((cur) =>
                    cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label],
                  )
                }
                className={`rounded-full border px-[15px] py-[9px] text-[12.5px] font-semibold ${
                  on
                    ? "border-bb-text bg-bb-text text-bb-bg"
                    : "border-bb-edge bg-transparent text-bb-muted hover:border-bb-hover-2"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="font-code text-[9.5px] uppercase tracking-[0.16em] text-bb-muted-3">
          Anything we should know
        </span>
        <textarea
          rows={4}
          value={fields.note}
          onChange={(e) => set("note")(e.target.value)}
          placeholder="We run 12 buses across 3 routes and want parent tracking by next term."
          className="resize-y rounded-[10px] border border-bb-edge bg-bb-raised-2 p-[13px] text-[16px] text-bb-text outline-none focus:border-bb-hover-2 sm:text-[14px]"
        />
      </label>

      <button
        type="submit"
        className="rounded-full bg-bb-text px-[22px] py-[15px] text-[14px] font-semibold text-bb-bg hover:bg-bb-text-2"
      >
        Request a demo
      </button>
      <p className="text-[11.5px] text-bb-eyebrow">
        Not yet connected to an inbox — this form validates but does not send.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric";
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2">
      <span className="font-code text-[9.5px] uppercase tracking-[0.16em] text-bb-muted-3">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-error`}
        /* 16px on phones: anything smaller makes iOS zoom the viewport on focus. */
        className="rounded-[10px] border border-bb-edge bg-bb-raised-2 p-[13px] text-[16px] text-bb-text outline-none focus:border-bb-hover-2 sm:text-[14px]"
      />
      <span id={`${id}-error`} role="alert" className="min-h-[14px] text-[11.5px] text-bb-muted">
        {error}
      </span>
    </label>
  );
}
