import { NextResponse } from "next/server";
import { networkConfigRepo } from "@/lib/network-config/repository";
import { networkConfigSchema } from "@/lib/network-config/validation";
import { getNetworkDiagnostics } from "@/lib/floci-network";
import { getDetectedLanIps, getPrimaryLanIp, getDetectedTailscaleIp } from "@/lib/lan-detector";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = networkConfigRepo.get();
    const isLocked = networkConfigRepo.isLocked();
    const detectedIps = getDetectedLanIps();
    const detectedLanIp = getPrimaryLanIp();
    const detectedTailscaleIp = getDetectedTailscaleIp();
    const diagnostics = {
      ...getNetworkDiagnostics(config, isLocked),
      detectedLanIp,
      detectedTailscaleIp,
      detectedIps,
    };
    return NextResponse.json({
      config,
      diagnostics,
      isLocked,
    });
  } catch (error) {
    logger.error({ error }, "Failed to load network configuration.");
    return NextResponse.json(
      { error: "Failed to load network configuration." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    if (networkConfigRepo.isLocked()) {
      return NextResponse.json(
        { error: "Configuration is locked by the server administrator (FLOCI_CONFIG_LOCKED=true)." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parseResult = networkConfigSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const savedConfig = networkConfigRepo.save(parseResult.data);
    const detectedIps = getDetectedLanIps();
    const detectedLanIp = getPrimaryLanIp();
    const detectedTailscaleIp = getDetectedTailscaleIp();
    const diagnostics = {
      ...getNetworkDiagnostics(savedConfig, false),
      detectedLanIp,
      detectedTailscaleIp,
      detectedIps,
    };

    return NextResponse.json({
      success: true,
      config: savedConfig,
      diagnostics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save configuration.";
    logger.error({ error }, "Failed to update network configuration.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
