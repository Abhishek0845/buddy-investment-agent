import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/config";

const startTime = Date.now();

export async function GET() {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  return NextResponse.json({
    status: "healthy",
    version: APP_VERSION,
    uptime: `${uptimeSeconds}s`,
    timestamp: new Date().toISOString(),
  });
}
export const dynamic = "force-dynamic";
