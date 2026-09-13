import { deviceFailureScenario } from "./scenarios/device-failure";
import { intrusionScenario } from "./scenarios/intrusion";
import { leavingHomeScenario } from "./scenarios/leaving-home";
import { nightModeScenario } from "./scenarios/night-mode";
import { normalEveningScenario } from "./scenarios/normal-evening";

export { normalEveningScenario } from "./scenarios/normal-evening";
export { leavingHomeScenario } from "./scenarios/leaving-home";
export { nightModeScenario } from "./scenarios/night-mode";
export { intrusionScenario } from "./scenarios/intrusion";
export { deviceFailureScenario } from "./scenarios/device-failure";

export const simulationScenarios = [
  normalEveningScenario,
  leavingHomeScenario,
  nightModeScenario,
  intrusionScenario,
  deviceFailureScenario,
];
