"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CodeInput } from "@/components/mobile/code-input";
import { Keypad } from "@/components/mobile/keypad";
import { errorMessage } from "@/lib/api/client";
import { formatPhone } from "@/lib/transport/parent";
import { useParent } from "@/lib/transport/parent-store";

/** Seeded demo guardian (prisma/seed.ts). */
const DEMO_PHONE = "9848012345";
const RESEND_AFTER_S = 30;

/**
 * B1 — mobile number, then a 6-digit OTP.
 *
 * The code is generated, hashed and checked on the server (5-minute expiry,
 * 5 tries, 5 sends an hour). Until SMS is wired, development builds get the
 * code back from the API and prefill it, so signing in stays one tap.
 */
export function ParentLogin() {
  const { requestOtp, verifyOtp } = useParent();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState<string>(DEMO_PHONE);
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const phoneReady = phone.length === 10;
  const otpReady = otp.length === 6;
  const display = step === "phone" && phone.length === 0 ? "Mobile number" : formatPhone(phone);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const code = await requestOtp(phone);
      setDevCode(code);
      setOtp(code ?? "");
      setStep("otp");
      setResendIn(RESEND_AFTER_S);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /** One place the code is checked, whatever filled it in. */
  const verify = async (code: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await verifyOtp(phone, code);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const submit = () => {
    if (busy) return;
    if (step === "phone") {
      if (phoneReady) void send();
      return;
    }
    if (otpReady) void verify(otp);
  };

  const press = (key: string) => {
    if (step === "phone") {
      setError("");
      if (key === "back") return setPhone((p) => p.slice(0, -1));
      if (phone.length >= 10) return;
      return setPhone((p) => p + key);
    }
    if (key === "back") {
      setError("");
      return setOtp((p) => p.slice(0, -1));
    }
    if (otp.length >= 6) return;
    const next = otp + key;
    setOtp(next);
    setError("");
    // Six digits is the whole code, so verify without waiting for the button.
    if (next.length === 6) void verify(next);
  };

  return (
    <div className="flex min-h-full flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+clamp(10px,2vh,22px))] pt-[clamp(12px,4vh,38px)] sm:px-[26px]">
      <Image
        src="/school-logo.png"
        alt=""
        width={76}
        height={76}
        className="size-[clamp(46px,10vh,76px)] shrink-0 rounded-full object-cover"
      />
      <h1 className="mt-[clamp(8px,2.2vh,16px)] text-[clamp(19px,3.6vh,25px)] font-semibold tracking-[-0.025em] text-balance">
        {step === "phone" ? "Bharath Vidya Mandir" : "Enter the 6-digit code"}
      </h1>
      <p className="mt-1.5 text-[clamp(12px,1.75vh,13px)] leading-[1.45] text-muted text-pretty">
        {step === "phone"
          ? "Track your child’s bus, get boarding alerts and report transport absences."
          : `Sent to +91 ${formatPhone(phone)}.${devCode ? ` Development build: the code is ${devCode}.` : ""}`}
      </p>

      {step === "phone" ? (
        <>
          <div
            className="mt-[clamp(12px,3.4vh,24px)] flex items-center gap-3 rounded-2xl border px-4 py-[clamp(10px,1.8vh,14px)]"
            style={{ borderColor: phoneReady ? "#1a73e8" : "#e4e7eb" }}
          >
            <span className="font-mono text-[15px] font-semibold text-muted">+91</span>
            <span className="h-5 w-px bg-line" />
            <span
              className="flex-1 font-mono text-lg font-semibold tracking-[0.06em]"
              style={{ color: phone.length ? "#16181b" : "#a8aeb7" }}
            >
              {display}
            </span>
          </div>
          <p className="mt-2 text-[11.5px] text-faint [@media(max-height:540px)]:hidden">
            Use the mobile number registered with the school.
          </p>
        </>
      ) : (
        <>
          <CodeInput
            className="mt-[clamp(12px,3.4vh,24px)]"
            length={6}
            value={otp}
            onChange={(v) => {
              setOtp(v);
              setError("");
            }}
            onComplete={(code) => void verify(code)}
            error={!!error}
            label="One-time code"
            autoComplete="one-time-code"
          />
          <div className="mt-3 flex items-center justify-between">
            {resendIn > 0 ? (
              <span className="font-mono text-[11.5px] text-faint">
                Resend code in 0:{String(resendIn).padStart(2, "0")}
              </span>
            ) : (
              <button type="button" onClick={() => void send()} className="text-xs font-semibold text-primary">
                Resend code
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setOtp("");
                setDevCode(undefined);
                setError("");
              }}
              className="text-xs font-semibold text-primary"
            >
              Change number
            </button>
          </div>
        </>
      )}

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-xl bg-critical-tint px-[13px] py-[11px] text-[12.5px] font-medium text-critical-text"
        >
          {error}
        </div>
      ) : null}

      <Keypad onPress={press} />

      <button
        type="button"
        onClick={submit}
        className="mt-[clamp(10px,1.8vh,18px)] min-h-[clamp(44px,6.5vh,54px)] shrink-0 rounded-[15px] py-[clamp(11px,2vh,16px)] text-[15px] font-semibold"
        style={{
          background: (step === "phone" ? phoneReady : otpReady) ? "#1a73e8" : "#f1f3f4",
          color: (step === "phone" ? phoneReady : otpReady) ? "#fff" : "#8b919b",
        }}
      >
        {busy ? "Please wait…" : step === "phone" ? "Send OTP" : "Verify and sign in"}
      </button>
      <p className="mt-[clamp(6px,1.4vh,14px)] text-center text-[11px] leading-[1.4] text-disabled [@media(max-height:560px)]:hidden">
        Only parents and guardians listed in school records can sign in.
      </p>
    </div>
  );
}
