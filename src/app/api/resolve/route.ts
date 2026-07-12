import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyTickersBulk } from "@/services/companyResolver";
import { logger } from "@/lib/utils/logger";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ tickers: [], unresolved: [], status: "success" });
    }

    const result = await resolveCompanyTickersBulk(message);
    logger.info("Resolved tickers for query", { message, result });
    return NextResponse.json(result);
  } catch (err) {
    logger.error("Error in resolve API", { error: String(err) });
    return NextResponse.json({ tickers: [], unresolved: [], status: "network_error" });
  }
}
