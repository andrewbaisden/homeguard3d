import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled: this would generate apps/web/AGENTS.md, colliding with the
  // repo-root AGENTS.md that governs the whole project (see AGENTS.md).
  agentRules: false,
};

export default nextConfig;
