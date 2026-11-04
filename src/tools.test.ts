import assert from "node:assert/strict";
import test from "node:test";
import { copy } from "./messages.ts";
import { OTHER_TOOLS, SCREEN_TEST } from "./tools.ts";

const HREFS = [
  "https://robfreak.github.io/consolecheat-ex1/",
  "https://robfreak.github.io/consolecheat-ex2/",
  "https://robfreak.github.io/consolecheat-ex4/",
  "https://robfreak.github.io/consolecheat-ex5/",
  "https://robfreak.github.io/consolecheat-ex6/",
  "https://robfreak.github.io/consolecheat-ex6/bildschirm/",
];

test("the footer lists every other consolecheat tool and not this one", () => {
  assert.deepEqual(
    OTHER_TOOLS.map((tool) => tool.href),
    HREFS,
  );
  assert.deepEqual(
    OTHER_TOOLS.map((tool) => tool.label),
    [
      "Title-ID-Finder",
      "PS-Plus-Archiv",
      "Save-Info-Leser",
      "Fehlercode-Nachschlager",
      "Spiele-Merkliste",
      "Bildschirm-Test",
    ],
  );
  const joined = OTHER_TOOLS.map((tool) => `${tool.href} ${tool.label}`).join("\n");
  assert.equal(joined.includes("consolecheat-ex3"), false);
  assert.equal(joined.includes("Controller-Tester"), false);
  for (const tool of OTHER_TOOLS) {
    const url = new URL(tool.href);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "robfreak.github.io");
  }
  assert.equal(new Set(OTHER_TOOLS.map((tool) => tool.id)).size, OTHER_TOOLS.length);
});

test("Bildschirm-Test is the related screen link", () => {
  assert.equal(SCREEN_TEST.label, "Bildschirm-Test");
  assert.equal(SCREEN_TEST.href, "https://robfreak.github.io/consolecheat-ex6/bildschirm/");
  assert.equal(
    OTHER_TOOLS.some((tool) => tool.href === SCREEN_TEST.href),
    true,
  );
});

test("the tools heading is German and English", () => {
  assert.equal(copy.de.moreTools, "Weitere Werkzeuge");
  assert.equal(copy.en.moreTools, "More tools");
  assert.match(copy.de.screenTestLead, /Fernseher oder Monitor/);
  assert.match(copy.en.screenTestLead, /TV or monitor/);
  assert.equal(copy.fr.moreTools, copy.en.moreTools);
  assert.equal(copy.ja.screenTestLead, copy.en.screenTestLead);
});
