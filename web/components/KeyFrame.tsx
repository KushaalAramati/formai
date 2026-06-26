'use client';

import { useEffect, useRef } from 'react';
import { drawSkeleton, type FormState } from '@/lib/pose/skeleton';
import type { Landmark } from '@/lib/analysis/types';

/** A captured workout frame with the skeleton overlaid — used for best/worst rep screenshots. */
export function KeyFrame({
  url,
  landmarks,
  state,
  caption,
}: {
  url: string | null;
  landmarks: Landmark[] | null;
  state: FormState;
  caption: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img || !landmarks) return;
    const draw = () => {
      c.width = img.naturalWidth || 360;
      c.height = img.naturalHeight || 240;
      const ctx = c.getContext('2d');
      if (ctx) drawSkeleton(ctx, landmarks, c.width, c.height, state);
    };
    if (img.complete) draw();
    else img.onload = draw;
  }, [url, landmarks, state]);

  return (
    <div style={{ flex: 1, minWidth: 150 }}>
      <div
        style={{
          position: 'relative',
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: '#000',
          aspectRatio: '3 / 2',
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={url}
            alt={caption}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <div className="muted" style={{ padding: 16, fontSize: 12 }}>
            No frame captured
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 6, textAlign: 'center' }}>
        {caption}
      </div>
    </div>
  );
}
