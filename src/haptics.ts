export type PulseActuator = {
  pulse: (value: number, duration: number) => Promise<unknown>;
};

/** Call pulse as a method. An unbound extract throws on Firefox haptic actuators. */
export function pulseActuator(actuator: Partial<PulseActuator> | null | undefined, value: number, duration: number): Promise<unknown> | null {
  if (!actuator || typeof actuator.pulse !== "function") return null;
  return actuator.pulse(value, duration);
}
