"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const router = useRouter();

  return (
    <Button variant="outline" size="sm" onClick={() => router.refresh()}>
      刷新列表
    </Button>
  );
}
