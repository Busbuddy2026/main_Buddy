"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { api, errorMessage } from "@/lib/api/client";

/**
 * Screenshots and recordings of the live dashcam, saved to the viewer's own
 * computer. The video plays in the vendor's cross-origin frame, which a page
 * cannot read, so this captures the browser tab (the browser asks first) and
 * crops it to the camera grid where the browser supports Region Capture
 * (Chrome, Edge); elsewhere it records the whole tab. Every capture is
 * audited first, and nothing is captured if that fails.
 */

/** Region Capture, not yet in TypeScript's DOM types. */
interface CropTargetStatic {
  fromElement(element: Element): Promise<unknown>;
}
type CroppableTrack = MediaStreamTrack & { cropTo?: (target: unknown) => Promise<void> };
type TabCaptureOptions = DisplayMediaStreamOptions & { preferCurrentTab?: boolean; selfBrowserSurface?: "include" | "exclude" };

const RECORDING_TYPES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];

function stamp(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const captureSupported = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== "undefined";

async function grabFrame(stream: MediaStream): Promise<Blob> {
  const video = document.createElement("video");
  video.muted = true;
  video.srcObject = stream;
  await video.play();
  // Let a fresh frame arrive after a crop.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
  video.pause();
  video.srcObject = null;
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not make the screenshot."))), "image/png"),
  );
}

export function useDashcamCapture({
  busUid,
  fileLabel,
  target,
}: {
  busUid: string;
  /** "Bus 5965" → files named bus-5965_<date>_<time>. */
  fileLabel: string;
  target: RefObject<HTMLElement | null>;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);

  const prefix = fileLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "dashcam";
  const audit = useCallback(
    (kind: "screenshot" | "recording_started" | "recording_saved", extra: { seconds?: number } = {}) =>
      api.post(`/api/admin/cctv/buses/${busUid}/capture`, { kind, ...extra }),
    [busUid],
  );

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  /** Asks the browser for this tab, cropped to the camera grid when it can. */
  const openStream = useCallback(async () => {
    if (stream.current) return stream.current;
    const options: TabCaptureOptions = {
      video: { displaySurface: "browser", frameRate: 30 },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
    };
    const captured = await navigator.mediaDevices.getDisplayMedia(options);
    const track = captured.getVideoTracks()[0] as CroppableTrack | undefined;
    const CropTarget = (window as unknown as { CropTarget?: CropTargetStatic }).CropTarget;
    if (track?.cropTo && CropTarget && target.current) {
      await track.cropTo(await CropTarget.fromElement(target.current));
    }
    stream.current = captured;
    return captured;
  }, [target]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (err) {
      // Closing the browser's share prompt is a choice, not an error.
      if (!(err instanceof DOMException && err.name === "NotAllowedError")) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const screenshot = useCallback(
    () =>
      run(async () => {
        await audit("screenshot");
        const keep = recorder.current !== null;
        try {
          download(await grabFrame(await openStream()), `${prefix}_${stamp()}.png`);
        } finally {
          if (!keep) release();
        }
      }),
    [audit, openStream, prefix, release, run],
  );

  const stop = useCallback(() => {
    recorder.current?.stop();
  }, []);

  const record = useCallback(
    () =>
      run(async () => {
        await audit("recording_started");
        const captured = await openStream();
        const mimeType = RECORDING_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
        const rec = new MediaRecorder(captured, mimeType ? { mimeType } : undefined);
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
          const length = Math.round((Date.now() - startedAt.current) / 1000);
          const type = rec.mimeType || "video/webm";
          download(new Blob(chunks, { type }), `${prefix}_${stamp(new Date(startedAt.current))}.${type.includes("mp4") ? "mp4" : "webm"}`);
          recorder.current = null;
          setRecording(false);
          release();
          audit("recording_saved", { seconds: length }).catch(() => undefined);
        };
        // The browser's own "Stop sharing" ends the recording too.
        captured.getVideoTracks()[0]?.addEventListener("ended", () => rec.state !== "inactive" && rec.stop());
        rec.start(1000);
        recorder.current = rec;
        startedAt.current = Date.now();
        setSeconds(0);
        setRecording(true);
      }),
    [audit, openStream, prefix, release, run],
  );

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  // Closing the player saves what was recorded so far.
  useEffect(
    () => () => {
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      else release();
    },
    [release],
  );

  return { recording, seconds, busy, error, screenshot, record, stop };
}
