"use client";

import Image from "next/image";
import { useState } from "react";
import { CodeInput } from "@/components/mobile/code-input";
import { Keypad } from "@/components/mobile/keypad";
import { PARENT, formatPhone } from "@/lib/transport/parent";
import { useParent } from "@/lib/transport/parent-store";

/** B1 — mobile number, then a 6-digit OTP. Demo code is 123456. */
export function ParentLogin() {
  const { signIn } = useParent();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState<string>(PARENT.phone);
  // Prefilled with the demo code so signing in is one tap; the field still
  // accepts OS autofill, paste, a hardware keyboard and the keypad below.
  const [otp, setOtp] = useState<string>(PARENT.demoOtp);
  const [error, setError] = useState(false);

  const phoneReady = phone.length === 10;
  const otpReady = otp.length === 6;
  const display = step === "phone" && phone.length === 0 ? "Mobile number" : formatPhone(phone);

  /** One place the code is checked, whatever filled it in. */
  const verify = (code: string) => {
    if (code === PARENT.demoOtp) signIn(phone);
    else setError(true);
  };

  const submit = () => {
    if (step === "phone") {
      if (!phoneReady) return;
      setStep("otp");
      setOtp(PARENT.demoOtp);
      setError(false);
      return;
    }
    verify(otp);
  };

  const press = (key: string) => {
    if (step === "phone") {
      if (key === "back") return setPhone((p) => p.slice(0, -1));
      if (phone.length >= 10) return;
      return setPhone((p) => p + key);
    }
    if (key === "back") {
      setError(false);
      return setOtp((p) => p.slice(0, -1));
    }
    if (otp.length >= 6) return;
    const next = otp + key;
    setOtp(next);
    setError(false);
    // Six digits is the whole code, so verify without waiting for the button.
    if (next.length === 6) verify(next);
  };

  return (
    <div className="flex min-h-full flex-col px-5 pb-[calc(22px+env(safe-area-inset-bottom))] pt-7 sm:px-[26px] sm:pt-[38px]">
      <Image
        src="/school-logo.png"
        alt=""
        width={76}
        height={76}
        className="size-16 rounded-full object-cover sm:size-[76px]"
      />
      <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.025em] text-balance sm:text-[25px]">
        {step === "phone" ? "Bharath Vidya Mandir" : "Enter the 6-digit code"}
      </h1>
      <p className="mt-1.5 text-[13px] leading-[1.5] text-muted text-pretty">
        {step === "phone"
          ? "Track your child’s bus, get boarding alerts and report transport absences."
          : `Sent to +91 ${formatPhone(phone)}. For this demo the code is ${PARENT.demoOtp}.`}
      </p>

      {step === "phone" ? (
        <>
          <div
            className="mt-6 flex items-center gap-3 rounded-2xl border px-4 py-3.5"
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
          <p className="mt-2.5 text-[11.5px] text-faint">
            Use the mobile number registered with the school.
          </p>
        </>
      ) : (
        <>
          <CodeInput
            className="mt-6"
            length={6}
            value={otp}
            onChange={(v) => {
              setOtp(v);
              setError(false);
            }}
            onComplete={verify}
            error={error}
            label="One-time code"
            autoComplete="one-time-code"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11.5px] text-faint">Resend code in 0:24</span>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setOtp(PARENT.demoOtp);
                setError(false);
              }}
              className="text-xs font-semibold text-primary"
            >
              Change number
            </button>
          </div>
          {error ? (
            <div
              role="alert"
              className="mt-3 rounded-xl bg-critical-tint px-[13px] py-[11px] text-[12.5px] font-medium text-critical-text"
            >
              That code did not match. Try 1 2 3 4 5 6.
            </div>
          ) : null}
        </>
      )}

      <Keypad onPress={press} />

      <button
        type="button"
        onClick={submit}
        className="mt-[18px] min-h-[52px] rounded-[15px] py-4 text-[15px] font-semibold"
        style={{
          background: (step === "phone" ? phoneReady : otpReady) ? "#1a73e8" : "#f1f3f4",
          color: (step === "phone" ? phoneReady : otpReady) ? "#fff" : "#8b919b",
        }}
      >
        {step === "phone" ? "Send OTP" : "Verify and sign in"}
      </button>
      <p className="mt-3.5 text-center text-[11px] leading-[1.5] text-disabled">
        Only parents and guardians listed in school records can sign in.
      </p>
    </div>
  );
}
