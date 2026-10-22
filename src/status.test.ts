import assert from "node:assert/strict";
import test from "node:test";
import { formatConnectionStatus } from "./status.ts";

test("the status line shows the localized mapping once", () => {
  const line = formatConnectionStatus({
    simulated: false,
    simName: "Simulierter Controller",
    connected: "Verbunden · DualSense",
    profileLabel: "Standard",
  });
  assert.equal(line, "Verbunden · DualSense · Standard");
  assert.equal(line.includes("standard"), false);
});

test("test mode status is only the simulated name", () => {
  assert.equal(
    formatConnectionStatus({
      simulated: true,
      simName: "Simulierter Controller",
      connected: "Verbunden · DualSense",
      profileLabel: "Standard",
    }),
    "Simulierter Controller",
  );
});
