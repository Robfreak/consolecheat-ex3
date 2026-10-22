export const BUTTON_IDS = [
  "cross",
  "circle",
  "square",
  "triangle",
  "l1",
  "r1",
  "l2",
  "r2",
  "share",
  "options",
  "l3",
  "r3",
  "up",
  "down",
  "left",
  "right",
  "ps",
  "touchpad",
] as const;

export type ButtonId = (typeof BUTTON_IDS)[number];

/** W3C Standard Gamepad canonical indices. Cross is the bottom face button. */
export const STANDARD_INDEX: Record<ButtonId, number> = {
  cross: 0,
  circle: 1,
  square: 2,
  triangle: 3,
  l1: 4,
  r1: 5,
  l2: 6,
  r2: 7,
  share: 8,
  options: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  ps: 16,
  touchpad: 17,
};

export type Kind = "dualshock4" | "dualsense" | "standard" | "unknown" | "simulated";
export type Profile = "standard" | "sony-hid" | "sony-kernel";

export type RawButton = { pressed?: boolean; value?: number };

export type RawPad = {
  id: string;
  mapping: string;
  buttons: readonly RawButton[];
  axes: readonly number[];
};

export type Vec = { x: number; y: number };

export type Frame = {
  kind: Kind;
  profile: Profile;
  buttons: Record<ButtonId, number>;
  left: Vec;
  right: Vec;
};

export const PRESSED_AT = 0.04;

const PRODUCTS: Record<string, Kind> = {
  "05c4": "dualshock4",
  "09cc": "dualshock4",
  "0ba0": "dualshock4",
  "0ce6": "dualsense",
  "0df2": "dualsense",
};

export function clampUnit(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n > 1) return 1;
  if (n < -1) return -1;
  return n;
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n > 1) return 1;
  if (n < 0) return 0;
  return n;
}

export function isPressed(value: number): boolean {
  return value > PRESSED_AT;
}

export function emptyButtons(): Record<ButtonId, number> {
  return {
    cross: 0,
    circle: 0,
    square: 0,
    triangle: 0,
    l1: 0,
    r1: 0,
    l2: 0,
    r2: 0,
    share: 0,
    options: 0,
    l3: 0,
    r3: 0,
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    ps: 0,
    touchpad: 0,
  };
}

export function identifyKind(id: string): Kind {
  const s = id.toLowerCase();
  if (s === "simulated" || s.startsWith("simulated ")) return "simulated";
  const product =
    /product:\s*([0-9a-f]{4})/.exec(s)?.[1] ??
    /054c-([0-9a-f]{4})/.exec(s)?.[1] ??
    /(?:^|[^0-9a-f])(05c4|09cc|0ba0|0ce6|0df2)(?:[^0-9a-f]|$)/.exec(s)?.[1];
  if (product && PRODUCTS[product]) return PRODUCTS[product];
  if (s.includes("dualsense")) return "dualsense";
  if (s.includes("dualshock")) return "dualshock4";
  if (s.includes("wireless controller") && (s.includes("054c") || s.includes("sony"))) return "dualshock4";
  return "unknown";
}

export function chooseProfile(raw: Pick<RawPad, "id" | "mapping">): Profile {
  if (raw.mapping === "standard") return "standard";
  const kind = identifyKind(raw.id);
  if (kind === "dualshock4" || kind === "dualsense") return "sony-hid";
  return "standard";
}

export function pickPadIndex(
  pads: readonly { index: number; id: string }[],
  preferred: number | null,
): number | null {
  if (preferred !== null && pads.some((pad) => pad.index === preferred)) return preferred;
  const sony = pads.find((pad) => {
    const kind = identifyKind(pad.id);
    return kind === "dualshock4" || kind === "dualsense";
  });
  return (sony ?? pads[0])?.index ?? null;
}

function buttonValue(buttons: readonly RawButton[], index: number): number {
  const button = buttons[index];
  if (!button) return 0;
  if (typeof button.value === "number" && button.value > 0) return clamp01(button.value);
  return button.pressed ? 1 : 0;
}

function axisValue(axes: readonly number[], index: number): number {
  return clampUnit(axes[index] ?? 0);
}

/** HID trigger axis is −1 released … +1 pressed (Chromium AxisToButton). */
export function triggerFromAxis(axis: number): number {
  if (!Number.isFinite(axis)) return 0;
  return clamp01((axis + 1) / 2);
}

function directed(axis: number, sign: "neg" | "pos"): number {
  if (!Number.isFinite(axis)) return 0;
  if (sign === "neg") return axis < -0.5 ? 1 : 0;
  return axis > 0.5 ? 1 : 0;
}

function applyStandard(raw: RawPad, buttons: Record<ButtonId, number>): { left: Vec; right: Vec } {
  for (const id of BUTTON_IDS) buttons[id] = buttonValue(raw.buttons, STANDARD_INDEX[id]);
  return {
    left: { x: axisValue(raw.axes, 0), y: axisValue(raw.axes, 1) },
    right: { x: axisValue(raw.axes, 2), y: axisValue(raw.axes, 3) },
  };
}

/**
 * Chromium MapperDualshock4 and MapperDualSense, the raw report before remapping.
 * Face buttons: 0 square, 1 cross, 2 circle, 3 triangle.
 * L2/R2 are axes 3 and 4. Right stick Y is axis 5. D-pad is axes 6 (X) and 7 (Y).
 * PS is button 12, touchpad is button 13.
 */
function applySonyHid(raw: RawPad, buttons: Record<ButtonId, number>): { left: Vec; right: Vec } {
  buttons.square = buttonValue(raw.buttons, 0);
  buttons.cross = buttonValue(raw.buttons, 1);
  buttons.circle = buttonValue(raw.buttons, 2);
  buttons.triangle = buttonValue(raw.buttons, 3);
  buttons.l1 = buttonValue(raw.buttons, 4);
  buttons.r1 = buttonValue(raw.buttons, 5);
  buttons.l2 = triggerFromAxis(raw.axes[3] ?? -1);
  buttons.r2 = triggerFromAxis(raw.axes[4] ?? -1);
  buttons.share = buttonValue(raw.buttons, 8);
  buttons.options = buttonValue(raw.buttons, 9);
  buttons.l3 = buttonValue(raw.buttons, 10);
  buttons.r3 = buttonValue(raw.buttons, 11);
  buttons.ps = buttonValue(raw.buttons, 12);
  buttons.touchpad = buttonValue(raw.buttons, 13);
  buttons.left = directed(raw.axes[6] ?? 0, "neg");
  buttons.right = directed(raw.axes[6] ?? 0, "pos");
  buttons.up = directed(raw.axes[7] ?? 0, "neg");
  buttons.down = directed(raw.axes[7] ?? 0, "pos");
  return {
    left: { x: axisValue(raw.axes, 0), y: axisValue(raw.axes, 1) },
    right: { x: axisValue(raw.axes, 2), y: axisValue(raw.axes, 5) },
  };
}

/**
 * Chromium MapperPs4Ps5 for hid-sony (kernel 4.10+) and hid-playstation (5.12+).
 * Face buttons: 0 cross, 1 circle, 2 triangle, 3 square.
 * L2 is axis 2, R2 is axis 5, right stick is axes 3 and 4.
 * PS is button 10, L3 is 11, R3 is 12. Touchpad is not in this map.
 */
function applySonyKernel(raw: RawPad, buttons: Record<ButtonId, number>): { left: Vec; right: Vec } {
  buttons.cross = buttonValue(raw.buttons, 0);
  buttons.circle = buttonValue(raw.buttons, 1);
  buttons.triangle = buttonValue(raw.buttons, 2);
  buttons.square = buttonValue(raw.buttons, 3);
  buttons.l1 = buttonValue(raw.buttons, 4);
  buttons.r1 = buttonValue(raw.buttons, 5);
  buttons.l2 = triggerFromAxis(raw.axes[2] ?? -1);
  buttons.r2 = triggerFromAxis(raw.axes[5] ?? -1);
  buttons.share = buttonValue(raw.buttons, 8);
  buttons.options = buttonValue(raw.buttons, 9);
  buttons.ps = buttonValue(raw.buttons, 10);
  buttons.l3 = buttonValue(raw.buttons, 11);
  buttons.r3 = buttonValue(raw.buttons, 12);
  buttons.left = directed(raw.axes[6] ?? 0, "neg");
  buttons.right = directed(raw.axes[6] ?? 0, "pos");
  buttons.up = directed(raw.axes[7] ?? 0, "neg");
  buttons.down = directed(raw.axes[7] ?? 0, "pos");
  return {
    left: { x: axisValue(raw.axes, 0), y: axisValue(raw.axes, 1) },
    right: { x: axisValue(raw.axes, 3), y: axisValue(raw.axes, 4) },
  };
}

export function mapPad(raw: RawPad, profile: Profile = chooseProfile(raw)): Frame {
  const buttons = emptyButtons();
  const sticks =
    profile === "sony-hid"
      ? applySonyHid(raw, buttons)
      : profile === "sony-kernel"
        ? applySonyKernel(raw, buttons)
        : applyStandard(raw, buttons);
  const identified = identifyKind(raw.id);
  const kind: Kind =
    identified === "unknown" && profile === "standard" && raw.mapping === "standard" ? "standard" : identified;
  return { kind, profile, buttons, left: sticks.left, right: sticks.right };
}
