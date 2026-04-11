import React, { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, Info, Layers3 } from 'lucide-react';
import { getGenera, getTaxonomyChildren } from '../api';
import type { Genus, TaxonomyNode } from '../types';

interface ClassificationProps {
  setCurrentPage?: (page: string) => void;
  onSelectPlant?: (plantId: string) => void;
}

function updateNodeChildren(nodes: TaxonomyNode[], targetId: string, children: TaxonomyNode[]): TaxonomyNode[] {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return {
        ...node,
        children,
        has_children: children.length > 0
      };
    }

    if (node.children) {
      return {
        ...node,
        children: updateNodeChildren(node.children, targetId, children)
      };
    }

    return node;
  });
}

function findNodeById(nodes: TaxonomyNode[], targetId: string): TaxonomyNode | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node;
    }

    if (node.children?.length) {
      const found = findNodeById(node.children, targetId);
      if (found) return found;
    }
  }

  return null;
}

function rankLabel(rank?: string) {
  const labels: Record<string, string> = {
    kingdom: '界',
    phylum: '门',
    subphylum: '亚门',
    class: '纲',
    order: '目',
    family: '科',
    genus: '属',
    species: '种'
  };

  return labels[rank || ''] || (rank || '节点');
}

export default function Classification({ setCurrentPage }: ClassificationProps) {
  const [tree, setTree] = useState<TaxonomyNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [genera, setGenera] = useState<Genus[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingGenera, setLoadingGenera] = useState(false);
  const [loadingChildrenId, setLoadingChildrenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingTree(true);
    setError(null);
    getTaxonomyChildren()
      .then(async (data) => {
        let nextTree = data;
        const firstNode = data[0];

        if (firstNode?.has_children) {
          const children = await getTaxonomyChildren(firstNode.id);
          nextTree = updateNodeChildren(data, firstNode.id, children);
          setExpandedIds(new Set([firstNode.id]));
        }

        setTree(nextTree);
        setSelectedNodeId(firstNode?.id || null);
      })
      .catch((err) => {
        setTree([]);
        setSelectedNodeId(null);
        setError(err instanceof Error ? err.message : '分类数据加载失败');
      })
      .finally(() => {
        setLoadingTree(false);
      });
  }, []);

  const selectedNode = selectedNodeId ? findNodeById(tree, selectedNodeId) : null;

  const handleToggleNode = async (node: TaxonomyNode) => {
    if (!node.has_children) {
      return;
    }

    const nextExpanded = new Set(expandedIds);
    if (expandedIds.has(node.id)) {
      nextExpanded.delete(node.id);
      setExpandedIds(nextExpanded);
      return;
    }

    nextExpanded.add(node.id);
    setExpandedIds(nextExpanded);

    if (node.children !== undefined) {
      return;
    }

    setLoadingChildrenId(node.id);
    try {
      const children = await getTaxonomyChildren(node.id);
      setTree((prev) => updateNodeChildren(prev, node.id, children));
    } catch (err) {
      setError(err instanceof Error ? err.message : '下级分类加载失败');
    } finally {
      setLoadingChildrenId((current) => (current === node.id ? null : current));
    }
  };

  const handleSelectNode = (node: TaxonomyNode) => {
    setSelectedNodeId(node.id);
  };

  useEffect(() => {
    if (!selectedNode) {
      setGenera([]);
      return;
    }

    if (selectedNode.rank !== 'family') {
      setGenera([]);
      setLoadingGenera(false);
      return;
    }

    setLoadingGenera(true);
    getGenera(selectedNode.id)
      .then((data) => {
        setGenera(data.list || []);
      })
      .catch(() => {
        setGenera([]);
      })
      .finally(() => {
        setLoadingGenera(false);
      });
  }, [selectedNode]);

  const renderTree = (nodes: TaxonomyNode[], depth = 0) => (
    <div className={depth === 0 ? 'space-y-3' : 'ml-5 mt-3 space-y-3 border-l border-emerald-100 pl-4'}>
      {nodes.map((node) => {
        const expanded = expandedIds.has(node.id);
        const isSelected = selectedNodeId === node.id;
        const isLoadingChildren = loadingChildrenId === node.id;
        const hasChildren = Boolean(node.has_children);

        return (
          <div key={node.id}>
            <div
              className={`group flex items-start gap-3 rounded-2xl border p-4 transition-all ${
                isSelected
                  ? 'border-emerald-200 bg-emerald-50/70 shadow-sm'
                  : 'border-zinc-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/30'
              }`}
            >
              <button
                type="button"
                onClick={() => handleToggleNode(node)}
                disabled={!hasChildren}
                className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border transition ${
                  hasChildren
                    ? 'border-zinc-200 bg-white text-zinc-500 hover:border-emerald-200 hover:text-emerald-600'
                    : 'cursor-default border-transparent bg-zinc-100 text-zinc-300'
                }`}
                aria-label={expanded ? '收起下级节点' : '展开下级节点'}
              >
                {hasChildren ? (
                  expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </button>

              <button type="button" onClick={() => handleSelectNode(node)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900">{node.name}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {rankLabel(node.rank)}
                  </span>
                </div>
                <div className="mt-1 text-xs italic text-emerald-700">{node.scientific_name}</div>
                <div className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">{node.description}</div>
                {isLoadingChildren && <div className="mt-2 text-xs text-emerald-600">正在加载下一级分类...</div>}
              </button>
            </div>

            {expanded && node.children && node.children.length > 0 && renderTree(node.children, depth + 1)}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto max-w-screen-2xl px-8 py-12">
      <div className="grid min-h-[calc(100vh-12rem)] gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-3xl border border-zinc-100 bg-gradient-to-b from-zinc-50 to-white p-8 shadow-sm">
          <div className="mb-8 flex items-start justify-between gap-6">
            <div>
              <h1 className="mb-2 flex items-center gap-3 text-4xl font-headline font-extrabold tracking-tight text-zinc-900">
                <Layers3 className="text-emerald-600" size={32} />
                分类树
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-zinc-600">
                按界、门、亚门、纲、目、科、属逐级浏览植物分类。左侧是树状层级，右侧展示当前节点信息；当选中科级节点时，会展示去重后的代表属。
              </p>
            </div>
          </div>

          {loadingTree ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
              正在加载分类树...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-sm text-rose-700">
              分类数据加载失败：{error}
            </div>
          ) : tree.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
              当前没有可展示的分类节点。
            </div>
          ) : (
            renderTree(tree)
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-600">
                当前节点
              </span>
              <Info size={16} className="text-zinc-400" />
            </div>
            <h2 className="mb-1 text-2xl font-headline font-bold text-zinc-900">{selectedNode?.name || '未选择节点'}</h2>
            <p className="mb-3 text-xs font-bold italic text-emerald-700">{selectedNode?.scientific_name || '暂无学名'}</p>
            <p className="text-sm leading-6 text-zinc-500">
              {selectedNode?.description || '请选择左侧分类节点，查看这一层级在当前数据中的位置和说明。'}
            </p>
            {selectedNode && !selectedNode.has_children && (
              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
                当前节点在现有数据中没有下一级分类，可能是该分支尚未补齐，或当前知识库未收录更细层级。
              </div>
            )}
            <button
              onClick={() => setCurrentPage?.('library')}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 font-semibold text-white transition-all hover:bg-zinc-800"
            >
              查看植物库
              <ArrowRight size={16} />
            </button>
          </section>

          <section className="flex min-h-[22rem] flex-col overflow-hidden rounded-3xl border border-zinc-100 bg-zinc-50">
            <div className="flex items-center justify-between border-b border-zinc-200/60 bg-white p-5">
              <h3 className="font-headline text-lg font-bold text-zinc-900">代表属</h3>
              <span className="text-xs text-zinc-500">
                {selectedNode?.rank !== 'family'
                  ? '选择科级节点后显示'
                  : loadingGenera
                    ? '加载中...'
                    : `${genera.length} 个去重结果`}
              </span>
            </div>
            {selectedNode?.rank !== 'family' && (
              <div className="border-b border-zinc-200/60 bg-amber-50 px-5 py-3 text-xs text-amber-700">
                当前节点是 {rankLabel(selectedNode?.rank)} 级。右侧代表属仅在选择科级节点时显示。
              </div>
            )}
            <div className="flex-grow space-y-3 overflow-y-auto p-4">
              {loadingGenera ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-sm text-zinc-500">
                  正在加载该科下的属列表...
                </div>
              ) : genera.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-sm text-zinc-500">
                  当前节点暂无可展示的属数据。
                </div>
              ) : (
                genera.map((item) => (
                  <div
                    key={item.scientific_name}
                    className="flex items-center gap-4 rounded-2xl border border-transparent bg-white p-3 transition-all hover:border-emerald-200"
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-xl bg-emerald-50">
                      {item.cover_image ? (
                        <img
                          src={item.cover_image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-emerald-700">
                          G
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <h4 className="truncate text-sm font-bold text-zinc-900">{item.name}</h4>
                      <p className="truncate text-[11px] text-zinc-500">{item.scientific_name}</p>
                    </div>
                    <div className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-500">
                      {item.species_count || 0} 种
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
