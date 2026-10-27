import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/src/lib/api-config";
import { unwrapApiResponse } from "@/src/lib/api-utils";

/**
 * GET /api/resource-exchange/resources — list available resources (cung cấp).
 * POST /api/resource-exchange/resources — create a new resource (requires auth).
 * BFF proxy → NestJS backend /resource-exchange/resources.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeader) headers["Authorization"] = authHeader;

  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const backendUrl = `${getBackendUrl()}/resource-exchange/resources${qs ? `?${qs}` : ""}`;

  try {
    const response = await fetch(backendUrl, { method: "GET", headers });
    if (!response.ok) {
      return NextResponse.json(
        { message: "Không thể lấy danh sách nguồn lực" },
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

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeader) headers["Authorization"] = authHeader;

  try {
    const body = await req.json();
    const response = await fetch(
      `${getBackendUrl()}/resource-exchange/resources`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      return NextResponse.json(
        { message: "Không thể tạo nguồn lực" },
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
