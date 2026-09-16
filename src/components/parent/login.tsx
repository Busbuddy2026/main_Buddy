"use client";

import Image from "next/image";
import { useState } from "react";
import { Keypad } from "@/components/mobile/keypad";
import { PARENT, formatPhone } from "@/lib/transport/parent";
import { useParent } from "@/lib/transport/parent-store";

/** B1 — mobile number, then a 6-digit OTP. Demo code is 123456. */
export function ParentLogin() {
  const { signIn } = useParent();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState<string>(PARENT.phone);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState(false);

  const phoneReady = phone.length === 10;
  const otpReady = otp.length === 6;
  const display = step === "phone" && phone.length === 0 ? "Mobile number" : formatPhone(phone);

  const submit = () => {
    if (step === "phone") {
      if (!phoneReady) return;
      setStep("otp");
      setOtp("");
      setError(false);
      return;
    }
    if (otp === PARENT.demoOtp) signIn(phone);
    else setError(true);
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
    if (next.length === 6) {
      if (next === PARENT.demoOtp) signIn(phone);
      else setError(true);
    }
  };

  return (
    <div className="flex min-h-[690px] flex-col px-[26px] pb-[22px] pt-[38px]">
      <Image
        src="/school-logo.png"
        alt=""
        width={76}
        height={76}
        className="size-[76px] rounded-full object-cover"
      />
      <h1 className="mt-4 text-[25px] font-semibold tracking-[-0.025em]">
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
          <div className="mt-6 flex gap-[9px]">
            {Array.from({ length: 6 }, (_, i) => {
              const ch = otp[i] ?? "";
              return (
                <div
                  key={i}
                  className="grid flex-1 place-items-center rounded-[13px] border-[1.5px] font-mono text-[22px] font-semibold"
                  style={{
                    aspectRatio: "1 / 1.15",
                    borderColor: error ? "#f7c8c4" : ch ? "#1a73e8" : "#e4e7eb",
                    background: ch ? "#f7faff" : "#fff",
                  }}
                >
                  {ch}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11.5px] text-faint">Resend code in 0:24</span>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setOtp("");
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
        className="mt-[18px] rounded-[15px] py-4 text-[15px] font-semibold"
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
