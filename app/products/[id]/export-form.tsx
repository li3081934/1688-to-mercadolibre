"use client";

import { type FormEvent, useState } from "react";

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
      const res = await fetch(form.action, { method: "POST", body: formData });

      if (!res.ok) {
        // error case — server redirects with status/message, follow it
        window.location.href = form.action.replace("/export", "");
        return;
      }

      // success — download the Excel blob then reset loading
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/);
      const filename = match ? decodeURIComponent(match[1]) : "export.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="field full">
        <label htmlFor="userPrompt">补充提示词</label>
        <textarea
          id="userPrompt"
          name="userPrompt"
          rows={4}
          placeholder="例如：优先按照西班牙语市场习惯填写标题；如果包装信息缺失就留空，不要猜测。"
        />
        <p className="muted">不填也可以，系统会使用默认系统提示词。</p>
      </div>
      {hasSku ? (
        <div className="stack">
          {skuItems.map((skuItem) => (
            <label key={skuItem.key} className="meta-row" style={{ alignItems: "flex-start", gap: 12 }}>
              <input type="checkbox" name="sku" value={skuItem.key} defaultChecked />
              {skuItem.imageUrl ? (
                <img
                  src={skuItem.imageUrl}
                  alt={skuItem.label}
                  width={64}
                  height={64}
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, flexShrink: 0 }}
                />
              ) : null}
              <strong>{skuItem.label}</strong>
            </label>
          ))}
        </div>
      ) : (
        <div className="empty-state">当前商品没有可选 SKU。</div>
      )}
      <div className="actions">
        <button type="submit" className="button" disabled={loading}>
          {loading ? "⏳ AI 正在填写中..." : "使用 AI 填写 Excel"}
        </button>
      </div>
    </form>
  );
}