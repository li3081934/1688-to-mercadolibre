"use client";

import { useCallback, useEffect, useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AIModel = {
  id: number;
  name: string;
  url: string;
  modelName: string;
  systemPrompt: string;
  protocol: string;
  purpose: string;
  thinkingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const PURPOSES = [
  { value: "translation", label: "翻译" },
  { value: "title_polish", label: "标题润色翻译" },
  { value: "image_editing", label: "P图" },
  { value: "fill_info", label: "填写信息" },
];

const PROTOCOLS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

const emptyForm = {
  name: "",
  url: "",
  apiKey: "",
  modelName: "",
  systemPrompt: "",
  protocol: "openai",
  purpose: "translation",
  thinkingEnabled: false,
};

export default function AIModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-models");
      const data = await res.json();
      setModels(data);
    } catch {
      toast.error("加载失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function openAdd() {
    resetForm();
    setOpen(true);
  }

  function startEdit(model: AIModel) {
    setForm({
      name: model.name,
      url: model.url,
      apiKey: "",
      modelName: model.modelName,
      systemPrompt: model.systemPrompt,
      protocol: model.protocol as "openai" | "anthropic",
      purpose: model.purpose as "translation" | "title_polish" | "image_editing" | "fill_info",
      thinkingEnabled: model.thinkingEnabled,
    });
    setEditingId(model.id);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        const body: Record<string, string | boolean> = {
          name: form.name,
          url: form.url,
          modelName: form.modelName,
          systemPrompt: form.systemPrompt,
          protocol: form.protocol,
          purpose: form.purpose,
          thinkingEnabled: form.thinkingEnabled,
        };
        if (form.apiKey) body.apiKey = form.apiKey;
        const res = await fetch(`/api/ai-models/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch("/api/ai-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
      }
      toast.success(editingId ? "更新成功。" : "添加成功。");
      setOpen(false);
      resetForm();
      fetchModels();
    } catch {
      toast.error("操作失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy(id: number) {
    try {
      const res = await fetch(`/api/ai-models/${id}/copy`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast.success("复制成功。");
      fetchModels();
    } catch {
      toast.error("复制失败。");
    }
  }

  async function confirmDelete() {
    if (deleteTarget === null) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/ai-models/${deleteTarget}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("删除成功。");
      fetchModels();
    } catch {
      toast.error("删除失败。");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <main className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardDescription>AI</CardDescription>
          <CardTitle>AI 模型管理</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            管理 AI 模型配置，用于商品翻译和图片处理。
          </p>

          <div>
            <Button onClick={openAdd}>添加模型</Button>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "编辑模型" : "添加模型"}
                </DialogTitle>
                <DialogDescription>
                  配置 AI 模型的连接参数和用途。
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">AI 名字</Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="modelName">模型名字</Label>
                  <Input
                    id="modelName"
                    required
                    value={form.modelName}
                    onChange={(e) =>
                      setForm({ ...form, modelName: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    required
                    value={form.url}
                    onChange={(e) =>
                      setForm({ ...form, url: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="apiKey">
                    API Key{" "}
                    {editingId ? (
                      <span className="font-normal text-muted-foreground">
                        (留空不修改)
                      </span>
                    ) : null}
                  </Label>
                  <Input
                    id="apiKey"
                    required={!editingId}
                    value={form.apiKey}
                    onChange={(e) =>
                      setForm({ ...form, apiKey: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="protocol">协议</Label>
                  <Select
                    value={form.protocol}
                    onValueChange={(v) =>
                      setForm({ ...form, protocol: v as "openai" | "anthropic" })
                    }
                  >
                    <SelectTrigger id="protocol">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROTOCOLS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="purpose">用途</Label>
                  <Select
                    value={form.purpose}
                    onValueChange={(v) =>
                      setForm({ ...form, purpose: v as "translation" | "title_polish" | "image_editing" | "fill_info" })
                    }
                  >
                    <SelectTrigger id="purpose">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PURPOSES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 md:col-span-2">
                  <Checkbox
                    id="thinkingEnabled"
                    checked={form.thinkingEnabled}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, thinkingEnabled: !!checked })
                    }
                  />
                  <Label htmlFor="thinkingEnabled" className="cursor-pointer">
                    启用思考模式（deepseek-v4 等推理模型需要开启，否则会直接返回结果）
                  </Label>
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label htmlFor="systemPrompt">系统提示语</Label>
                  <Textarea
                    id="systemPrompt"
                    rows={3}
                    value={form.systemPrompt}
                    onChange={(e) =>
                      setForm({ ...form, systemPrompt: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "提交中..." : editingId ? "更新" : "添加"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    取消
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除这个 AI 模型吗？此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                <AlertDialogAction disabled={deleting} onClick={confirmDelete}>
                  {deleting ? "删除中..." : "删除"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : models.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              还没有 AI 模型配置。点击上方按钮添加。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>AI 名字</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>模型名字</TableHead>
                  <TableHead>协议</TableHead>
                  <TableHead>用途</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">
                      {model.name}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {model.url}
                    </TableCell>
                    <TableCell>{model.modelName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {model.protocol === "openai"
                          ? "OpenAI"
                          : "Anthropic"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {model.purpose === "translation"
                          ? "翻译"
                          : model.purpose === "title_polish"
                            ? "标题润色翻译"
                            : model.purpose === "image_editing"
                              ? "P图"
                              : "填写信息"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(model.updatedAt).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(model)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(model.id)}
                        >
                          复制
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(model.id)}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
