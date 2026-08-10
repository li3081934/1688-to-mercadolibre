"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  action: string;
  skuItems: Array<{
    key: string;
    label: string;
    imageUrl: string | null;
  }>;
  hasSku: boolean;
};

export default function ExportForm({ action, skuItems, hasSku }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch(action, { method: "POST", body: formData });

      if (!res.ok) {
        let message = `导出失败 (HTTP ${res.status})`;
        try {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            if (data?.error) message = data.error;
          } catch {
            message =
              text.length > 200
                ? `${message}，请查看服务器日志`
                : text || message;
          }
        } catch {
          /* ignore */
        }
        alert(message);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/);
      const filename = match
        ? decodeURIComponent(match[1])
        : "export.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "网络错误，导出失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="templateFile">Excel 模板文件</Label>
        <Input
          id="templateFile"
          name="templateFile"
          type="file"
          accept=".xlsx,.xlsm,.xls"
          required
        />
        <p className="text-xs text-muted-foreground">
          选择需要 AI 填写的 Excel 模板文件。
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sheetName">工作表名</Label>
        <Input
          id="sheetName"
          name="sheetName"
          placeholder="Sheet1"
          defaultValue="Sheet1"
          required
        />
        <p className="text-xs text-muted-foreground">
          指定模板中要填写的工作表名称。
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="userPrompt">补充提示词</Label>
        <Textarea
          id="userPrompt"
          name="userPrompt"
          rows={4}
          placeholder="例如：优先按照西班牙语市场习惯填写标题；如果包装信息缺失就留空，不要猜测。"
        />
        <p className="text-xs text-muted-foreground">
          不填也可以，系统会使用默认系统提示词。
        </p>
      </div>
      {hasSku ? (
        <div className="flex flex-col gap-3">
          {skuItems.map((skuItem) => (
            <label
              key={skuItem.key}
              className="flex items-start gap-3 border-b pb-2 text-sm"
            >
              <input
                type="checkbox"
                name="sku"
                value={skuItem.key}
                defaultChecked
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              {skuItem.imageUrl ? (
                <img
                  src={skuItem.imageUrl}
                  alt={skuItem.label}
                  width={64}
                  height={64}
                  className="size-16 flex-shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <span className="font-medium">{skuItem.label}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-sm text-muted-foreground">
          当前商品没有可选 SKU。
        </div>
      )}
      <div>
        <Button type="submit" disabled={loading}>
          {loading ? "AI 正在填写中..." : "使用 AI 填写 Excel"}
        </Button>
      </div>
    </form>
  );
}
