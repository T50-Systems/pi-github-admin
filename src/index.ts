import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerGitHubAdminTools } from "./tools.js";

export default function githubAdminExtension(pi: ExtensionAPI): void {
  registerGitHubAdminTools(pi);
}

export * from "./auth.js";
export * from "./api.js";
export * from "./types.js";
