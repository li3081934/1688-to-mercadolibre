"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FolderTree, Leaf } from "lucide-react";

export type CategoryTreeNode = {
  categoryId: string;
  name: string;
  displayName: string;
  hasChildren: boolean;
  children?: CategoryTreeNode[];
};

function CategoryTreeItem({ node, depth }: { node: CategoryTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.hasChildren || Boolean(node.children?.length);

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
        style={{ paddingLeft: `${depth * 22 + 8}px` }}
      >
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
          onClick={() => hasChildren && setExpanded((value) => !value)}
          disabled={!hasChildren}
          aria-label={expanded ? "收起分类" : "展开分类"}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : <span className="h-4 w-4" />}
        </button>
        {hasChildren ? <FolderTree className="h-4 w-4 text-primary" /> : <Leaf className="h-4 w-4 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate" title={node.name}>
          {node.displayName}
          {node.displayName !== node.name ? (
            <span className="ml-2 text-xs text-muted-foreground">{node.name}</span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">{node.categoryId}</span>
      </div>
      {expanded && node.children?.length ? (
        <div>
          {node.children.map((child) => (
            <CategoryTreeItem key={child.categoryId} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CategoryTree({ nodes }: { nodes: CategoryTreeNode[] }) {
  return (
    <div className="divide-y rounded-lg border bg-background">
      {nodes.map((node) => (
        <CategoryTreeItem key={node.categoryId} node={node} depth={0} />
      ))}
    </div>
  );
}