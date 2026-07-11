import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSelectedToolDefinitions } from "../tool-registrations.js";

export const RELEASE_TOOL_NAMES = ["github_create_release"] as const;
export const registerReleaseTools = (pi: ExtensionAPI): void => registerSelectedToolDefinitions(pi, RELEASE_TOOL_NAMES);
