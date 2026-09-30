import { NextResponse } from "next/server";
import { networkConfigRepo } from "@/lib/network-config/repository";
import { getNetworkDiagnostics } from "@/lib/floci-network";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (networkConfigRepo.isLocked()) {
      return NextResponse.json(
        { error: "Configuration is locked by the server administrator (FLOCI_CONFIG_LOCKED=true)." },
        { status: 403 }
      );
    }

    const resetConfig = networkConfigRepo.reset();
    const diagnostics = getNetworkDiagnostics(resetConfig);

    logger.info("Network configuration reset to local defaults.");

    return NextResponse.json({
      success: true,
      config: resetConfig,
      diagnostics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset configuration.";
    logger.error({ error }, "Failed to reset network configuration.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
