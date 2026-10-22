import assert from "node:assert/strict";
import test from "node:test";
import {
  DEADZONE,
  DRIFT_THRESHOLD,
  emptyDrift,
  formatAxis,
  formatPercent,
  readDrift,
  settleDrift,
  stickMagnitude,
  updateDrift,
} from "./drift.ts";
import { mapPad } from "./pad.ts";
import { DEMO_DRIFT_LEFT, DEMO_DRIFT_RIGHT, frameFromSim, scriptedBias } from "./sim.ts";

test("centered stick is not drift", () => {
  const reading = settleDrift({ x: 0, y: 0 });
  assert.equal(reading.ready, true);
  assert.equal(reading.drifting, false);
  assert.ok(reading.magnitude < 0.001);
});

test("rest offset at the threshold is not flagged, just above it is", () => {
  assert.equal(DRIFT_THRESHOLD, 0.08);
  assert.equal(settleDrift({ x: DRIFT_THRESHOLD, y: 0 }).drifting, false);
  assert.equal(settleDrift({ x: 0.09, y: 0 }).drifting, true);
  assert.equal(settleDrift({ x: 0, y: -0.09 }).drifting, true);
});

test("a deliberate push does not become the rest offset", () => {
  let memory = emptyDrift();
  for (let i = 0; i < 15; i += 1) memory = updateDrift(memory, { x: 0.9, y: 0.2 });
  const reading = readDrift(memory);
  assert.equal(reading.samples, 0);
  assert.equal(reading.drifting, false);
  assert.equal(reading.rest.x, 0);
});

test("after a push, the released offset is what gets flagged", () => {
  let memory = emptyDrift();
  for (let i = 0; i < 10; i += 1) memory = updateDrift(memory, { x: 1, y: 0 });
  for (let i = 0; i < 40; i += 1) memory = updateDrift(memory, { x: 0.12, y: -0.02 });
  const reading = readDrift(memory);
  assert.equal(reading.drifting, true);
  assert.ok(reading.rest.x > 0.1);
  assert.ok(reading.rest.y < 0);
});

test("two frames through the center do not clear a learned drift", () => {
  let memory = emptyDrift();
  for (let i = 0; i < 40; i += 1) memory = updateDrift(memory, { x: 0.12, y: 0 });
  assert.equal(readDrift(memory).drifting, true);
  memory = updateDrift(memory, { x: 0, y: 0 });
  memory = updateDrift(memory, { x: 0, y: 0 });
  assert.equal(readDrift(memory).drifting, true);
});

test("scripted demo drifts the left stick and leaves the right under the threshold", () => {
  const start = scriptedBias(0);
  const end = scriptedBias(1);
  assert.deepEqual(start.left, { x: 0, y: 0 });
  assert.deepEqual(end.left, DEMO_DRIFT_LEFT);
  assert.deepEqual(end.right, DEMO_DRIFT_RIGHT);
  assert.ok(stickMagnitude(end.left) > DRIFT_THRESHOLD);
  assert.ok(stickMagnitude(end.right) < DRIFT_THRESHOLD);
  assert.ok(stickMagnitude(end.left) < 0.45);
  assert.equal(settleDrift(end.left).drifting, true);
  assert.equal(settleDrift(end.right).drifting, false);
  const mid = scriptedBias(0.5);
  assert.ok(mid.left.x > 0 && mid.left.x < DEMO_DRIFT_LEFT.x);
});

test("hardware and simulated frames share drift detection", () => {
  const hardware = mapPad({
    id: "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)",
    mapping: "standard",
    buttons: [],
    axes: [DEMO_DRIFT_LEFT.x, DEMO_DRIFT_LEFT.y, DEMO_DRIFT_RIGHT.x, DEMO_DRIFT_RIGHT.y],
  });
  const simulated = frameFromSim({
    keys: new Set(),
    pointerButtons: new Set(),
    leftPointer: DEMO_DRIFT_LEFT,
    rightPointer: DEMO_DRIFT_RIGHT,
    biasLeft: { x: 0, y: 0 },
    biasRight: { x: 0, y: 0 },
  });
  assert.deepEqual(simulated.left, hardware.left);
  assert.deepEqual(simulated.right, hardware.right);

  let hardwareLeft = emptyDrift();
  let simulatedLeft = emptyDrift();
  let hardwareRight = emptyDrift();
  let simulatedRight = emptyDrift();
  for (let i = 0; i < 40; i += 1) {
    hardwareLeft = updateDrift(hardwareLeft, hardware.left);
    simulatedLeft = updateDrift(simulatedLeft, simulated.left);
    hardwareRight = updateDrift(hardwareRight, hardware.right);
    simulatedRight = updateDrift(simulatedRight, simulated.right);
  }
  assert.deepEqual(readDrift(hardwareLeft), readDrift(simulatedLeft));
  assert.deepEqual(readDrift(hardwareRight), readDrift(simulatedRight));
  assert.equal(readDrift(hardwareLeft).drifting, true);
  assert.equal(readDrift(hardwareRight).drifting, false);
});

test("axis formatting keeps a sign and three decimals", () => {
  assert.equal(formatAxis(0.18, "en"), "+0.180");
  assert.equal(formatAxis(-0.06, "en"), "-0.060");
  assert.equal(formatAxis(0, "en"), "0.000");
  assert.equal(formatAxis(0.18, "de"), "+0,180");
  assert.equal(formatPercent(0.1897, "de"), "19,0");
  assert.equal(formatPercent(0.05, "en"), "5.0");
  assert.equal(DEADZONE, 0.1);
});
