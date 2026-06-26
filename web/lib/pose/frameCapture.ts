// Downscaled video-frame snapshots for key-frame screenshots (best/worst rep).
// We keep a time-stamped, subsampled, capped buffer so memory stays bounded for long sets.
export interface Snapshot {
  t: number; // seconds, matches FrameSample.t
  url: string; // data URL (JPEG)
}

const MAX = 300;
const TARGET_W = 360;

export class SnapshotBuffer {
  private buf: Snapshot[] = [];
  private canvas: HTMLCanvasElement | null = null;

  capture(video: HTMLVideoElement, t: number) {
    if (!video.videoWidth) return;
    if (!this.canvas) this.canvas = document.createElement('canvas');
    const scale = TARGET_W / video.videoWidth;
    const w = TARGET_W;
    const h = Math.round(video.videoHeight * scale);
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    this.buf.push({ t, url: this.canvas.toDataURL('image/jpeg', 0.55) });
    // bound memory: drop oldest by keeping an evenly-spaced sample
    if (this.buf.length > MAX) this.buf = this.buf.filter((_, i) => i % 2 === 0);
  }

  /** nearest snapshot to time t (or null). */
  nearest(t: number): Snapshot | null {
    if (!this.buf.length) return null;
    let best = this.buf[0];
    let bestD = Math.abs(best.t - t);
    for (const s of this.buf) {
      const d = Math.abs(s.t - t);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  all(): Snapshot[] {
    return this.buf;
  }
}
