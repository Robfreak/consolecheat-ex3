import assert from "node:assert/strict";
import test from "node:test";
import { DEADZONE, DRIFT_THRESHOLD, percentPoints } from "./drift.ts";
import { copy, detectLang, fill, languageOptions } from "./messages.ts";

test("German is the fallback and states the unofficial note", () => {
  assert.equal(detectLang([]), "de");
  assert.equal(detectLang(["zz", "en-US"]), "en");
  assert.equal(detectLang(["zh-TW"]), "zh-Hant");
  assert.equal(detectLang(["nb"]), "no");
  assert.equal(copy.de.unofficial, "Inoffiziell. Nicht von Sony.");
  assert.match(copy.de.freeClaim, /kostenlos/);
  assert.match(copy.de.privacyClaim, /nicht gespeichert|Keine Daten werden gespeichert/);
  const text = fill(copy.de.driftExplain, {
    threshold: percentPoints(DRIFT_THRESHOLD),
    deadzone: percentPoints(DEADZONE),
  });
  assert.match(text, /8 %/);
  assert.match(text, /10 %/);
  assert.equal(copy.de.title, "Controller-Tester");
});

test("every language has a full set of strings", () => {
  const keys = Object.keys(copy.de);
  for (const option of languageOptions) {
    const text = copy[option.id];
    for (const key of keys) {
      const value = text[key as keyof typeof text];
      assert.equal(typeof value, "string", `${option.id}.${key}`);
      assert.ok(value.trim().length > 0, `${option.id}.${key}`);
    }
  }
});
