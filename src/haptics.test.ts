import assert from "node:assert/strict";
import test from "node:test";
import { pulseActuator } from "./haptics.ts";

test("pulse is invoked as a method on the actuator", async () => {
  let receiver: unknown = "missing";
  const actuator = {
    pulse(this: unknown, value: number, duration: number) {
      receiver = this;
      assert.equal(value, 0.7);
      assert.equal(duration, 500);
      return Promise.resolve("done");
    },
  };
  assert.equal(await pulseActuator(actuator, 0.7, 500), "done");
  assert.equal(receiver, actuator);
});

test("a missing haptic actuator does not throw", () => {
  assert.equal(pulseActuator(undefined, 0.7, 500), null);
  assert.equal(pulseActuator(null, 0.7, 500), null);
  assert.equal(pulseActuator({}, 0.7, 500), null);
});
