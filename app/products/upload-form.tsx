"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function UploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploading) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("zipFile") as File;
    if (!file || file.size === 0) {
      toast.error("请选择 ZIP 文件。");
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/products/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        form.reset();
        router.refresh();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("上传请求失败。");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>上传商品 ZIP</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          encType="multipart/form-data"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="zipFile" className="text-sm font-medium">
              ZIP 文件
            </label>
            <input
              id="zipFile"
              name="zipFile"
              type="file"
              accept=".zip"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
            />
          </div>
          <div>
            <Button type="submit" disabled={uploading}>
              {uploading ? "上传中..." : "上传并建档"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
