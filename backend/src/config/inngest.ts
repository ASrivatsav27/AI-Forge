import {
  Inngest,
  eventType,
  staticSchema,
} from "inngest";
import type { SetupContext,SetupRequestedData,CodingRequestedData } from "../types/inngest.types.js";
export const inngest = new Inngest({
  id: "AI-Forge",
});

export const setupRequested = eventType(
  "project/setup.requested",
  {
    schema: staticSchema<SetupRequestedData>(),
  }
);

export const codingRequested = eventType(
  "project/coding.requested",
  {
    schema: staticSchema<CodingRequestedData>(),
  }
);