import {
  PRESSED_AT,
  STANDARD_INDEX,
  mapPad,
  type ButtonId,
  type Frame,
  type RawButton,
  type RawPad,
  type Vec,
  clampUnit,
} from "./pad.ts";

/** Left stick ends above the drift threshold. Right stick stays under it. */
export const DEMO_DRIFT_LEFT: Vec = { x: 0.18, y: -0.06 };
export const DEMO_DRIFT_RIGHT: Vec = { x: -0.03, y: 0.04 };
export const DRIFT_DEMO_MS = 1500;

export const KEY_BUTTONS: Record<string, ButtonId> = {
  KeyI: "triangle",
  KeyJ: "square",
  KeyK: "cross",
  KeyL: "circle",
  KeyQ: "l1",
  KeyE: "r1",
  Digit1: "l2",
  Digit2: "r2",
  Digit3: "share",
  Digit4: "options",
  KeyZ: "l3",
  KeyX: "r3",
  KeyT: "up",
  KeyF: "left",
  KeyG: "down",
  KeyH: "right",
  KeyP: "ps",
  Space: "touchpad",
};

export const HANDLED_KEYS = new Set<string>([
  ...Object.keys(KEY_BUTTONS),
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export type SimHold = {
  keys: ReadonlySet<string>;
  pointerButtons: ReadonlySet<ButtonId>;
  leftPointer: Vec | null;
  rightPointer: Vec | null;
  biasLeft: Vec;
  biasRight: Vec;
};

export type Box = { left: number; top: number; width: number; height: number };

export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

export function scriptedBias(progress: number): { left: Vec; right: Vec } {
  const k = easeOutCubic(progress);
  if (k === 0) return { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
  return {
    left: { x: DEMO_DRIFT_LEFT.x * k, y: DEMO_DRIFT_LEFT.y * k },
    right: { x: DEMO_DRIFT_RIGHT.x * k, y: DEMO_DRIFT_RIGHT.y * k },
  };
}

export function stickFromPointer(box: Box, clientX: number, clientY: number): Vec {
  const radius = Math.min(box.width, box.height) / 2;
  if (radius <= 0) return { x: 0, y: 0 };
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  let x = (clientX - cx) / radius;
  let y = (clientY - cy) / radius;
  const magnitude = Math.hypot(x, y);
  if (magnitude > 1) {
    x /= magnitude;
    y /= magnitude;
  }
  return { x, y };
}

export function combineStick(pointer: Vec | null, keys: Vec, bias: Vec): Vec {
  if (pointer) return { x: clampUnit(pointer.x), y: clampUnit(pointer.y) };
  return { x: clampUnit(bias.x + keys.x), y: clampUnit(bias.y + keys.y) };
}

function keyAxis(keys: ReadonlySet<string>, negative: string, positive: string): number {
  const neg = keys.has(negative);
  const pos = keys.has(positive);
  if (neg === pos) return 0;
  return pos ? 1 : -1;
}

/** Builds a Standard Gamepad report so simulated input goes through mapPad. */
export function rawFromSim(hold: SimHold): RawPad {
  const buttons: RawButton[] = Array.from({ length: 18 }, () => ({ pressed: false, value: 0 }));
  const setButton = (id: ButtonId, value: number) => {
    buttons[STANDARD_INDEX[id]] = { pressed: value > PRESSED_AT, value };
  };
  for (const code of hold.keys) {
    const id = KEY_BUTTONS[code];
    if (id) setButton(id, 1);
  }
  for (const id of hold.pointerButtons) setButton(id, 1);
  const left = combineStick(
    hold.leftPointer,
    { x: keyAxis(hold.keys, "KeyA", "KeyD"), y: keyAxis(hold.keys, "KeyW", "KeyS") },
    hold.biasLeft,
  );
  const right = combineStick(
    hold.rightPointer,
    { x: keyAxis(hold.keys, "ArrowLeft", "ArrowRight"), y: keyAxis(hold.keys, "ArrowUp", "ArrowDown") },
    hold.biasRight,
  );
  return {
    id: "simulated",
    mapping: "standard",
    buttons,
    axes: [left.x, left.y, right.x, right.y],
  };
}

export function frameFromSim(hold: SimHold): Frame {
  return mapPad(rawFromSim(hold));
}

export function emptyHold(): SimHold {
  return {
    keys: new Set(),
    pointerButtons: new Set(),
    leftPointer: null,
    rightPointer: null,
    biasLeft: { x: 0, y: 0 },
    biasRight: { x: 0, y: 0 },
  };
}
