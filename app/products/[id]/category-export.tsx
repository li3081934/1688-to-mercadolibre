"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CategoryExport() {
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (!category.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/products/export-listed?category=${encodeURIComponent(category.trim())}`,
      );

      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "导出失败。");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${category.trim()}-上架商品.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "网络错误。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>导出上架商品</CardTitle>
        <CardDescription>
          输入美客多分类 ID，从 ML 拉取该分类下所有已刊登商品并生成 Excel。分类
          ID 可在<strong>美客多集成 &gt; 分类查询</strong>
          中找到（如 <code>CBT407134</code>）。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <Label htmlFor="categoryId">美客多分类 ID</Label>
          <Input
            id="categoryId"
            type="text"
            placeholder="例如：CBT407134"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <Button
            onClick={handleExport}
            disabled={loading || !category.trim()}
          >
            {loading ? "导出中..." : "导出上架商品 Excel"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
