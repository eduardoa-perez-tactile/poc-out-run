import {worldTest} from '@gameengine/test';

// These tapes include recorded EnterScene from the default project world.
// Direct-scene fixed-plan tests remain independent state/event/hash evidence.
worldTest.replay('tests/replays/routes_canonical_recorded_startup_and_fixed_all_left_inputs_reach_genuine_goal.greplay');
worldTest.replay('tests/replays/routes_canonical_recorded_startup_and_fixed_right_first_inputs_enter_genuine_map3.greplay');
