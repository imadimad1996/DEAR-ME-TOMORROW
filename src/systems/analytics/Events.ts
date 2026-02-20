export const AnalyticsEvents = {
  TIME_TO_FIRST_MERGE: 'time_to_first_merge',
  MERGE_COUNT: 'merge_count',
  MERGE_DEPTH: 'merge_depth',
  ECHO_TRIGGER_FREQUENCY: 'echo_trigger_frequency',
  ORDER_ABANDONMENT: 'order_abandonment',
  AD_OPT_IN: 'ad_opt_in',
  AD_COMPLETE: 'ad_complete',
  RAGE_QUIT_PROXY: 'rage_quit_proxy',
  SESSION_LENGTH: 'session_length',
  ROOM_COMPLETION_PACING: 'room_completion_pacing',
  LETTERS_OPENED: 'letters_opened',
  LETTER_READ_TIME: 'letter_read_time',
  LETTER_SKIP: 'skip',
  ENERGY_ZERO_EVENTS: 'energy_zero_events',
  ENERGY_ZERO_DURATION: 'energy_zero_duration',
  BOARD_CLUTTER_EVENTS: 'board_clutter_events',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
