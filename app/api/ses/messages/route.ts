import { NextResponse } from "next/server";
import { awsConfig } from "@/lib/aws/config";

export interface CapturedEmail {
  id: string;
  source: string;
  destination: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  timestamp: string;
}

export async function GET() {
  try {
    const inspectionUrl = `${awsConfig.FLOCI_ENDPOINT}/_floci/ses/messages`;
    try {
      const response = await fetch(inspectionUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const body = await response.json();
        const messages = Array.isArray(body) ? body : body.messages || [];
        return NextResponse.json({ messages, count: messages.length });
      }
    } catch {
      // Fallback
    }

    return NextResponse.json({ messages: [], count: 0 });
  } catch {
    return NextResponse.json({ messages: [], count: 0 });
  }
}
