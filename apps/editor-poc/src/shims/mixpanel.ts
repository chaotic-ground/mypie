// mixpanel-browser shim — analytics are no-ops in the PoC.
const noop = () => {};
export default {
  init: noop,
  track: noop,
  identify: noop,
  reset: noop,
  register: noop,
  register_once: noop,
  people: { set: noop, set_once: noop },
  get_distinct_id: () => 'local',
  time_event: noop,
};
