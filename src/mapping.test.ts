import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseProfile,
  identifyKind,
  mapPad,
  pickPadIndex,
  triggerFromAxis,
  type RawButton,
  type RawPad,
} from "./pad.ts";
import { frameFromSim, rawFromSim, stickFromPointer, type SimHold } from "./sim.ts";

function zeros(count: number): RawButton[] {
  return Array.from({ length: count }, () => ({ pressed: false, value: 0 }));
}

function hold(partial: Partial<SimHold> = {}): SimHold {
  return {
    keys: new Set(),
    pointerButtons: new Set(),
    leftPointer: null,
    rightPointer: null,
    biasLeft: { x: 0, y: 0 },
    biasRight: { x: 0, y: 0 },
    ...partial,
  };
}

test("product ids and names identify DualShock 4 and DualSense", () => {
  assert.equal(
    identifyKind("Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)"),
    "dualshock4",
  );
  assert.equal(identifyKind("054c-05c4-Wireless Controller"), "dualshock4");
  assert.equal(identifyKind("054c-0ba0-Wireless Controller"), "dualshock4");
  assert.equal(
    identifyKind("DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)"),
    "dualsense",
  );
  assert.equal(identifyKind("054c-0df2-DualSense Edge"), "dualsense");
  assert.equal(identifyKind("Sony Interactive Entertainment DualSense"), "dualsense");
  assert.equal(identifyKind("Xbox 360 Controller (STANDARD GAMEPAD)"), "unknown");
  assert.equal(identifyKind("simulated"), "simulated");
});

test("standard mapping puts Cross on button 0 even for a DualSense id", () => {
  const buttons = zeros(18);
  buttons[0] = { pressed: true, value: 1 };
  buttons[6] = { pressed: true, value: 0.4 };
  buttons[16] = { pressed: true, value: 1 };
  buttons[17] = { pressed: true, value: 1 };
  const raw: RawPad = {
    id: "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)",
    mapping: "standard",
    buttons,
    axes: [0.2, -0.4, -0.1, 0.3, 1, 1, 1, 1],
  };
  assert.equal(chooseProfile(raw), "standard");
  const frame = mapPad(raw);
  assert.equal(frame.kind, "dualsense");
  assert.equal(frame.profile, "standard");
  assert.equal(frame.buttons.cross, 1);
  assert.equal(frame.buttons.square, 0);
  assert.equal(frame.buttons.l2, 0.4);
  assert.equal(frame.buttons.ps, 1);
  assert.equal(frame.buttons.touchpad, 1);
  assert.equal(frame.left.x, 0.2);
  assert.equal(frame.left.y, -0.4);
  assert.equal(frame.right.x, -0.1);
  assert.equal(frame.right.y, 0.3);
  assert.equal(frame.buttons.up, 0);
});

test("Sony HID raw report maps square, triggers, the right stick, and the d-pad", () => {
  const buttons = zeros(14);
  buttons[0] = { pressed: true, value: 1 };
  buttons[12] = { pressed: true, value: 1 };
  buttons[13] = { pressed: true, value: 1 };
  const raw: RawPad = {
    id: "054c-05c4-Wireless Controller",
    mapping: "",
    buttons,
    axes: [0.1, 0.2, 0.25, -1, 1, -0.5, -1, 0.8],
  };
  assert.equal(chooseProfile(raw), "sony-hid");
  const frame = mapPad(raw);
  assert.equal(frame.kind, "dualshock4");
  assert.equal(frame.buttons.square, 1);
  assert.equal(frame.buttons.cross, 0);
  assert.equal(frame.buttons.ps, 1);
  assert.equal(frame.buttons.touchpad, 1);
  assert.equal(frame.buttons.l2, 0);
  assert.equal(frame.buttons.r2, 1);
  assert.equal(frame.right.x, 0.25);
  assert.equal(frame.right.y, -0.5);
  assert.equal(frame.buttons.left, 1);
  assert.equal(frame.buttons.right, 0);
  assert.equal(frame.buttons.down, 1);
  assert.equal(frame.buttons.up, 0);
  assert.equal(frame.left.x, 0.1);
  assert.equal(frame.left.y, 0.2);
});

test("DualSense without a standard mapping uses the same HID face order", () => {
  const buttons = zeros(14);
  buttons[1] = { pressed: true, value: 1 };
  const raw: RawPad = {
    id: "054c-0ce6-DualSense Wireless Controller",
    mapping: "",
    buttons,
    axes: [0, 0, 0, 0, -1, 0, 0, 0],
  };
  const frame = mapPad(raw);
  assert.equal(frame.kind, "dualsense");
  assert.equal(frame.profile, "sony-hid");
  assert.equal(frame.buttons.cross, 1);
  assert.equal(frame.buttons.l2, 0.5);
  assert.equal(frame.buttons.r2, 0);
});

test("Sony kernel map is opt-in and differs from HID", () => {
  const buttons = zeros(13);
  buttons[0] = { pressed: true, value: 1 };
  buttons[2] = { pressed: true, value: 1 };
  buttons[10] = { pressed: true, value: 1 };
  const raw: RawPad = {
    id: "054c-09cc-Wireless Controller",
    mapping: "",
    buttons,
    axes: [0, 0, -1, 0.4, -0.2, 1, 1, -1],
  };
  assert.equal(mapPad(raw).buttons.square, 1);
  const frame = mapPad(raw, "sony-kernel");
  assert.equal(frame.profile, "sony-kernel");
  assert.equal(frame.buttons.cross, 1);
  assert.equal(frame.buttons.triangle, 1);
  assert.equal(frame.buttons.square, 0);
  assert.equal(frame.buttons.ps, 1);
  assert.equal(frame.buttons.touchpad, 0);
  assert.equal(frame.buttons.l2, 0);
  assert.equal(frame.buttons.r2, 1);
  assert.equal(frame.right.x, 0.4);
  assert.equal(frame.right.y, -0.2);
  assert.equal(frame.buttons.right, 1);
  assert.equal(frame.buttons.up, 1);
});

test("trigger axis conversion matches a -1 to 1 HID axis", () => {
  assert.equal(triggerFromAxis(-1), 0);
  assert.equal(triggerFromAxis(0), 0.5);
  assert.equal(triggerFromAxis(1), 1);
  assert.equal(triggerFromAxis(Number.NaN), 0);
});

test("an unknown pad with a standard mapping stays on standard indices", () => {
  const buttons = zeros(16);
  buttons[2] = { pressed: true, value: 1 };
  const frame = mapPad({
    id: "Generic USB Joystick",
    mapping: "standard",
    buttons,
    axes: [0, 0, 0, 0],
  });
  assert.equal(frame.kind, "standard");
  assert.equal(frame.buttons.square, 1);
});

test("keyboard, bias, and pointer build a standard frame through mapPad", () => {
  const cross = frameFromSim(hold({ keys: new Set(["KeyK"]) }));
  assert.equal(cross.kind, "simulated");
  assert.equal(cross.profile, "standard");
  assert.equal(cross.buttons.cross, 1);
  assert.equal(cross.buttons.circle, 0);

  const face = frameFromSim(hold({ keys: new Set(["KeyJ", "KeyI", "KeyL", "Digit1", "Space"]) }));
  assert.equal(face.buttons.square, 1);
  assert.equal(face.buttons.triangle, 1);
  assert.equal(face.buttons.circle, 1);
  assert.equal(face.buttons.l2, 1);
  assert.equal(face.buttons.touchpad, 1);

  const sticks = frameFromSim(hold({ keys: new Set(["KeyW", "KeyA", "ArrowRight", "ArrowDown"]) }));
  assert.equal(sticks.left.x, -1);
  assert.equal(sticks.left.y, -1);
  assert.equal(sticks.right.x, 1);
  assert.equal(sticks.right.y, 1);

  const bias = frameFromSim(hold({ biasLeft: { x: 0.18, y: -0.06 }, keys: new Set(["KeyD"]) }));
  assert.equal(bias.left.x, 1);
  assert.equal(bias.left.y, -0.06);

  const pointer = frameFromSim(
    hold({
      biasLeft: { x: 0.18, y: 0 },
      keys: new Set(["KeyD"]),
      leftPointer: { x: -0.25, y: 0.5 },
      pointerButtons: new Set(["r1"]),
    }),
  );
  assert.equal(pointer.left.x, -0.25);
  assert.equal(pointer.left.y, 0.5);
  assert.equal(pointer.buttons.r1, 1);

  const state = hold({ keys: new Set(["KeyG"]) });
  assert.deepEqual(frameFromSim(state), mapPad(rawFromSim(state)));
});

test("pointer position is centered, edged, and clamped to the unit circle", () => {
  const box = { left: 0, top: 0, width: 200, height: 200 };
  assert.deepEqual(stickFromPointer(box, 100, 100), { x: 0, y: 0 });
  assert.deepEqual(stickFromPointer(box, 200, 100), { x: 1, y: 0 });
  assert.deepEqual(stickFromPointer(box, 100, 200), { x: 0, y: 1 });
  const corner = stickFromPointer(box, 200, 200);
  assert.ok(Math.abs(Math.hypot(corner.x, corner.y) - 1) < 1e-9);
  assert.ok(corner.x > 0 && corner.y > 0);
  assert.deepEqual(stickFromPointer({ left: 0, top: 0, width: 0, height: 0 }, 10, 10), { x: 0, y: 0 });
});

test("pad picking prefers a Sony controller unless the user chose another", () => {
  const pads = [
    { index: 0, id: "Xbox 360 Controller (STANDARD GAMEPAD)" },
    { index: 2, id: "054c-0ce6-DualSense Wireless Controller" },
  ];
  assert.equal(pickPadIndex(pads, null), 2);
  assert.equal(pickPadIndex(pads, 0), 0);
  assert.equal(pickPadIndex(pads, 9), 2);
  assert.equal(pickPadIndex([], null), null);
});
