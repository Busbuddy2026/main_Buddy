"use client";

/**
 * One camera from LivePin's player page, sized so its video fills a 16:9 box
 * exactly. The vendor page stretches each video over a box `50vh` tall,
 * `50vw` wide when the page is wider than 768px and `100vw` below that, with
 * a bandwidth bar along the bottom; the frame is sized so that box comes out
 * at the width given, and the caller's box clips the rest.
 */

export interface CameraStream {
  channel: number;
  format: string;
  playerUrl: string;
}

const VENDOR_WIDE_PX = 769;
const VENDOR_BAR_PX = 38;

export function frameSize(width: number) {
  const videoHeight = (width * 9) / 16;
  return {
    width: width * 2 >= VENDOR_WIDE_PX ? width * 2 : width,
    height: (videoHeight + VENDOR_BAR_PX) * 2,
  };
}

/** Place inside a box of `width` × 16:9 with overflow hidden. */
export function VendorFrame({ stream, title, width }: { stream: CameraStream; title: string; width: number }) {
  if (!width) return null;
  const frame = frameSize(width);
  return (
    <iframe
      title={`${title} camera ${stream.channel}`}
      src={stream.playerUrl}
      allow="autoplay"
      tabIndex={-1}
      className="pointer-events-none absolute left-0 top-0 border-0"
      style={{ width: frame.width, height: frame.height }}
    />
  );
}
