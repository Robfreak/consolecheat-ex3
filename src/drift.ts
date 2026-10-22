import { clampUnit, type Vec } from "./pad.ts";

/** Drawn as a solid circle. Gameplay deadzones are often near this. */
export const DEADZONE = 0.1;

/** Rest magnitude above this is flagged. Strictly greater, so 8% is not yet drift. */
export const DRIFT_THRESHOLD = 0.08;

/** Stick travel past this is treated as a deliberate push and does not move the rest point. */
export const REST_CAPTURE = 0.45;

export const MIN_REST_SAMPLES = 20;

export type DriftMemory = { rest: Vec; samples: number };

export type DriftReading = {
  rest: Vec;
  magnitude: number;
  samples: number;
  ready: boolean;
  drifting: boolean;
};

export function emptyDrift(): DriftMemory {
  return { rest: { x: 0, y: 0 }, samples: 0 };
}

export function stickMagnitude(stick: Vec): number {
  return Math.hypot(stick.x, stick.y);
}

export function percentPoints(value: number): number {
  return Math.round(value * 100);
}

function roundTo(n: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(n * factor + Math.sign(n) * 1e-9) / factor;
}

export function formatAxis(n: number, lang: string): string {
  const rounded = roundTo(n, 3);
  const body = Math.abs(rounded).toLocaleString(lang, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    useGrouping: false,
  });
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `-${body}`;
  return body;
}

export function formatPercent(value: number, lang = "en"): string {
  return (Math.round(value * 1000) / 10).toLocaleString(lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    useGrouping: false,
  });
}

/**
 * Learns where a stick rests. The same function is used for hardware frames and
 * simulated frames. A hard push (beyond REST_CAPTURE) is ignored so drift is the
 * offset that remains when the stick is released, not the throw itself.
 */
export function updateDrift(memory: DriftMemory, stick: Vec): DriftMemory {
  const x = clampUnit(stick.x);
  const y = clampUnit(stick.y);
  if (Math.hypot(x, y) > REST_CAPTURE) return memory;
  const samples = memory.samples + 1;
  const alpha = samples < 10 ? 0.45 : 0.12;
  return {
    rest: {
      x: memory.rest.x + (x - memory.rest.x) * alpha,
      y: memory.rest.y + (y - memory.rest.y) * alpha,
    },
    samples,
  };
}

export function readDrift(memory: DriftMemory): DriftReading {
  const magnitude = Math.hypot(memory.rest.x, memory.rest.y);
  const ready = memory.samples >= MIN_REST_SAMPLES;
  return {
    rest: memory.rest,
    magnitude,
    samples: memory.samples,
    ready,
    drifting: ready && magnitude > DRIFT_THRESHOLD,
  };
}

export function settleDrift(stick: Vec, frames = 40): DriftReading {
  let memory = emptyDrift();
  for (let i = 0; i < frames; i += 1) memory = updateDrift(memory, stick);
  return readDrift(memory);
}
