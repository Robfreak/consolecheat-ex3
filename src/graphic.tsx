import { isPressed, type ButtonId, type Frame, type Vec } from "./pad.ts";
import type { DriftReading } from "./drift.ts";

const VW = 800;
const VH = 460;

type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };

type Layout = {
  l2: Rect;
  r2: Rect;
  l1: Rect;
  r1: Rect;
  dpad: Point;
  face: Point;
  stickL: Point;
  stickR: Point;
  share: Point;
  options: Point;
  touch: Rect;
  ps: Point;
};

const dualsense: Layout = {
  l2: { x: 148, y: 34, w: 156, h: 16 },
  r2: { x: 496, y: 34, w: 156, h: 16 },
  l1: { x: 156, y: 78, w: 140, h: 32 },
  r1: { x: 504, y: 78, w: 140, h: 32 },
  stickL: { x: 236, y: 178 },
  dpad: { x: 178, y: 292 },
  face: { x: 622, y: 178 },
  stickR: { x: 568, y: 292 },
  share: { x: 332, y: 168 },
  options: { x: 468, y: 168 },
  touch: { x: 400, y: 236, w: 156, h: 78 },
  ps: { x: 400, y: 318 },
};

const dualshock4: Layout = {
  ...dualsense,
  dpad: { x: 176, y: 176 },
  stickL: { x: 252, y: 300 },
  face: { x: 624, y: 176 },
  stickR: { x: 548, y: 300 },
  share: { x: 332, y: 196 },
  options: { x: 468, y: 196 },
  touch: { x: 400, y: 248, w: 150, h: 64 },
  ps: { x: 400, y: 330 },
};

const FACE: { id: ButtonId; dx: number; dy: number; label: string }[] = [
  { id: "triangle", dx: 0, dy: -38, label: "△" },
  { id: "circle", dx: 38, dy: 0, label: "○" },
  { id: "cross", dx: 0, dy: 38, label: "×" },
  { id: "square", dx: -38, dy: 0, label: "□" },
];

const DPAD: { id: ButtonId; dx: number; dy: number; label: string }[] = [
  { id: "up", dx: 0, dy: -24, label: "↑" },
  { id: "down", dx: 0, dy: 24, label: "↓" },
  { id: "left", dx: -24, dy: 0, label: "←" },
  { id: "right", dx: 24, dy: 0, label: "→" },
];

function lit(value: number): string {
  return isPressed(value) ? "var(--color-accent)" : "var(--color-surface)";
}

function ink(value: number): string {
  return isPressed(value) ? "var(--color-accent-fg)" : "var(--color-fg)";
}

function TriggerBar({ track, value, fromRight }: { track: Rect; value: number; fromRight?: boolean }) {
  const width = Math.max(0, Math.min(1, value)) * track.w;
  const x = fromRight ? track.x + track.w - width : track.x;
  return (
    <g>
      <rect x={track.x} y={track.y} width={track.w} height={track.h} rx="8" fill="var(--color-bg)" stroke="var(--color-line)" />
      {width > 0.5 ? <rect x={x} y={track.y} width={width} height={track.h} rx="8" fill="var(--color-accent)" /> : null}
    </g>
  );
}

function Stick({
  at,
  stick,
  pressed,
  rest,
  showRest,
  drifting,
}: {
  at: Point;
  stick: Vec;
  pressed: boolean;
  rest: Vec;
  showRest: boolean;
  drifting: boolean;
}) {
  const travel = 18;
  return (
    <g>
      <circle cx={at.x} cy={at.y} r="30" fill="var(--color-bg)" stroke="var(--color-line)" />
      {showRest ? (
        <circle
          cx={at.x + rest.x * travel}
          cy={at.y + rest.y * travel}
          r="8"
          fill="none"
          stroke={drifting ? "var(--color-bad)" : "var(--color-steel)"}
          strokeDasharray="2 2"
        />
      ) : null}
      <circle
        cx={at.x + stick.x * travel}
        cy={at.y + stick.y * travel}
        r="16"
        fill={pressed ? "var(--color-accent)" : "var(--color-raised)"}
        stroke="var(--color-line)"
        strokeWidth="2"
      />
    </g>
  );
}

export function ControllerGraphic({
  frame,
  leftDrift,
  rightDrift,
  demo,
  onButton,
}: {
  frame: Frame;
  leftDrift: DriftReading;
  rightDrift: DriftReading;
  demo: boolean;
  onButton: (id: ButtonId, down: boolean) => void;
}) {
  const layout = frame.kind === "dualshock4" ? dualshock4 : dualsense;
  const b = frame.buttons;
  const hits: { id: ButtonId; x: number; y: number; w: number; h: number }[] = [
    { id: "l1", x: layout.l1.x + layout.l1.w / 2, y: layout.l1.y + layout.l1.h / 2, w: layout.l1.w, h: layout.l1.h },
    { id: "r1", x: layout.r1.x + layout.r1.w / 2, y: layout.r1.y + layout.r1.h / 2, w: layout.r1.w, h: layout.r1.h },
    { id: "l2", x: layout.l2.x + layout.l2.w / 2, y: layout.l2.y + layout.l2.h / 2, w: layout.l2.w, h: 36 },
    { id: "r2", x: layout.r2.x + layout.r2.w / 2, y: layout.r2.y + layout.r2.h / 2, w: layout.r2.w, h: 36 },
    { id: "share", x: layout.share.x, y: layout.share.y, w: 84, h: 36 },
    { id: "options", x: layout.options.x, y: layout.options.y, w: 84, h: 36 },
    { id: "touchpad", x: layout.touch.x, y: layout.touch.y, w: layout.touch.w, h: layout.touch.h },
    { id: "ps", x: layout.ps.x, y: layout.ps.y, w: 44, h: 44 },
    { id: "l3", x: layout.stickL.x, y: layout.stickL.y, w: 44, h: 44 },
    { id: "r3", x: layout.stickR.x, y: layout.stickR.y, w: 44, h: 44 },
    ...FACE.map((item) => ({
      id: item.id,
      x: layout.face.x + item.dx,
      y: layout.face.y + item.dy,
      w: 40,
      h: 40,
    })),
    ...DPAD.map((item) => ({
      id: item.id,
      x: layout.dpad.x + item.dx,
      y: layout.dpad.y + item.dy,
      w: 32,
      h: 32,
    })),
  ];

  return (
    <div className="relative mx-auto w-full max-w-3xl" dir="ltr">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full" aria-hidden="true">
        <path
          d="M250 62H550C648 62 706 104 728 168C758 250 724 324 652 356C608 404 548 414 508 378H292C252 414 192 404 148 356C76 324 42 250 72 168C94 104 152 62 250 62Z"
          fill="var(--color-raised)"
          stroke="var(--color-line)"
          strokeWidth="2"
        />
        <TriggerBar track={layout.l2} value={b.l2} />
        <TriggerBar track={layout.r2} value={b.r2} fromRight />
        <Pill
          x={layout.l1.x + layout.l1.w / 2}
          y={layout.l1.y + layout.l1.h / 2}
          w={layout.l1.w}
          h={layout.l1.h}
          value={b.l1}
          label="L1"
        />
        <Pill
          x={layout.r1.x + layout.r1.w / 2}
          y={layout.r1.y + layout.r1.h / 2}
          w={layout.r1.w}
          h={layout.r1.h}
          value={b.r1}
          label="R1"
        />
        <Stick
          at={layout.stickL}
          stick={frame.left}
          pressed={isPressed(b.l3)}
          rest={leftDrift.rest}
          showRest={leftDrift.ready}
          drifting={leftDrift.drifting}
        />
        <Stick
          at={layout.stickR}
          stick={frame.right}
          pressed={isPressed(b.r3)}
          rest={rightDrift.rest}
          showRest={rightDrift.ready}
          drifting={rightDrift.drifting}
        />
        {FACE.map((item) => (
          <FaceButton key={item.id} x={layout.face.x + item.dx} y={layout.face.y + item.dy} value={b[item.id]} label={item.label} />
        ))}
        {DPAD.map((item) => (
          <DpadButton key={item.id} x={layout.dpad.x + item.dx} y={layout.dpad.y + item.dy} value={b[item.id]} label={item.label} />
        ))}
        <Pill x={layout.share.x} y={layout.share.y} w={84} h={32} value={b.share} label="Share" />
        <Pill x={layout.options.x} y={layout.options.y} w={84} h={32} value={b.options} label="Options" />
        <rect
          x={layout.touch.x - layout.touch.w / 2}
          y={layout.touch.y - layout.touch.h / 2}
          width={layout.touch.w}
          height={layout.touch.h}
          rx="18"
          fill={lit(b.touchpad)}
          stroke="var(--color-line)"
        />
        <text
          x={layout.touch.x}
          y={layout.touch.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ink(b.touchpad)}
          fontSize="14"
          fontFamily="inherit"
        >
          Touchpad
        </text>
        <circle cx={layout.ps.x} cy={layout.ps.y} r="18" fill={lit(b.ps)} stroke="var(--color-line)" />
        <text
          x={layout.ps.x}
          y={layout.ps.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ink(b.ps)}
          fontSize="12"
          fontFamily="inherit"
          fontWeight="600"
        >
          PS
        </text>
      </svg>
      {demo
        ? hits.map((hit) => (
            <button
              key={hit.id}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className="absolute border-0 bg-transparent p-0"
              style={{
                left: `${((hit.x - hit.w / 2) / VW) * 100}%`,
                top: `${((hit.y - hit.h / 2) / VH) * 100}%`,
                width: `${(hit.w / VW) * 100}%`,
                height: `${(hit.h / VH) * 100}%`,
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                onButton(hit.id, true);
              }}
              onPointerUp={() => onButton(hit.id, false)}
              onPointerCancel={() => onButton(hit.id, false)}
            />
          ))
        : null}
    </div>
  );
}

function FaceButton({ x, y, value, label }: { x: number; y: number; value: number; label: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="18" fill={lit(value)} stroke="var(--color-line)" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={ink(value)} fontSize="16" fontFamily="inherit">
        {label}
      </text>
    </g>
  );
}

function DpadButton({ x, y, value, label }: { x: number; y: number; value: number; label: string }) {
  return (
    <g>
      <rect x={x - 13} y={y - 13} width="26" height="26" rx="6" fill={lit(value)} stroke="var(--color-line)" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={ink(value)} fontSize="13" fontFamily="inherit">
        {label}
      </text>
    </g>
  );
}

function Pill({ x, y, w, h, value, label }: { x: number; y: number; w: number; h: number; value: number; label: string }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx="10" fill={lit(value)} stroke="var(--color-line)" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={ink(value)} fontSize="13" fontFamily="inherit">
        {label}
      </text>
    </g>
  );
}
