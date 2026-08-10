import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import DownloadExtensionButton from "@/components/download-extension-button";

export default function HomePage() {
  return (
    <main>
      <Card>
        <CardHeader>
          <CardDescription>Local Workflow</CardDescription>
          <CardTitle className="text-3xl leading-tight">
            1688 → Mercado Libre 商品导出管理系统
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground">
            上传 1688 采集的 ZIP 压缩包，使用 AI 大模型自动填写 Excel 模板并导出。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/products">
              <Button>进入商品库管理</Button>
            </Link>
            <DownloadExtensionButton />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
