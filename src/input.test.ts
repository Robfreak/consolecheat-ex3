import assert from "node:assert/strict";
import test from "node:test";
import { applySimKeyDown, shouldRunInputLoop, type SimKeyEvent } from "./input.ts";

function key(partial: Partial<SimKeyEvent> & { code: string }, prevented: { n: number }): SimKeyEvent {
  return {
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: null,
    preventDefault: () => {
      prevented.n += 1;
    },
    ...partial,
  };
}

test("a held mapped key is cancelled and a repeat is not pressed again", () => {
  const keys = new Set<string>();
  const prevented = { n: 0 };
  applySimKeyDown(key({ code: "Space" }, prevented), keys, true);
  applySimKeyDown(key({ code: "Space", repeat: true }, prevented), keys, true);
  applySimKeyDown(key({ code: "ArrowDown" }, prevented), keys, true);
  applySimKeyDown(key({ code: "ArrowDown", repeat: true }, prevented), keys, true);
  assert.equal(prevented.n, 4);
  assert.deepEqual([...keys].sort(), ["ArrowDown", "Space"]);
});

test("ctrl, meta, and alt are not intercepted", () => {
  const keys = new Set<string>();
  const prevented = { n: 0 };
  for (const code of ["KeyF", "KeyP", "KeyS", "ArrowDown", "Space"]) {
    applySimKeyDown(key({ code, ctrlKey: true }, prevented), keys, true);
    applySimKeyDown(key({ code, metaKey: true }, prevented), keys, true);
    applySimKeyDown(key({ code, altKey: true }, prevented), keys, true);
  }
  assert.equal(prevented.n, 0);
  assert.equal(keys.size, 0);
});

test("keys are ignored when test mode is off, in a field, or activating a control", () => {
  const keys = new Set<string>();
  const prevented = { n: 0 };
  applySimKeyDown(key({ code: "ArrowDown" }, prevented), keys, false);
  applySimKeyDown(key({ code: "KeyW", target: { tagName: "INPUT" } }, prevented), keys, true);
  applySimKeyDown(key({ code: "KeyW", target: { tagName: "TEXTAREA" } }, prevented), keys, true);
  applySimKeyDown(key({ code: "KeyW", target: { tagName: "SELECT" } }, prevented), keys, true);
  applySimKeyDown(key({ code: "Space", target: { isContentEditable: true } }, prevented), keys, true);
  applySimKeyDown(key({ code: "Space", target: { tagName: "BUTTON" } }, prevented), keys, true);
  applySimKeyDown(key({ code: "Enter", target: { tagName: "A" } }, prevented), keys, true);
  applySimKeyDown(key({ code: "Space", target: { tagName: "SUMMARY" } }, prevented), keys, true);
  applySimKeyDown(key({ code: "KeyK", target: { tagName: "BUTTON" } }, prevented), keys, true);
  assert.equal(prevented.n, 1);
  assert.deepEqual([...keys], ["KeyK"]);
});

test("the input loop runs for test mode and for a connected pad", () => {
  assert.equal(shouldRunInputLoop(false, 0), false);
  assert.equal(shouldRunInputLoop(true, 0), true);
  assert.equal(shouldRunInputLoop(false, 1), true);
  assert.equal(shouldRunInputLoop(true, 2), true);
});
