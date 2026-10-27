import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/src/lib/api-config";
import { unwrapApiResponse } from "@/src/lib/api-utils";

/**
 * POST /api/resource-exchange/match — AI matching (pre-filter + LLM ranking
 * + greedy transport scheduling). BFF proxy → NestJS backend
 * /resource-exchange/match, which in turn proxies to the ai-service
 * /api/ai/resource-exchange/match-rank.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeader) headers["Authorization"] = authHeader;

  try {
    const body = await req.json();
    const response = await fetch(`${getBackendUrl()}/resource-exchange/match`, {
      method: "POST",
      headers,
      body: JSON.stringify(body || {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error:", errorText);
      return NextResponse.json(
        { message: "Không thể ghép nối nguồn lực" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json(
      { message: "Lỗi kết nối tới backend" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
