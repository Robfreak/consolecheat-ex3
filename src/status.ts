/** Status text for a live pad. The mapping is the localized label only. */
export function formatConnectionStatus(input: {
  simulated: boolean;
  simName: string;
  connected: string;
  profileLabel: string;
}): string {
  if (input.simulated) return input.simName;
  return `${input.connected} · ${input.profileLabel}`;
}
