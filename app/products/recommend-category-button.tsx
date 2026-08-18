"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function RecommendCategoryButton({
  productId,
  recommending,
}: {
  productId: string;
  recommending: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const disabled = recommending || submitting;

  const handleClick = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/products/${productId}/recommend-category`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "启动分类推荐失败。");
      }
      toast.success(result.message || "已开始根据商品标题推荐分类。");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "启动分类推荐失败。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={handleClick}
    >
      {disabled ? "获取中..." : "获取分类"}
    </Button>
  );
}