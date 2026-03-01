export const WEAPONS = ['epee', 'foil', 'sabre'] as const;

export const FOCUS_AREAS = [
  'footwork',
  'distance',
  'blade work',
  'parry-riposte',
  'attack',
  'defense',
  'counter-attack',
  'fleche',
  'lunge',
  'recovery',
  'strategy',
  'timing',
  'bout tactics',
  'conditioning',
] as const;

export const DRILL_TYPES = [
  'advance-lunge',
  'advance-retreat',
  'fleche-timing',
  'parry-4-riposte',
  'parry-6-riposte',
  'circle-parry',
  'compound-attack',
  'counter-time',
  'disengage',
  'one-two',
  'beat-attack',
  'point-in-line',
  'preparation-attack',
  'second-intention',
  'bout-simulation',
] as const;

export const CANCELLATION_POLICY_DEFAULTS = {
  free_cancel_hours: 24,
  late_cancel_charge_percent: 50,
  no_show_charge_percent: 100,
} as const;

export const WAITLIST_ACCEPTANCE_MINUTES = 15;

export const PLATFORM_FEE_PERCENT = parseInt(
  process.env.PLATFORM_FEE_PERCENT || '5',
  10
);
