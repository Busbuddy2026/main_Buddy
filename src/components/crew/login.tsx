"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/transport/ui";
import { errorMessage } from "@/lib/api/client";
import { CREW_LOGIN_PREFIX } from "@/lib/api/schemas/crew";
import { useCrew } from "@/lib/transport/crew-store";

/**
 * C1 — one page: the crew ID (BMV, A for attendant or D for driver, then the
 * bus number: BMVA5965) and the crew password the school gives all its drivers
 * and attendants, checked on the server. Five wrong tries lock the ID for 15
 * minutes.
 */
export function CrewLogin() {
  const { signIn } = useCrew();
  const [crewId, setCrewId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const id = crewId.trim().toUpperCase().replace(/\s+/g, "");
  const ready = id.length >= 4 && password.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (id.length < 4) return setError(`Enter your crew ID, like ${CREW_LOGIN_PREFIX}A5965.`);
    if (!password) return setError("Enter the crew password.");
    setBusy(true);
    setError("");
    try {
      await signIn(id, password);
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
      <h1 className="mt-[clamp(8px,2.2vh,16px)] text-[clamp(19px,3.6vh,25px)] font-semibold tracking-[-0.025em] text-balance">Crew sign in</h1>
      <p className="mt-1.5 text-[clamp(12px,1.75vh,13px)] leading-[1.45] text-muted text-pretty">Mark boarding and drops for your bus.</p>

      <label htmlFor="crew-id" className="mb-1.5 mt-[clamp(14px,3.6vh,28px)] text-[12px] font-semibold text-ink-2">
        Crew ID
      </label>
      <div className={field} style={{ borderColor: error ? "#d93025" : "#e4e7eb" }}>
        <Icon name="badge" size={19} className="text-faint" />
        <input
          id="crew-id"
          autoComplete="username"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder={`${CREW_LOGIN_PREFIX}A5965`}
          value={crewId}
          onChange={(e) => {
            setCrewId(e.target.value.toUpperCase());
            setError("");
          }}
          className="min-w-0 flex-1 bg-transparent font-mono text-[17px] font-semibold tracking-[0.06em] text-ink outline-none placeholder:font-normal placeholder:text-disabled"
        />
      </div>
      <p className="mt-1.5 text-[11.5px] text-faint">
        {CREW_LOGIN_PREFIX}A + bus number for the attendant, {CREW_LOGIN_PREFIX}D + bus number for the driver.
      </p>

      <label htmlFor="crew-password" className="mb-1.5 mt-[clamp(12px,2.6vh,20px)] text-[12px] font-semibold text-ink-2">
        Password
      </label>
      <div className={field} style={{ borderColor: error ? "#d93025" : "#e4e7eb" }}>
        <Icon name="lock" size={19} className="text-faint" />
        <input
          id="crew-password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Crew password"
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
    </form>
  );
}
