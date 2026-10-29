"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/transport/ui";
import { errorMessage } from "@/lib/api/client";
import { formatPhone } from "@/lib/transport/parent";
import { useParent } from "@/lib/transport/parent-store";

/**
 * B1 — the mobile number registered with the school, and the parent password
 * the school gives every parent. Checked on the server, five wrong tries per
 * number per 15 minutes.
 */
export function ParentLogin() {
  const { signIn } = useParent();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = phone.length === 10 && password.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (phone.length !== 10) return setError("Enter your 10-digit mobile number.");
    if (!password) return setError("Enter the parent password.");
    setBusy(true);
    setError("");
    try {
      await signIn(phone, password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const field = "flex items-center gap-3 rounded-2xl border px-4 py-[clamp(10px,1.8vh,14px)] transition-colors focus-within:border-primary";

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex min-h-full flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+clamp(10px,2vh,22px))] pt-[clamp(12px,4vh,38px)] sm:px-[26px]"
    >
      <Image src="/school-logo.png" alt="" width={76} height={76} className="size-[clamp(46px,10vh,76px)] shrink-0 rounded-full object-cover" />
      <h1 className="mt-[clamp(8px,2.2vh,16px)] text-[clamp(19px,3.6vh,25px)] font-semibold tracking-[-0.025em] text-balance">Parent sign in</h1>
      <p className="mt-1.5 text-[clamp(12px,1.75vh,13px)] leading-[1.45] text-muted text-pretty">
        Track your child’s bus, get boarding alerts and report transport absences.
      </p>

      <label className="mt-[clamp(14px,3.6vh,28px)] mb-1.5 text-[12px] font-semibold text-ink-2" htmlFor="parent-phone">
        Mobile number
      </label>
      <div className={field} style={{ borderColor: phone.length === 10 ? "#1a73e8" : "#e4e7eb" }}>
        <span className="font-mono text-[15px] font-semibold text-muted">+91</span>
        <span className="h-5 w-px bg-line" />
        <input
          id="parent-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          value={formatPhone(phone)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            // A pasted "+91 98765 43210" keeps the 10-digit number.
            setPhone((digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits).slice(0, 10));
            setError("");
          }}
          className="min-w-0 flex-1 bg-transparent font-mono text-lg font-semibold tracking-[0.06em] text-ink outline-none placeholder:font-normal placeholder:text-disabled"
        />
      </div>
      <p className="mt-1.5 text-[11.5px] text-faint">Use the mobile number registered with the school.</p>

      <label className="mt-[clamp(12px,2.6vh,20px)] mb-1.5 text-[12px] font-semibold text-ink-2" htmlFor="parent-password">
        Password
      </label>
      <div className={field} style={{ borderColor: "#e4e7eb" }}>
        <Icon name="lock" size={19} className="text-faint" />
        <input
          id="parent-password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Parent password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-disabled"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="grid size-8 place-items-center rounded-full text-faint hover:bg-[#f1f3f4]"
        >
          <Icon name={show ? "visibility_off" : "visibility"} size={19} />
        </button>
      </div>
      <p className="mt-1.5 text-[11.5px] text-faint">The password is shared by the school’s transport office.</p>

      {error ? (
        <div role="alert" className="mt-3 rounded-xl bg-critical-tint px-[13px] py-[11px] text-[12.5px] font-medium text-critical-text">
          {error}
        </div>
      ) : null}

      <div className="flex-1" />

      <button
        type="submit"
        disabled={busy}
        className="mt-[clamp(16px,3vh,28px)] min-h-[clamp(44px,6.5vh,54px)] shrink-0 rounded-[15px] py-[clamp(11px,2vh,16px)] text-[15px] font-semibold"
        style={{ background: ready ? "#1a73e8" : "#f1f3f4", color: ready ? "#fff" : "#8b919b" }}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="mt-[clamp(6px,1.4vh,14px)] text-center text-[11px] leading-[1.4] text-disabled [@media(max-height:560px)]:hidden">
        Only parents and guardians listed in school records can sign in.
      </p>
    </form>
  );
}
