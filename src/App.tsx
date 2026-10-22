import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  DEADZONE,
  DRIFT_THRESHOLD,
  emptyDrift,
  formatAxis,
  formatPercent,
  percentPoints,
  readDrift,
  stickMagnitude,
  updateDrift,
  type DriftMemory,
  type DriftReading,
} from "./drift.ts";
import { ControllerGraphic } from "./graphic.tsx";
import { pulseActuator } from "./haptics.ts";
import { Mark, MoonIcon, SunIcon } from "./icons.tsx";
import { applySimKeyDown, shouldRunInputLoop } from "./input.ts";
import { LegalPage } from "./legal.tsx";
import {
  RTL,
  copy,
  detectLang,
  fill,
  isLang,
  languageOptions,
  type Copy,
  type Lang,
} from "./messages.ts";
import {
  isPressed,
  mapPad,
  pickPadIndex,
  type ButtonId,
  type Frame,
  type Kind,
  type Profile,
  type Vec,
} from "./pad.ts";
import { DRIFT_DEMO_MS, frameFromSim, scriptedBias, stickFromPointer } from "./sim.ts";
import { formatConnectionStatus } from "./status.ts";

type Theme = "light" | "dark";
type Page = "home" | "impressum" | "datenschutz";
type ProfileChoice = "auto" | Profile;

type Model = {
  live: boolean;
  simulated: boolean;
  supported: boolean;
  secure: boolean;
  frame: Frame;
  leftDrift: DriftReading;
  rightDrift: DriftReading;
  deviceId: string;
  padCount: number;
  padIndex: number;
  padIndexes: number[];
  canVibrate: boolean;
  driftPlaying: boolean;
  biasActive: boolean;
};

type SimState = {
  keys: Set<string>;
  pointerButtons: Set<ButtonId>;
  leftPointer: Vec | null;
  rightPointer: Vec | null;
  biasLeft: Vec;
  biasRight: Vec;
  driftLeft: DriftMemory;
  driftRight: DriftMemory;
  demoStarted: number | null;
};

const SYMBOL: Record<ButtonId, string> = {
  cross: "×",
  circle: "○",
  square: "□",
  triangle: "△",
  l1: "L1",
  r1: "R1",
  l2: "L2",
  r2: "R2",
  share: "Share",
  options: "Opt",
  l3: "L3",
  r3: "R3",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  ps: "PS",
  touchpad: "▭",
};

const GROUPS: { heading: "buttonsHeading" | "dpad"; ids: ButtonId[] }[] = [
  { heading: "buttonsHeading", ids: ["cross", "circle", "square", "triangle", "l1", "r1", "l2", "r2"] },
  { heading: "dpad", ids: ["up", "down", "left", "right", "share", "options", "ps", "touchpad", "l3", "r3"] },
];

function readPage(): Page {
  const hash = location.hash.replace(/^#\/?/, "");
  if (hash === "impressum") return "impressum";
  if (hash === "datenschutz") return "datenschutz";
  return "home";
}

function readLang(): Lang {
  try {
    const stored = localStorage.getItem("consolecheat-lang");
    if (isLang(stored)) return stored;
    return detectLang(navigator.languages);
  } catch {
    return "de";
  }
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function readDemo(): boolean {
  return new URLSearchParams(location.search).get("demo") === "1";
}

function writeDemo(on: boolean) {
  const url = new URL(location.href);
  if (on) url.searchParams.set("demo", "1");
  else url.searchParams.delete("demo");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function applyLang(next: Lang) {
  document.documentElement.lang = next;
  document.documentElement.dir = RTL.has(next) ? "rtl" : "ltr";
  localStorage.setItem("consolecheat-lang", next);
}

function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  localStorage.setItem("consolecheat-theme", next);
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", next === "light" ? "#f4f1eb" : "#07090e");
}

function emptySim(): SimState {
  return {
    keys: new Set(),
    pointerButtons: new Set(),
    leftPointer: null,
    rightPointer: null,
    biasLeft: { x: 0, y: 0 },
    biasRight: { x: 0, y: 0 },
    driftLeft: emptyDrift(),
    driftRight: emptyDrift(),
    demoStarted: null,
  };
}

function zeroModel(demo: boolean): Model {
  const frame = mapPad({
    id: demo ? "simulated" : "",
    mapping: demo ? "standard" : "",
    buttons: [],
    axes: [0, 0, 0, 0],
  });
  return {
    live: false,
    simulated: demo,
    supported: typeof navigator !== "undefined" && typeof navigator.getGamepads === "function",
    secure: typeof window !== "undefined" ? window.isSecureContext : true,
    frame,
    leftDrift: readDrift(emptyDrift()),
    rightDrift: readDrift(emptyDrift()),
    deviceId: "",
    padCount: 0,
    padIndex: -1,
    padIndexes: [],
    canVibrate: false,
    driftPlaying: false,
    biasActive: false,
  };
}

function connectedPads(): Gamepad[] {
  try {
    const list = navigator.getGamepads?.();
    if (!list) return [];
    return Array.from(list).filter((pad): pad is Gamepad => pad !== null && pad.connected);
  } catch {
    return [];
  }
}

function canRumble(pad: Gamepad): boolean {
  const actuator = pad.vibrationActuator as { playEffect?: unknown } | null;
  if (actuator && typeof actuator.playEffect === "function") return true;
  const extra = pad as Gamepad & { hapticActuators?: unknown[] };
  return Array.isArray(extra.hapticActuators) && extra.hapticActuators.length > 0;
}

async function rumble(pad: Gamepad): Promise<"ok" | "no"> {
  const actuator = pad.vibrationActuator as {
    playEffect?: (type: string, params: GamepadEffectParameters) => Promise<unknown>;
  } | null;
  if (actuator && typeof actuator.playEffect === "function") {
    try {
      await actuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration: 500,
        weakMagnitude: 0.5,
        strongMagnitude: 0.85,
      });
      return "ok";
    } catch {
      /* Firefox and some pads reject the effect name. */
    }
  }
  const haptic = (pad as Gamepad & { hapticActuators?: { pulse?: (value: number, duration: number) => Promise<unknown> }[] })
    .hapticActuators?.[0];
  const pulsed = pulseActuator(haptic, 0.7, 500);
  if (!pulsed) return "no";
  try {
    await pulsed;
    return "ok";
  } catch {
    return "no";
  }
}

function kindName(t: Copy, kind: Kind): string {
  if (kind === "dualshock4") return t.kindDs4;
  if (kind === "dualsense") return t.kindDs5;
  if (kind === "simulated") return t.simName;
  if (kind === "standard") return t.kindStandard;
  return t.kindUnknown;
}

function profileName(t: Copy, profile: Profile): string {
  if (profile === "sony-hid") return t.mapHid;
  if (profile === "sony-kernel") return t.mapKernel;
  return t.mapStandard;
}

function buttonLabel(t: Copy, id: ButtonId): string {
  if (id === "cross") return t.cross;
  if (id === "circle") return t.circle;
  if (id === "square") return t.square;
  if (id === "triangle") return t.triangle;
  if (id === "share") return t.share;
  if (id === "options") return t.options;
  if (id === "touchpad") return t.touchpad;
  if (id === "ps") return t.ps;
  if (id === "up") return t.up;
  if (id === "down") return t.down;
  if (id === "left") return t.left;
  if (id === "right") return t.right;
  if (id === "l1") return "L1";
  if (id === "r1") return "R1";
  if (id === "l2") return "L2";
  if (id === "r2") return "R2";
  if (id === "l3") return "L3";
  return "R3";
}

export function App() {
  const [lang, setLang] = useState<Lang>(readLang);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [page, setPage] = useState<Page>(readPage);
  const [demoOn, setDemoOn] = useState(readDemo);
  const [profileOverride, setProfileOverride] = useState<ProfileChoice>("auto");
  const [model, setModel] = useState<Model>(() => zeroModel(readDemo()));
  const [vibe, setVibe] = useState("");
  const [driftMsg, setDriftMsg] = useState("");
  const t = copy[lang];
  const demoRef = useRef(demoOn);
  const pageRef = useRef(page);
  const simRef = useRef<SimState>(emptySim());
  const hardwareDrift = useRef({ left: emptyDrift(), right: emptyDrift(), padIndex: -1 });
  const preferredIndex = useRef<number | null>(null);
  const activeIndex = useRef(-1);
  demoRef.current = demoOn;
  pageRef.current = page;

  useEffect(() => {
    applyLang(lang);
  }, [lang]);

  useEffect(() => {
    const sync = () => setPage(readPage());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    const name = page === "impressum" ? "Impressum" : page === "datenschutz" ? "Datenschutz" : t.title;
    document.title = `${name} · consolecheat`;
    if (page !== "home") window.scrollTo(0, 0);
  }, [page, t.title]);

  useEffect(() => {
    const sim = simRef.current;
    sim.keys.clear();
    sim.pointerButtons.clear();
    sim.leftPointer = null;
    sim.rightPointer = null;
    sim.demoStarted = null;
    sim.biasLeft = { x: 0, y: 0 };
    sim.biasRight = { x: 0, y: 0 };
    sim.driftLeft = emptyDrift();
    sim.driftRight = emptyDrift();
    hardwareDrift.current = { left: emptyDrift(), right: emptyDrift(), padIndex: -1 };
    setVibe("");
  }, [demoOn]);

  useEffect(() => {
    hardwareDrift.current = { left: emptyDrift(), right: emptyDrift(), padIndex: -1 };
  }, [profileOverride]);

  useEffect(() => {
    const sim = simRef.current;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      applySimKeyDown(
        {
          code: event.code,
          repeat: event.repeat,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          target,
          preventDefault: () => event.preventDefault(),
        },
        sim.keys,
        demoRef.current && pageRef.current === "home",
      );
    }
    function onKeyUp(event: KeyboardEvent) {
      sim.keys.delete(event.code);
    }
    function onBlur() {
      sim.keys.clear();
      sim.pointerButtons.clear();
      sim.leftPointer = null;
      sim.rightPointer = null;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    if (page !== "home") return;
    let raf = 0;
    let running = false;
    let idle = false;

    const stop = () => {
      cancelAnimationFrame(raf);
      running = false;
      if (!idle) {
        setModel(zeroModel(false));
        idle = true;
      }
    };

    const tick = () => {
      if (!demoOn && !shouldRunInputLoop(false, connectedPads().length)) {
        stop();
        return;
      }
      const sim = simRef.current;
      const supported = typeof navigator.getGamepads === "function";
      const secure = window.isSecureContext;
      let frame: Frame;
      let leftMemory: DriftMemory;
      let rightMemory: DriftMemory;
      let live = false;
      let deviceId = "";
      let padIndexes: number[] = [];
      let padIndex = -1;
      let canVibrate = false;

      if (demoOn) {
        if (sim.demoStarted !== null) {
          const progress = (performance.now() - sim.demoStarted) / DRIFT_DEMO_MS;
          const bias = scriptedBias(Math.min(1, Math.max(0, progress)));
          sim.biasLeft = bias.left;
          sim.biasRight = bias.right;
          if (progress >= 1) sim.demoStarted = null;
        }
        frame = frameFromSim({
          keys: sim.keys,
          pointerButtons: sim.pointerButtons,
          leftPointer: sim.leftPointer,
          rightPointer: sim.rightPointer,
          biasLeft: sim.biasLeft,
          biasRight: sim.biasRight,
        });
        sim.driftLeft = updateDrift(sim.driftLeft, frame.left);
        sim.driftRight = updateDrift(sim.driftRight, frame.right);
        leftMemory = sim.driftLeft;
        rightMemory = sim.driftRight;
        activeIndex.current = -1;
      } else {
        const pads = connectedPads();
        padIndexes = pads.map((pad) => pad.index);
        const picked = pickPadIndex(
          pads.map((pad) => ({ index: pad.index, id: pad.id })),
          preferredIndex.current,
        );
        const pad = picked === null ? null : (pads.find((item) => item.index === picked) ?? null);
        if (pad) {
          live = true;
          padIndex = pad.index;
          activeIndex.current = pad.index;
          deviceId = pad.id;
          canVibrate = canRumble(pad);
          if (hardwareDrift.current.padIndex !== pad.index) {
            hardwareDrift.current = { left: emptyDrift(), right: emptyDrift(), padIndex: pad.index };
          }
          const raw = { id: pad.id, mapping: pad.mapping, buttons: pad.buttons, axes: pad.axes };
          frame = profileOverride === "auto" ? mapPad(raw) : mapPad(raw, profileOverride);
          hardwareDrift.current.left = updateDrift(hardwareDrift.current.left, frame.left);
          hardwareDrift.current.right = updateDrift(hardwareDrift.current.right, frame.right);
          leftMemory = hardwareDrift.current.left;
          rightMemory = hardwareDrift.current.right;
        } else {
          frame = mapPad({ id: "", mapping: "", buttons: [], axes: [] });
          leftMemory = emptyDrift();
          rightMemory = emptyDrift();
          activeIndex.current = -1;
        }
      }

      const biasSize = Math.max(stickMagnitude(sim.biasLeft), stickMagnitude(sim.biasRight));
      const next: Model = {
        live,
        simulated: demoOn,
        supported,
        secure,
        frame,
        leftDrift: readDrift(leftMemory),
        rightDrift: readDrift(rightMemory),
        deviceId,
        padCount: padIndexes.length,
        padIndex,
        padIndexes,
        canVibrate,
        driftPlaying: sim.demoStarted !== null,
        biasActive: sim.demoStarted !== null || biasSize > 0.001,
      };
      const idleNow = !next.live && !next.simulated;
      if (!(idle && idleNow)) setModel(next);
      idle = idleNow;
      raf = requestAnimationFrame(tick);
    };

    const arm = () => {
      if (running) return;
      running = true;
      idle = false;
      raf = requestAnimationFrame(tick);
    };

    const onConnect = () => arm();
    const onDisconnect = () => {
      if (!demoOn && connectedPads().length === 0) stop();
    };

    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onDisconnect);
    const present = demoOn ? 0 : connectedPads().length;
    if (shouldRunInputLoop(demoOn, present)) arm();
    else setModel(zeroModel(false));

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
    };
  }, [demoOn, profileOverride, page]);

  useEffect(() => {
    if (!model.live && !model.simulated) {
      setDriftMsg("");
      return;
    }
    const left = model.leftDrift.ready
      ? `${t.leftStick}: ${model.leftDrift.drifting ? t.driftYes : t.driftNo}`
      : `${t.leftStick}: ${t.driftWait}`;
    const right = model.rightDrift.ready
      ? `${t.rightStick}: ${model.rightDrift.drifting ? t.driftYes : t.driftNo}`
      : `${t.rightStick}: ${t.driftWait}`;
    const next = `${left}. ${right}.`;
    setDriftMsg((prev) => (prev === next ? prev : next));
  }, [model.live, model.simulated, model.leftDrift.ready, model.leftDrift.drifting, model.rightDrift.ready, model.rightDrift.drifting, t]);

  function chooseDemo(on: boolean) {
    setDemoOn(on);
    writeDemo(on);
  }

  function pressButton(id: ButtonId, down: boolean) {
    if (!demoRef.current) return;
    if (down) simRef.current.pointerButtons.add(id);
    else simRef.current.pointerButtons.delete(id);
  }

  function moveStick(which: "left" | "right", event: ReactPointerEvent<HTMLDivElement>) {
    if (!demoRef.current) return;
    const point = stickFromPointer(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
    if (which === "left") simRef.current.leftPointer = point;
    else simRef.current.rightPointer = point;
  }

  function endStick(which: "left" | "right") {
    if (which === "left") simRef.current.leftPointer = null;
    else simRef.current.rightPointer = null;
  }

  function playDrift() {
    const sim = simRef.current;
    sim.driftLeft = emptyDrift();
    sim.driftRight = emptyDrift();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const end = scriptedBias(1);
      sim.biasLeft = end.left;
      sim.biasRight = end.right;
      sim.demoStarted = null;
      return;
    }
    sim.biasLeft = { x: 0, y: 0 };
    sim.biasRight = { x: 0, y: 0 };
    sim.demoStarted = performance.now();
  }

  function clearDrift() {
    const sim = simRef.current;
    sim.demoStarted = null;
    sim.biasLeft = { x: 0, y: 0 };
    sim.biasRight = { x: 0, y: 0 };
    sim.driftLeft = emptyDrift();
    sim.driftRight = emptyDrift();
  }

  async function onVibrate() {
    if (demoRef.current) {
      setVibe(t.vibrateSim);
      return;
    }
    const pad = connectedPads().find((item) => item.index === activeIndex.current) ?? null;
    if (!pad) {
      setVibe(t.vibrateNo);
      return;
    }
    const result = await rumble(pad);
    setVibe(result === "ok" ? t.vibrateDone : t.vibrateNo);
  }

  const showLive = model.live || model.simulated;
  const zones = {
    threshold: percentPoints(DRIFT_THRESHOLD),
    deadzone: percentPoints(DEADZONE),
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="https://consolecheat.com" className="flex min-w-0 items-center gap-3">
            <Mark />
            <span className="truncate font-display text-lg font-semibold tracking-tight">{t.brand}</span>
          </a>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="lang">
              {t.language}
            </label>
            <select
              id="lang"
              value={lang}
              onChange={(event) => {
                if (isLang(event.target.value)) setLang(event.target.value);
              }}
              className="h-11 w-28 rounded-lg border border-line bg-surface px-2 text-sm text-fg sm:w-36"
            >
              {languageOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={theme === "dark" ? t.themeLight : t.themeDark}
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                setTheme(next);
                applyTheme(next);
              }}
              className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-fg"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      {page === "home" ? (
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="eyebrow text-xs font-medium uppercase text-steel">{t.eyebrow}</p>
          <h1 className="display-title mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{t.lede}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <p className="panel rounded-xl px-4 py-4 text-base font-medium leading-relaxed text-fg">{t.freeClaim}</p>
            <p className="panel rounded-xl px-4 py-4 text-base font-medium leading-relaxed text-fg">{t.privacyClaim}</p>
          </div>
          <p className="mt-4 text-sm text-subtle">{t.unofficial}</p>

          <section className="mt-10" aria-labelledby="live-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="live-heading" className="font-display text-2xl font-semibold tracking-tight">
                {t.section}
              </h2>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t.modeLabel}>
                <button
                  type="button"
                  data-testid="mode-hardware"
                  aria-pressed={!demoOn}
                  onClick={() => chooseDemo(false)}
                  className={pillClass(!demoOn)}
                >
                  {t.modeHardware}
                </button>
                <button
                  type="button"
                  data-testid="mode-test"
                  aria-pressed={demoOn}
                  onClick={() => chooseDemo(true)}
                  className={pillClass(demoOn)}
                >
                  {t.modeTest}
                </button>
              </div>
            </div>

            {model.simulated ? (
              <div className="panel mark-selected mt-4 rounded-xl px-4 py-4">
                <p className="text-base font-medium leading-relaxed">{t.testNote}</p>
                <p className="mt-1 text-sm text-muted">{t.ignoreHardware}</p>
                <p className="mt-1 text-sm text-subtle">{t.demoLink}</p>
              </div>
            ) : null}

            <p className="sr-only" aria-live="polite">
              {driftMsg}
            </p>

            {!showLive ? (
              <div className="panel mt-4 rounded-xl px-5 py-6" data-testid="waiting">
                <h3 className="font-display text-xl font-semibold tracking-tight">{t.waitingTitle}</h3>
                <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 text-base leading-relaxed text-muted">
                  <li>{t.hintPress}</li>
                  <li>{t.hintBrowser}</li>
                  <li>{t.hintLink}</li>
                  {!model.secure ? <li>{t.hintSecure}</li> : null}
                  {!model.supported ? <li>{t.hintUnsupported}</li> : null}
                </ul>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                <p className="text-sm text-muted" data-testid="status">
                  {formatConnectionStatus({
                    simulated: model.simulated,
                    simName: t.simName,
                    connected: fill(t.connected, { name: kindName(t, model.frame.kind) }),
                    profileLabel: profileName(t, model.frame.profile),
                  })}
                </p>

                {!model.simulated && model.padCount > 1 ? (
                  <label className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    {t.padLabel}
                    <select
                      value={model.padIndex}
                      onChange={(event) => {
                        preferredIndex.current = Number(event.target.value);
                      }}
                      className="h-11 rounded-lg border border-line bg-surface px-2 text-sm text-fg"
                    >
                      {model.padIndexes.map((index) => (
                        <option key={index} value={index}>
                          {index + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {!model.simulated ? (
                  <label className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    {t.mapLabel}
                    <select
                      data-testid="mapping"
                      value={profileOverride}
                      onChange={(event) => setProfileOverride(event.target.value as ProfileChoice)}
                      className="h-11 rounded-lg border border-line bg-surface px-2 text-sm text-fg"
                    >
                      <option value="auto">{t.mapAuto}</option>
                      <option value="standard">{t.mapStandard}</option>
                      <option value="sony-hid">{t.mapHid}</option>
                      <option value="sony-kernel">{t.mapKernel}</option>
                    </select>
                  </label>
                ) : null}

                <div className="panel rounded-xl p-4 sm:p-6">
                  <ControllerGraphic
                    frame={model.frame}
                    leftDrift={model.leftDrift}
                    rightDrift={model.rightDrift}
                    demo={model.simulated}
                    onButton={pressButton}
                  />
                  <p className="mt-3 text-sm text-subtle">
                    {model.frame.kind === "dualshock4" ? t.layoutNoteDs4 : t.layoutNoteDs}
                  </p>
                </div>

                <div className="panel rounded-xl p-4 sm:p-6">
                  {GROUPS.map((group) => (
                    <div key={group.heading} className="mt-4 first:mt-0">
                      <h3 className="text-sm font-semibold tracking-wide text-subtle">{t[group.heading]}</h3>
                      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {group.ids.map((id) => (
                          <ButtonCell
                            key={id}
                            id={id}
                            value={model.frame.buttons[id]}
                            label={buttonLabel(t, id)}
                            symbol={SYMBOL[id]}
                            pressedWord={t.pressed}
                            demo={model.simulated}
                            onPress={pressButton}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="panel rounded-xl p-4 sm:p-6">
                  <h3 className="font-display text-xl font-semibold tracking-tight">{t.triggersHeading}</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <TriggerMeter label="L2" value={model.frame.buttons.l2} testId="l2-bar" lang={lang} />
                    <TriggerMeter label="R2" value={model.frame.buttons.r2} testId="r2-bar" lang={lang} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" data-testid="vibrate" onClick={() => void onVibrate()} className={pillClass(true)}>
                      {t.vibrate}
                    </button>
                    {vibe ? (
                      <p className="text-sm text-muted" aria-live="polite">
                        {vibe}
                      </p>
                    ) : (
                      <p className="text-sm text-subtle">{model.simulated || !model.canVibrate ? (model.simulated ? t.vibrateSim : t.vibrateNo) : null}</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-xl font-semibold tracking-tight">{t.sticksHeading}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{fill(t.driftExplain, zones)}</p>
                  <p className="mt-1 text-sm text-subtle">{t.yNote}</p>
                  <p className="mt-1 text-sm text-subtle">{fill(t.zoneLegend, zones)}</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <StickPanel
                      title={t.leftStick}
                      testId="stick-left"
                      stick={model.frame.left}
                      drift={model.leftDrift}
                      lang={lang}
                      t={t}
                      demo={model.simulated}
                      onDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        moveStick("left", event);
                      }}
                      onMove={(event) => {
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) moveStick("left", event);
                      }}
                      onUp={() => endStick("left")}
                    />
                    <StickPanel
                      title={t.rightStick}
                      testId="stick-right"
                      stick={model.frame.right}
                      drift={model.rightDrift}
                      lang={lang}
                      t={t}
                      demo={model.simulated}
                      onDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        moveStick("right", event);
                      }}
                      onMove={(event) => {
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) moveStick("right", event);
                      }}
                      onUp={() => endStick("right")}
                    />
                  </div>
                </div>

                {model.simulated ? (
                  <div className="panel rounded-xl p-4 sm:p-6">
                    <h3 className="font-display text-xl font-semibold tracking-tight">{t.keysHeading}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{t.keysBody}</p>
                    <p className="mt-2 text-sm text-subtle">{t.mouseHint}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" data-testid="drift-play" onClick={playDrift} className={pillClass(true)}>
                        {t.driftPlay}
                      </button>
                      {model.biasActive ? (
                        <button type="button" data-testid="drift-clear" onClick={clearDrift} className={pillClass(false)}>
                          {t.driftClear}
                        </button>
                      ) : null}
                    </div>
                    {model.driftPlaying ? <p className="mt-3 text-sm text-muted">{t.driftPlaying}</p> : null}
                  </div>
                ) : null}

                {model.deviceId ? (
                  <details className="panel rounded-xl px-4 py-3 text-sm text-muted">
                    <summary className="cursor-pointer font-medium text-fg">{t.device}</summary>
                    <p className="mt-2 break-all font-mono text-xs leading-relaxed" dir="ltr">
                      {model.deviceId}
                    </p>
                  </details>
                ) : null}
              </div>
            )}

            <details className="mt-6 text-sm leading-relaxed text-muted">
              <summary className="cursor-pointer font-medium text-fg">{t.supportHeading}</summary>
              <ul className="mt-3 flex list-disc flex-col gap-2 ps-5">
                <li>{t.hintPress}</li>
                <li>{t.hintBrowser}</li>
                <li>{t.hintLink}</li>
                <li>{t.hintSecure}</li>
                <li>{t.supportExtra}</li>
              </ul>
            </details>
          </section>
        </main>
      ) : (
        <LegalPage
          page={page}
          homeHref={`${import.meta.env.BASE_URL}${location.search}`}
          onHome={(event) => {
            event.preventDefault();
            history.pushState(null, "", `${location.pathname}${location.search}`);
            setPage("home");
            window.scrollTo(0, 0);
          }}
        />
      )}

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm leading-relaxed text-subtle sm:px-6">
          <p className="text-fg">{t.brand}</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Impressum und Datenschutz">
            <a href="#impressum" className="text-steel underline-offset-4 hover:underline">
              Impressum
            </a>
            <a href="#datenschutz" className="text-steel underline-offset-4 hover:underline">
              Datenschutz
            </a>
          </nav>
          <p>{t.freeClaim}</p>
          <p>{t.privacyClaim}</p>
          <p>{t.footerNote}</p>
        </div>
      </footer>
    </div>
  );
}

function pillClass(on: boolean): string {
  return on
    ? "h-11 rounded-lg border border-accent bg-accent px-4 text-sm font-medium text-accent-fg"
    : "h-11 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg";
}

function ButtonCell({
  id,
  value,
  label,
  symbol,
  pressedWord,
  demo,
  onPress,
}: {
  id: ButtonId;
  value: number;
  label: string;
  symbol: string;
  pressedWord: string;
  demo: boolean;
  onPress: (id: ButtonId, down: boolean) => void;
}) {
  const on = isPressed(value);
  return (
    <li>
      <button
        type="button"
        data-button={id}
        data-on={on ? "1" : "0"}
        aria-pressed={on}
        className={
          "flex min-h-16 w-full flex-col items-start justify-center rounded-lg border px-3 py-2 text-start " +
          (on ? "border-accent bg-accent text-accent-fg" : "border-line bg-raised text-fg")
        }
        onPointerDown={(event) => {
          if (!demo) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          onPress(id, true);
        }}
        onPointerUp={() => onPress(id, false)}
        onPointerCancel={() => onPress(id, false)}
      >
        <span className="text-lg leading-none">{symbol}</span>
        <span className="mt-1 text-sm font-medium">
          {label}
          {on ? ` · ${pressedWord}` : ""}
        </span>
        {id === "l2" || id === "r2" ? (
          <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg">
            <span className="block h-full rounded-full bg-current" style={{ width: `${Math.round(value * 100)}%` }} />
          </span>
        ) : null}
      </button>
    </li>
  );
}

function TriggerMeter({ label, value, testId, lang }: { label: string; value: number; testId: string; lang: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">{formatPercent(value, lang)} %</span>
      </div>
      <div
        className="mt-2 h-4 overflow-hidden rounded-full bg-bg"
        data-testid={testId}
        data-value={value.toFixed(3)}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StickPanel({
  title,
  testId,
  stick,
  drift,
  lang,
  t,
  demo,
  onDown,
  onMove,
  onUp,
}: {
  title: string;
  testId: string;
  stick: Vec;
  drift: DriftReading;
  lang: string;
  t: Copy;
  demo: boolean;
  onDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onUp: () => void;
}) {
  const flag = !drift.ready ? "wait" : drift.drifting ? "yes" : "no";
  return (
    <div className="panel rounded-xl p-4 sm:p-5" data-testid={testId} data-drift={flag} data-ready={drift.ready ? "1" : "0"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
        <span className={`rounded-md px-2 py-1 text-sm font-semibold ${flag === "yes" ? "flag-drift" : flag === "no" ? "flag-ok" : "flag-wait"}`}>
          {flag === "yes" ? t.driftYes : flag === "no" ? t.driftNo : t.driftWait}
        </span>
      </div>
      <div
        className="stick-well relative mx-auto mt-4 aspect-square w-full max-w-[280px] rounded-full border"
        style={{
          borderColor: drift.drifting ? "var(--color-bad)" : "var(--color-line)",
          touchAction: demo ? "none" : "auto",
          cursor: demo ? "crosshair" : "default",
        }}
        onPointerDown={demo ? onDown : undefined}
        onPointerMove={demo ? onMove : undefined}
        onPointerUp={demo ? onUp : undefined}
        onPointerCancel={demo ? onUp : undefined}
      >
        <Ring amount={DRIFT_THRESHOLD} dashed />
        <Ring amount={DEADZONE} />
        {drift.ready ? <Dot x={drift.rest.x} y={drift.rest.y} hollow drifting={drift.drifting} /> : null}
        <Dot x={stick.x} y={stick.y} />
      </div>
      <dl className="mt-4 grid gap-1 text-sm tabular-nums text-muted">
        <div className="flex justify-between gap-3" data-testid={`${testId}-pos`}>
          <dt>{t.position}</dt>
          <dd dir="ltr">
            X {formatAxis(stick.x, lang)} · Y {formatAxis(stick.y, lang)}
          </dd>
        </div>
        <div className="flex justify-between gap-3" data-testid={`${testId}-rest`}>
          <dt>{t.rest}</dt>
          <dd dir="ltr">
            X {formatAxis(drift.rest.x, lang)} · Y {formatAxis(drift.rest.y, lang)}
          </dd>
        </div>
        <div className="flex justify-between gap-3" data-testid={`${testId}-amount`}>
          <dt>{t.amount}</dt>
          <dd dir="ltr">{formatPercent(drift.magnitude, lang)} %</dd>
        </div>
      </dl>
    </div>
  );
}

function Ring({ amount, dashed }: { amount: number; dashed?: boolean }) {
  const size = `${amount * 100}%`;
  return (
    <span
      className="pointer-events-none absolute rounded-full border"
      style={{
        width: size,
        height: size,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: dashed ? "var(--color-bad)" : "var(--color-steel)",
      }}
    />
  );
}

function Dot({ x, y, hollow, drifting }: { x: number; y: number; hollow?: boolean; drifting?: boolean }) {
  return (
    <span
      className="pointer-events-none absolute size-5 rounded-full"
      style={{
        left: `${((x + 1) / 2) * 100}%`,
        top: `${((y + 1) / 2) * 100}%`,
        transform: "translate(-50%, -50%)",
        background: hollow ? "transparent" : "var(--color-accent)",
        boxShadow: hollow ? `inset 0 0 0 2px ${drifting ? "var(--color-bad)" : "var(--color-steel)"}` : "none",
      }}
    />
  );
}
