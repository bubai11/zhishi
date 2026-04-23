import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Eye,
  Info,
  Layers3,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { getGenera, getTaxonomyChildren, searchTaxonomyNodes } from '../api';
import type { Genus, TaxonomyNode, TaxonomySearchHit } from '../types';

interface ClassificationProps {
  setCurrentPage?: (page: string) => void;
  onSelectPlant?: (plantId: string) => void;
  onOpenLibraryWithTaxonomy?: (filter: {
    familyId?: string;
    familyName?: string;
    familyScientificName?: string;
    genusScientificName?: string;
  }) => void;
  initialSearchQuery?: string;
}

type TreeNode = TaxonomyNode & {
  children?: TreeNode[];
};

type SearchHit = {
  id: string;
  name: string;
  scientific_name: string;
  rank: string;
};

const MAX_CHILDREN_RENDERED = 80;

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

  return labels[rank || ''] || rank || '节点';
}

function updateNodeChildren(nodes: TreeNode[], targetId: string, children: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return { ...node, children, has_children: children.length > 0 };
    }

    if (node.children?.length) {
      return { ...node, children: updateNodeChildren(node.children, targetId, children) };
    }

    return node;
  });
}

function findNodeById(nodes: TreeNode[], targetId: string, visited = new Set<string>()): TreeNode | null {
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    visited.add(node.id);

    if (node.id === targetId) return node;

    if (node.children?.length) {
      const found = findNodeById(node.children, targetId, visited);
      if (found) return found;
    }
  }

  return null;
}

function findNodePath(nodes: TreeNode[], targetId: string, path: TreeNode[] = [], visited = new Set<string>()): TreeNode[] | null {
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    visited.add(node.id);

    const nextPath = [...path, node];
    if (node.id === targetId) return nextPath;

    if (node.children?.length) {
      const found = findNodePath(node.children, targetId, nextPath, visited);
      if (found) return found;
    }
  }

  return null;
}

function collectLoadedNodes(nodes: TreeNode[], collector: SearchHit[] = [], visited = new Set<string>()): SearchHit[] {
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    visited.add(node.id);

    collector.push({
      id: node.id,
      name: node.name,
      scientific_name: node.scientific_name,
      rank: node.rank
    });

    if (node.children?.length) {
      collectLoadedNodes(node.children, collector, visited);
    }
  }

  return collector;
}

function buildVirtualRoot(nodes: TreeNode[]): TreeNode | null {
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];

  return {
    id: 'taxonomy-root',
    name: '植物分类体系',
    rank: 'kingdom',
    scientific_name: 'Plantae',
    description: '从界、门、纲、目、科到属，浏览系统当前已收录的植物分类层级。',
    has_children: true,
    children: nodes
  };
}

function highlightMatch(text: string, keyword: string) {
  const source = String(text || '');
  const query = keyword.trim();
  if (!query) return source;

  const index = source.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return source;

  return (
    <>
      {source.slice(0, index)}
      <mark className="rounded bg-amber-100 px-0.5 text-inherit">{source.slice(index, index + query.length)}</mark>
      {source.slice(index + query.length)}
    </>
  );
}

export default function Classification({ setCurrentPage, onOpenLibraryWithTaxonomy, initialSearchQuery }: ClassificationProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [genera, setGenera] = useState<Genus[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingGenera, setLoadingGenera] = useState(false);
  const [loadingChildrenIds, setLoadingChildrenIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [taxonomySearchHits, setTaxonomySearchHits] = useState<TaxonomySearchHit[]>([]);
  const [taxonomySearchLoading, setTaxonomySearchLoading] = useState(false);
  const [taxonomySearchError, setTaxonomySearchError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailPanelVisible, setDetailPanelVisible] = useState(true);
  const treeViewportRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const markNodeLoading = (id: string, loading: boolean) => {
    setLoadingChildrenIds((current) => {
      const next = new Set(current);
      if (loading) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const loadRootTree = async (cancelled?: () => boolean) => {
    setLoadingTree(true);
    setError(null);

    try {
      const roots = await getTaxonomyChildren() as TreeNode[];
      if (cancelled?.()) return;

      let nextTree = roots;
      const firstNode = roots[0];

      if (firstNode?.has_children) {
        const children = await getTaxonomyChildren(firstNode.id) as TreeNode[];
        if (cancelled?.()) return;
        nextTree = updateNodeChildren(roots, firstNode.id, children);
        setExpandedIds(new Set([firstNode.id]));
      } else {
        setExpandedIds(new Set());
      }

      setTree(nextTree);
      setSelectedNodeId(firstNode?.id || null);
    } catch (err) {
      if (cancelled?.()) return;
      setTree([]);
      setSelectedNodeId(null);
      setExpandedIds(new Set());
      setError(err instanceof Error ? err.message : '分类树加载失败');
    } finally {
      if (!cancelled?.()) {
        setLoadingTree(false);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    void loadRootTree(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSearchQuery(initialSearchQuery || '');
  }, [initialSearchQuery]);

  const visualRoot = useMemo(() => buildVirtualRoot(tree), [tree]);
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    if (selectedNodeId === 'taxonomy-root') return visualRoot;
    return findNodeById(tree, selectedNodeId);
  }, [selectedNodeId, tree, visualRoot]);
  const selectedPath = useMemo(
    () => (selectedNodeId ? findNodePath(visualRoot ? [visualRoot] : [], selectedNodeId) || [] : []),
    [selectedNodeId, visualRoot]
  );
  const loadedNodes = useMemo(() => collectLoadedNodes(visualRoot ? [visualRoot] : []), [visualRoot]);
  const filteredHits = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return [];
    return loadedNodes
      .filter((node) => node.name.toLowerCase().includes(keyword) || node.scientific_name.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [loadedNodes, searchQuery]);
  const searchHits = useMemo<(TaxonomySearchHit | SearchHit)[]>(() => {
    if (!searchQuery.trim()) return [];
    return taxonomySearchError ? filteredHits : taxonomySearchHits;
  }, [filteredHits, searchQuery, taxonomySearchError, taxonomySearchHits]);
  const canOpenLibraryFromSelectedNode = Boolean(selectedNode && ['family', 'genus', 'species'].includes(selectedNode.rank));
  const selectedNodeExpanded = Boolean(selectedNode && expandedIds.has(selectedNode.id));
  const selectedNodeChildStatus = !selectedNode
    ? '未选择'
    : !selectedNode.has_children
      ? '无下级'
      : selectedNodeExpanded
        ? '已展开'
        : '可展开';
  const selectedPathText = selectedPath.map((node) => node.name).join(' / ');
  const selectedDescription = selectedNode?.description || '';
  const shouldShowDescription = Boolean(
    selectedDescription &&
    !(
      selectedDescription.includes('分类系统') &&
      selectedDescription.includes('当前学名')
    )
  );

  useEffect(() => {
    const keyword = searchQuery.trim();
    if (!keyword) {
      setTaxonomySearchHits([]);
      setTaxonomySearchError('');
      setTaxonomySearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setTaxonomySearchLoading(true);
      setTaxonomySearchError('');
      searchTaxonomyNodes(keyword)
        .then((data) => {
          if (cancelled) return;
          setTaxonomySearchHits(data.list || []);
        })
        .catch((err) => {
          if (cancelled) return;
          setTaxonomySearchHits([]);
          setTaxonomySearchError(err instanceof Error ? err.message : '分类搜索失败');
        })
        .finally(() => {
          if (!cancelled) setTaxonomySearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const openLibraryFromNode = (node: TreeNode | null, genusScientificName?: string) => {
    if (!node) {
      setCurrentPage?.('library');
      return;
    }

    if (node.rank === 'family') {
      onOpenLibraryWithTaxonomy?.({
        familyId: node.id,
        familyName: node.name,
        familyScientificName: node.scientific_name,
        genusScientificName
      });
      return;
    }

    if (node.rank === 'genus') {
      onOpenLibraryWithTaxonomy?.({
        genusScientificName: node.scientific_name
      });
      return;
    }

    setCurrentPage?.('library');
  };

  useEffect(() => {
    let cancelled = false;

    if (!selectedNode) {
      setGenera([]);
      return () => {
        cancelled = true;
      };
    }

    if (selectedNode.rank !== 'family') {
      setGenera([]);
      setLoadingGenera(false);
      return () => {
        cancelled = true;
      };
    }

    setLoadingGenera(true);
    getGenera(selectedNode.id)
      .then((data) => {
        if (!cancelled) setGenera(data.list || []);
      })
      .catch(() => {
        if (!cancelled) setGenera([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingGenera(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNode]);

  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    treeViewportRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, a')) return;
    const viewport = treeViewportRef.current;
    if (!viewport) return;
    setIsDragging(true);
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop
    };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    const viewport = treeViewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = dragStart.current.scrollLeft - (event.clientX - dragStart.current.x);
    viewport.scrollTop = dragStart.current.scrollTop - (event.clientY - dragStart.current.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.12 : 0.12;
    setZoom((current) => Math.min(Math.max(current + delta, 0.55), 1.8));
  };

  const scrollNodeIntoView = (nodeId: string) => {
    window.setTimeout(() => {
      nodeRefs.current.get(nodeId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    }, 120);
  };

  const loadNodeChildren = async (node: TreeNode) => {
    if (!node.has_children || node.children !== undefined || node.id === 'taxonomy-root') return;

    markNodeLoading(node.id, true);
    try {
      const children = await getTaxonomyChildren(node.id) as TreeNode[];
      setTree((current) => updateNodeChildren(current, node.id, children));
    } catch (err) {
      setError(err instanceof Error ? err.message : '下级分类加载失败');
    } finally {
      markNodeLoading(node.id, false);
    }
  };

  const ensureNodeLoadedAndExpanded = async (nodeId: string) => {
    const path = findNodePath(visualRoot ? [visualRoot] : [], nodeId) || [];

    for (const node of path) {
      if (node.id === 'taxonomy-root' || !node.has_children) continue;
      await loadNodeChildren(node);
      setExpandedIds((current) => {
        const next = new Set(current);
        next.add(node.id);
        return next;
      });
    }
  };

  const focusNode = async (nodeId: string) => {
    await ensureNodeLoadedAndExpanded(nodeId);
    setSelectedNodeId(nodeId);
    setDetailsOpen(true);
    setDetailPanelVisible(true);
    resetView();
    scrollNodeIntoView(nodeId);
  };

  const focusSearchHit = async (hit: TaxonomySearchHit | SearchHit) => {
    const path = 'path' in hit ? hit.path || [] : [];

    if (path.length > 0) {
      for (const ancestor of path.slice(0, -1)) {
        if (!ancestor.id) continue;
        const children = await getTaxonomyChildren(ancestor.id) as TreeNode[];
        setTree((current) => updateNodeChildren(current, ancestor.id, children));
        setExpandedIds((current) => {
          const next = new Set(current);
          next.add(ancestor.id);
          return next;
        });
      }

      setSelectedNodeId(hit.id);
      setDetailsOpen(true);
      setDetailPanelVisible(true);
      resetView();
      setSearchQuery('');
      scrollNodeIntoView(hit.id);
      return;
    }

    await focusNode(hit.id);
    setSearchQuery('');
  };

  const handleSelectNode = async (node: TreeNode) => {
    setSelectedNodeId(node.id);
    setDetailsOpen(true);
    setDetailPanelVisible(true);
  };

  const handleToggleNode = async (node: TreeNode, event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!node.has_children) return;

    if (expandedIds.has(node.id)) {
      const next = new Set(expandedIds);
      next.delete(node.id);
      setExpandedIds(next);
      return;
    }

    setSelectedNodeId(node.id);
    setDetailsOpen(true);
    setDetailPanelVisible(true);
    await loadNodeChildren(node);
    setExpandedIds((current) => {
      const next = new Set(current);
      next.add(node.id);
      return next;
    });
  };

  const handleToggleSelectedNodeFromDetails = async () => {
    if (!selectedNode) return;
    await handleToggleNode(selectedNode);
    setDetailsOpen(false);
    setDetailPanelVisible(false);
    scrollNodeIntoView(selectedNode.id);
  };

  const renderNode = (node: TreeNode) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const hasChildren = Boolean(node.has_children);
    const childNodes = node.children || [];
    const visibleChildren = childNodes.slice(0, MAX_CHILDREN_RENDERED);
    const hiddenCount = childNodes.length - visibleChildren.length;
    const isLoadingChildren = loadingChildrenIds.has(node.id);

    return (
      <div key={node.id} className="relative flex flex-col items-center">
        <motion.button
          type="button"
          layout
          ref={(element) => {
            if (element) nodeRefs.current.set(node.id, element);
            else nodeRefs.current.delete(node.id);
          }}
          onClick={() => {
            void handleSelectNode(node);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              void handleSelectNode(node);
            }

            if (event.key === 'ArrowRight' && node.has_children) {
              event.preventDefault();
              void handleToggleNode(node);
            }

            if (event.key === 'ArrowLeft' && expandedIds.has(node.id)) {
              event.preventDefault();
              setExpandedIds((current) => {
                const next = new Set(current);
                next.delete(node.id);
                return next;
              });
            }
          }}
          className={`relative z-10 min-w-[190px] max-w-[240px] cursor-pointer rounded-2xl border p-5 text-center shadow-sm transition-all ${
            isSelected
              ? 'border-emerald-500 bg-white ring-4 ring-emerald-100'
              : 'border-zinc-100 bg-white/90 hover:border-emerald-300 hover:shadow-md'
          }`}
        >
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-400">
            {rankLabel(node.rank)}
          </span>
          <span className="block truncate text-base font-bold text-zinc-900" title={node.name}>
            {node.name}
          </span>
          <span className="block truncate text-[11px] italic font-medium text-emerald-700" title={node.scientific_name}>
            {node.scientific_name}
          </span>

          <span className="mt-4 flex items-center justify-center gap-2 text-[10px] font-semibold text-zinc-500">
            {hasChildren && <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{isExpanded ? '已展开' : '可展开'}</span>}
          </span>
        </motion.button>

        {hasChildren && (
          <button
            type="button"
            onClick={(event) => {
              void handleToggleNode(node, event);
            }}
            className="absolute -bottom-3 left-1/2 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:border-emerald-400 hover:text-emerald-700"
            aria-label={isExpanded ? '收起下级分类' : '展开下级分类'}
          >
            {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
          </button>
        )}

        {isLoadingChildren && (
          <div className="mt-4 rounded-full bg-white px-3 py-1 text-[11px] text-emerald-700 shadow-sm">
            正在加载下级分类...
          </div>
        )}

        <AnimatePresence>
          {isExpanded && childNodes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="relative mt-16 flex gap-10"
            >
              <div className="absolute left-1/2 top-[-64px] h-16 w-0 -translate-x-1/2 border-l-2 border-zinc-200" />
              {visibleChildren.length > 1 && (
                <div className="absolute left-[12%] right-[12%] top-0 h-0 border-t-2 border-zinc-200" />
              )}

              {visibleChildren.map((child) => (
                <div key={child.id} className="relative">
                  <div className="absolute left-1/2 top-[-32px] h-8 w-0 -translate-x-1/2 border-l-2 border-zinc-200" />
                  {renderNode(child)}
                </div>
              ))}

              {hiddenCount > 0 && (
                <div className="flex min-w-[190px] items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-xs text-zinc-500">
                  还有 {hiddenCount} 个节点未显示，请使用搜索或继续筛选。
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const detailPanel = (
    <>
      <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-600">
            当前节点
          </span>
          <Info size={16} className="text-zinc-400" />
        </div>
        <h2 className="mb-1 truncate text-2xl font-headline font-bold text-zinc-900" title={selectedNode?.name || ''}>
          {selectedNode?.name || '未选择节点'}
        </h2>
        <p className="mb-3 truncate text-xs font-bold italic text-emerald-700" title={selectedNode?.scientific_name || ''}>
          {selectedNode?.scientific_name || '暂无学名'}
        </p>
        <p className="hidden text-sm leading-6 text-zinc-500">
          {selectedNode?.description || '点击左侧分类树中的任意节点，可以在这里查看该层级的名称、学名与说明。'}
        </p>

        {shouldShowDescription ? (
          <p className="text-sm leading-6 text-zinc-500">{selectedDescription}</p>
        ) : (
          <p className="text-sm leading-6 text-zinc-500">
            当前节点用于定位分类层级。分类树卡片保留中英文名称，具体展开关系由左侧树形结构呈现。
          </p>
        )}

        {selectedNode && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-zinc-50 p-3">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-400">层级</span>
              <span className="text-lg font-bold text-zinc-900">{rankLabel(selectedNode.rank)}</span>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-3">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-400">下级状态</span>
              <span className="text-lg font-bold text-emerald-700">{selectedNodeChildStatus}</span>
            </div>
          </div>
        )}

        {selectedPathText && (
          <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
            <span className="font-bold">当前路径：</span>{selectedPathText}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => openLibraryFromNode(selectedNode)}
            className={`${canOpenLibraryFromSelectedNode ? 'flex' : 'hidden'} flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 font-semibold text-white transition hover:bg-zinc-800`}
          >
            <Eye size={16} />
            查看植物库
          </button>
          {selectedNode?.has_children && (
            <button
              type="button"
              onClick={() => {
                void handleToggleSelectedNodeFromDetails();
              }}
              className={`${canOpenLibraryFromSelectedNode ? 'rounded-xl px-4' : 'flex flex-1 items-center justify-center rounded-xl'} border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100`}
            >
              {selectedNodeExpanded ? '收起此层' : '展开此层'}
            </button>
          )}
        </div>
      </section>

      {selectedNode?.rank === 'family' && (
      <section className="flex min-h-[22rem] flex-col overflow-hidden rounded-3xl border border-zinc-100 bg-zinc-50">
        <div className="flex items-center justify-between border-b border-zinc-200/60 bg-white p-5">
          <h3 className="font-headline text-lg font-bold text-zinc-900">代表属</h3>
          <span className="text-xs text-zinc-500">
            {selectedNode?.rank !== 'family' ? '选择科级节点后显示' : loadingGenera ? '加载中...' : `${genera.length} 个结果`}
          </span>
        </div>

        {selectedNode?.rank !== 'family' && (
          <div className="border-b border-zinc-200/60 bg-amber-50 px-5 py-3 text-xs text-amber-700">
            当前节点不是“科”层级。右侧代表属列表仅在选择科级节点时展示。
          </div>
        )}

        <div className="flex-grow space-y-3 overflow-y-auto p-4">
          {loadingGenera ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-sm text-zinc-500">
              正在加载该科下的属列表...
            </div>
          ) : genera.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-sm text-zinc-500">
              当前节点暂无可展示的代表属。
            </div>
          ) : (
            genera.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => openLibraryFromNode(selectedNode, item.scientific_name)}
                className="group flex w-full items-center gap-4 rounded-2xl border border-transparent bg-white p-3 text-left transition hover:border-emerald-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-emerald-50">
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
                      属
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-grow">
                  <h4 className="truncate text-sm font-bold text-zinc-900" title={item.chinese_name || item.name}>
                    {item.chinese_name || item.name}
                  </h4>
                  <p className="truncate text-[11px] text-zinc-500" title={item.scientific_name}>
                    {item.scientific_name}
                  </p>
                </div>
                <div className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-500">
                  {item.species_count || 0} 种
                </div>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-zinc-100 bg-white p-4">
          <button
            type="button"
            onClick={() => openLibraryFromNode(selectedNode)}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
          >
            进入植物库浏览
            <ArrowRight size={14} />
          </button>
        </div>
      </section>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-screen-2xl overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-8 xl:flex-row">
        <section
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-100 bg-gradient-to-b from-zinc-50 to-white shadow-sm xl:min-w-[600px]"
        >
          <div className="absolute left-6 top-6 z-20 max-w-2xl lg:left-8 lg:top-8">
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-headline font-extrabold tracking-tight text-zinc-900 lg:text-4xl">
              <Layers3 className="text-emerald-600" size={32} />
              分类树
            </h1>
            <p className="max-w-xl text-sm leading-6 text-zinc-600">
              以横向层级树的方式浏览植物分类。支持拖拽平移、滚轮缩放、节点展开/收起，并在右侧同步展示当前节点信息与代表属。
            </p>
          </div>

          <div className="absolute left-6 top-36 z-20 w-[calc(100%-3rem)] max-w-[22rem] lg:left-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索已加载节点的中文名或学名"
                className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-11 pr-4 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
            {searchQuery.trim() && (
              <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
                {taxonomySearchLoading ? (
                  <div className="px-4 py-3 text-sm text-zinc-500">正在搜索分类与植物名称...</div>
                ) : searchHits.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-zinc-500">当前已加载节点中没有匹配结果</div>
                ) : (
                  searchHits.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        void focusSearchHit(item);
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 text-left last:border-b-0 hover:bg-zinc-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-zinc-900" title={item.name}>
                          {highlightMatch(item.name, searchQuery)}
                        </span>
                        <span className="block truncate text-xs italic text-emerald-700" title={item.scientific_name}>
                          {highlightMatch(item.scientific_name, searchQuery)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-500">
                          {rankLabel(item.rank)}
                        </span>
                        {'match_source' in item && item.match_source === 'plant' && (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                            植物命中
                          </span>
                        )}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="absolute right-6 top-6 z-20 flex flex-wrap gap-2 lg:right-8 lg:top-8">
            <button type="button" onClick={() => setZoom((current) => Math.min(current + 0.1, 1.8))} className="rounded-xl border border-zinc-100 bg-white p-2 shadow-sm transition hover:bg-zinc-50" aria-label="放大分类树">
              <ZoomIn size={18} className="text-zinc-600" />
            </button>
            <button type="button" onClick={() => setZoom((current) => Math.max(current - 0.1, 0.55))} className="rounded-xl border border-zinc-100 bg-white p-2 shadow-sm transition hover:bg-zinc-50" aria-label="缩小分类树">
              <ZoomOut size={18} className="text-zinc-600" />
            </button>
            <button type="button" onClick={resetView} className="rounded-xl border border-zinc-100 bg-white p-2 shadow-sm transition hover:bg-zinc-50" aria-label="重置视图">
              <Maximize2 size={18} className="text-zinc-600" />
            </button>
            <button type="button" onClick={collapseAll} className="rounded-xl border border-zinc-100 bg-white p-2 shadow-sm transition hover:bg-zinc-50" aria-label="折叠所有节点">
              <RotateCcw size={18} className="text-zinc-600" />
            </button>
          </div>

          <div className="border-b border-zinc-100/80 px-6 pb-5 pt-64 lg:px-8">
            <div className="flex flex-wrap items-center gap-2">
              {selectedPath.length > 0 ? selectedPath.map((node, index) => (
                <React.Fragment key={node.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void focusNode(node.id);
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedNodeId === node.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                    title={node.name}
                  >
                    {node.name}
                  </button>
                  {index < selectedPath.length - 1 && <ChevronRight size={14} className="text-zinc-300" />}
                </React.Fragment>
              )) : (
                <span className="text-xs text-zinc-400">选择节点后显示当前浏览路径</span>
              )}
            </div>
          </div>

          <div
            ref={treeViewportRef}
            className={`min-h-0 flex-1 overflow-auto px-8 pb-16 pt-14 lg:px-10 ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="flex min-w-max items-start justify-center transition-transform duration-75 ease-out"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transformOrigin: 'center top'
              }}
            >
              {loadingTree ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
                  正在加载分类树...
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-sm text-rose-700">
                  <p>分类树加载失败：{error}</p>
                  <button
                    type="button"
                    onClick={() => void loadRootTree()}
                    className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
                  >
                    重新加载
                  </button>
                </div>
              ) : !visualRoot ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
                  当前暂无可展示的分类节点。
                </div>
              ) : (
                renderNode(visualRoot)
              )}
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 z-20 hidden -translate-x-1/2 lg:block">
            <div className="rounded-full border border-zinc-100 bg-white/85 px-4 py-2 text-xs text-zinc-500 shadow-sm backdrop-blur">
              拖拽平移 · 滚轮缩放 · 搜索快速定位 · Enter/Space 选择节点 · 左右方向键展开/收起
            </div>
          </div>
        </section>

        <aside className={`${detailPanelVisible ? 'hidden xl:flex' : 'hidden'} w-full shrink-0 flex-col gap-6 xl:w-[400px] xl:min-w-[360px]`}>
          {detailPanel}
        </aside>
      </div>

      <button
        type="button"
        onClick={() => {
          setDetailsOpen(true);
          setDetailPanelVisible(true);
        }}
        className={`fixed bottom-6 right-6 z-40 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-xl ${detailPanelVisible ? 'xl:hidden' : 'xl:block'}`}
      >
        查看节点详情
      </button>

      <AnimatePresence>
        {detailsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-zinc-950/40 xl:hidden"
            onClick={() => setDetailsOpen(false)}
          >
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="absolute inset-y-0 right-0 flex w-[88vw] max-w-[420px] flex-col gap-6 overflow-y-auto bg-zinc-50 p-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm"
                aria-label="关闭节点详情"
              >
                <X size={18} />
              </button>
              {detailPanel}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
