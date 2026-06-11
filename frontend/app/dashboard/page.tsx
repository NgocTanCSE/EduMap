// Placeholder Dashboard page – currently redirects to profile
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  // Auto‑redirect to a real page (e.g., profile) until a full dashboard is built
  useEffect(() => {
    router.replace("/profile");
  }, []);
  return null;
}
