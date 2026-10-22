import { HANDLED_KEYS } from "./sim.ts";

export type KeyTarget = { tagName?: string; isContentEditable?: boolean } | null;

export type SimKeyEvent = {
  code: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: KeyTarget;
  preventDefault: () => void;
};

function isTypingTarget(target: KeyTarget): boolean {
  if (target === null) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function isControlActivation(event: SimKeyEvent): boolean {
  const tag = event.target?.tagName ?? "";
  return (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") && (event.code === "Space" || event.code === "Enter");
}

/**
 * Claim a test-mode key. preventDefault runs before a repeat is dropped,
 * so holding Space or an arrow key does not scroll. Ctrl, Alt, and Meta
 * stay with the browser.
 */
export function applySimKeyDown(event: SimKeyEvent, keys: Set<string>, active: boolean): void {
  if (!active || event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTypingTarget(event.target) || isControlActivation(event)) return;
  if (!HANDLED_KEYS.has(event.code)) return;
  event.preventDefault();
  if (event.repeat) return;
  keys.add(event.code);
}

/** Keep the animation frame running for the simulated pad, or while a real pad is connected. */
export function shouldRunInputLoop(demo: boolean, connectedCount: number): boolean {
  return demo || connectedCount > 0;
}
