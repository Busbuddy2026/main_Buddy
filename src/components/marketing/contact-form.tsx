"use client";

import { useId, useState } from "react";
import { INTERESTS } from "@/lib/marketing/content";
import {
  EMPTY_DEMO_REQUEST,
  validateDemoRequest,
  type DemoRequestErrors,
  type DemoRequestInput,
} from "@/lib/marketing/demo-request";

/*
 * Demo request form.
 *
 * Posts to /api/demo-request, which records the request in Supabase. The same
 * validator runs here and there, so the messages a reader sees match the ones
 * the server would have produced.
 */

const INITIAL: DemoRequestInput = { ...EMPTY_DEMO_REQUEST, interests: ["Live tracking"] };

type Status = "idle" | "sending" | "error";

export function ContactForm() {
  const uid = useId();
  const [fields, setFields] = useState<DemoRequestInput>(INITIAL);
  const [errors, setErrors] = useState<DemoRequestErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Left empty by anyone who can see the form; see the route's honeypot check.
  const [company, setCompany] = useState("");

  const set = (key: keyof DemoRequestInput) => (value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleInterest = (label: string) =>
    setFields((f) => ({
      ...f,
      interests: f.interests.includes(label)
        ? f.interests.filter((x) => x !== label)
        : [...f.interests, label],
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "sending") return;

    const parsed = validateDemoRequest(fields);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setStatus("idle");
      setMessage(null);
      return;
    }

    setStatus("sending");
    setMessage(null);

    try {
      const response = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...parsed.value, company }),
      });
      const data: { ok?: boolean; errors?: DemoRequestErrors; message?: string } | null =
        await response.json().catch(() => null);

      if (response.ok && data?.ok) {
        setSentTo(parsed.value.email);
        return;
      }
      if (response.status === 400 && data?.errors) {
        setErrors(data.errors);
        setStatus("idle");
        return;
      }
      setMessage(data?.message ?? "Something went wrong. Please try again.");
      setStatus("error");
    } catch {
      // The details stay on screen, so a retry costs nothing but the tap.
      setMessage("We could not reach the server. Check your connection and try again.");
      setStatus("error");
    }
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
              setFields(INITIAL);
              setErrors({});
              setStatus("idle");
              setMessage(null);
            }}
            className="mt-2 rounded-full border border-bb-edge-2 px-[18px] py-3 text-[13.5px] font-semibold hover:border-bb-hover-2"
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-busy={sending}
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
          error={errors.buses}
          inputMode="numeric"
        />
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="font-code text-[9.5px] uppercase tracking-[0.16em] text-bb-muted-3">
          I&rsquo;m most interested in
        </legend>
        <div className="flex flex-wrap gap-[9px]">
          {INTERESTS.map((label) => {
            const on = fields.interests.includes(label);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => toggleInterest(label)}
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
          aria-invalid={errors.note ? true : undefined}
          className="resize-y rounded-[10px] border border-bb-edge bg-bb-raised-2 p-[13px] text-[16px] text-bb-text outline-none focus:border-bb-hover-2 sm:text-[14px]"
        />
        {errors.note ? (
          <span role="alert" className="text-[11.5px] text-bb-muted">
            {errors.note}
          </span>
        ) : null}
      </label>

      {/* Off-screen rather than display:none, which more bots know to skip. */}
      <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={`${uid}-company`}>Company</label>
        <input
          id={`${uid}-company`}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      {message ? (
        <p
          role="alert"
          className="rounded-[10px] border border-bb-edge bg-bb-raised-2 px-[13px] py-[11px] text-[12.5px] text-bb-text-2"
        >
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={sending}
        className="rounded-full bg-bb-text px-[22px] py-[15px] text-[14px] font-semibold text-bb-bg hover:bg-bb-text-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? "Sending…" : "Request a demo"}
      </button>
      <p className="text-[11.5px] text-bb-eyebrow">
        We use these details only to arrange your demo.
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
