import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Compass, GitBranch, Search, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { getPlants, getPlantStats, getSearchSuggestions, prefetchPlantDetail } from '../api';
import type { PlantCard, PlantStats } from '../types';

interface HomeProps {
  setCurrentPage: (page: string) => void;
  onSelectPlant: (plantId: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOpenLibrary: () => void;
}

export default function Home({ setCurrentPage, onSelectPlant, searchQuery, onSearchQueryChange, onOpenLibrary }: HomeProps) {
  const [plants, setPlants] = useState<PlantCard[]>([]);
  const [stats, setStats] = useState<PlantStats | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ plant_id: string; text: string; type: 'chinese_name' | 'scientific_name' }>>([]);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      getPlants({ sort: 'popular', page: 1, pageSize: 4 }),
      getPlantStats()
    ])
      .then(([plantData, statsData]) => {
        setPlants(plantData.list);
        setStats(statsData);
      })
      .catch(() => {
        setPlants([]);
        setStats(null);
      });
  }, []);

  const featured = plants[0];
  const others = plants.slice(1, 4);
  const learningPaths = [
    {
      title: '认识植物基础分类',
      description: '从门、纲、目到科属，先建立植物知识的整体框架，再进入具体物种。',
      action: '进入分类系统',
      icon: GitBranch,
      onClick: () => setCurrentPage('classification')
    },
    {
      title: '按兴趣探索热门植物',
      description: '从当前最受关注的植物开始，快速形成对外观、分布和生态特征的直观认识。',
      action: '浏览植物库',
      icon: Compass,
      onClick: () => setCurrentPage('library')
    },
    {
      title: '了解濒危与保护意义',
      description: '结合可视化分析和红色名录预警，理解植物保护等级与生态风险。',
      action: '查看分析页',
      icon: ShieldCheck,
      onClick: () => setCurrentPage('analysis')
    }
  ];

  useEffect(() => {
    const keyword = String(searchQuery || '').trim();
    if (keyword.length < 1) {
      setSuggestions([]);
      setIsSuggestOpen(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      getSearchSuggestions(keyword, 8)
        .then((res) => {
          if (cancelled) return;
          setSuggestions(res.suggestions || []);
          setIsSuggestOpen(Boolean((res.suggestions || []).length));
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setIsSuggestOpen(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!suggestBoxRef.current) return;
      if (event.target instanceof Node && !suggestBoxRef.current.contains(event.target)) {
        setIsSuggestOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (text: string) => {
    onSearchQueryChange(text);
    setIsSuggestOpen(false);
    onOpenLibrary();
  };

  const openLibraryWithSearch = () => {
    setIsSuggestOpen(false);
    onOpenLibrary();
  };

  const handleClearSearch = () => {
    onSearchQueryChange('');
    setSuggestions([]);
    setIsSuggestOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-24 pb-24">
      <section className="relative flex h-[600px] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&q=80&w=2000"
            alt="Forest Canopy"
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-white/10" />
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-4xl px-6 text-center">
          <h1 className="mb-6 font-headline text-5xl font-extrabold tracking-tight text-white drop-shadow-lg md:text-7xl">探索植物知识库</h1>
          <div ref={suggestBoxRef} className="mx-auto max-w-2xl">
            <div className="flex items-center rounded-xl border border-white/20 bg-white/70 p-2 shadow-xl backdrop-blur-md">
              <div className="flex flex-1 items-center px-4">
              <Search className="text-zinc-500 shrink-0" size={24} />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onFocus={() => {
                  if (suggestions.length) setIsSuggestOpen(true);
                }}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    openLibraryWithSearch();
                  }
                  if (event.key === 'Escape') {
                    setIsSuggestOpen(false);
                  }
                }}
                placeholder="输入植物名称或学名"
                className="w-full border-none bg-transparent py-4 text-lg text-zinc-900 placeholder-zinc-500 focus:ring-0"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="ml-2 shrink-0 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  aria-label="清除搜索"
                >
                  ✕
                </button>
              )}
              </div>
              <button onClick={openLibraryWithSearch} className="rounded-lg bg-emerald-600 px-8 py-4 font-bold text-white transition-all hover:bg-emerald-700">
                搜索
              </button>
            </div>

            {isSuggestOpen && suggestions.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-xl border border-emerald-100 bg-white/95 text-left shadow-xl backdrop-blur-md">
                {suggestions.map((item) => (
                  <button
                    key={`${item.type}-${item.plant_id}-${item.text}`}
                    onClick={() => handleSelectSuggestion(item.text)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-emerald-50"
                  >
                    <span className="font-medium text-zinc-900">{item.text}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                      {item.type === 'chinese_name' ? '中文名' : '学名'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-8">
        <div className="mb-12 rounded-[2rem] border border-emerald-100 bg-[linear-gradient(135deg,#f7fff8_0%,#eef8f1_100%)] p-8 shadow-sm">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="mb-2 font-headline text-4xl font-extrabold text-emerald-900">学习路径引导</h2>
              <p className="max-w-3xl text-zinc-600">系统不仅提供植物资料检索，也提供从分类理解、物种认识到保护意识建立的渐进式学习路径。</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {learningPaths.map((path) => (
              <button
                key={path.title}
                onClick={path.onClick}
                className="group rounded-3xl border border-white/70 bg-white/80 p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <path.icon size={22} />
                </div>
                <h3 className="text-lg font-headline font-bold text-zinc-900">{path.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{path.description}</p>
                <div className="mt-5 text-sm font-bold text-emerald-700 transition-colors group-hover:text-emerald-800">{path.action} -&gt;</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-12 flex items-end justify-between">
          <div>
            <h2 className="mb-2 font-headline text-4xl font-extrabold text-emerald-900">热门植物</h2>
            <p className="text-zinc-600">按近 30 天热度排序，展示当前知识库里最受关注的植物。</p>
          </div>
          <button onClick={() => setCurrentPage('library')} className="font-bold text-emerald-700 hover:underline">
            查看全部 -&gt;
          </button>
        </div>

        {featured && (
          <div className="grid h-auto grid-cols-1 grid-rows-2 gap-6 md:h-[800px] md:grid-cols-4">
            <div onClick={() => onSelectPlant(featured.id)} onMouseEnter={() => prefetchPlantDetail(featured.id)} onFocus={() => prefetchPlantDetail(featured.id)} className="relative overflow-hidden rounded-xl cursor-pointer group md:col-span-2 md:row-span-2">
              <img
                src={featured.cover_image || 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&q=80&w=1200'}
                alt={featured.chinese_name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
                decoding="async"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&q=80&w=1200'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 p-8">
                <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">近30天热度</span>
                <h3 className="mt-4 font-headline text-3xl font-bold text-white">{featured.chinese_name}</h3>
                <p className="mt-2 max-w-md text-white/80 italic">{featured.scientific_name}</p>
                <p className="mt-2 max-w-md text-white/70">{featured.short_desc}</p>
              </div>
            </div>

            {others.map((plant) => (
              <div key={plant.id} onClick={() => onSelectPlant(plant.id)} onMouseEnter={() => prefetchPlantDetail(plant.id)} onFocus={() => prefetchPlantDetail(plant.id)} className="group cursor-pointer overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 flex flex-col">
                <div className="relative overflow-hidden" style={{ height: '200px' }}>
                  <img
                    src={plant.cover_image || 'https://images.unsplash.com/photo-1508349167430-309603099951?auto=format&fit=crop&q=80&w=800'}
                    alt={plant.chinese_name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1508349167430-309603099951?auto=format&fit=crop&q=80&w=800'; }}
                  />
                </div>
                <div className="p-5 flex-1">
                  <h4 className="font-bold text-zinc-900">{plant.chinese_name}</h4>
                  <p className="mt-1 text-xs italic text-emerald-600">{plant.scientific_name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{plant.short_desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-zinc-200/50 bg-zinc-50 py-20">
        <div className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-12 px-10 text-center md:grid-cols-3">
          <button
            onClick={() => setCurrentPage('library')}
            className="group rounded-2xl p-6 transition-all hover:bg-white hover:shadow-md"
          >
            <div className="mb-3 flex items-center justify-center gap-2">
              <BookOpen size={20} className="text-emerald-600" />
              <div className="font-headline text-5xl font-extrabold text-emerald-800">{stats?.total_species?.toLocaleString() ?? '--'}</div>
            </div>
            <p className="font-medium text-zinc-600">记录物种</p>
            <p className="mt-2 text-sm text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">点击浏览植物库 →</p>
          </button>
          <button
            onClick={() => setCurrentPage('library')}
            className="group rounded-2xl p-6 transition-all hover:bg-white hover:shadow-md"
          >
            <div className="mb-3 flex items-center justify-center gap-2">
              <TrendingUp size={20} className="text-emerald-600" />
              <div className="font-headline text-5xl font-extrabold text-emerald-800">{stats?.total_images?.toLocaleString() ?? '--'}</div>
            </div>
            <p className="font-medium text-zinc-600">植物图像</p>
            <p className="mt-2 text-sm text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">点击探索图像 →</p>
          </button>
          <button
            onClick={() => setCurrentPage('analysis')}
            className="group rounded-2xl p-6 transition-all hover:bg-white hover:shadow-md"
          >
            <div className="mb-3 flex items-center justify-center gap-2">
              <Users size={20} className="text-emerald-600" />
              <div className="font-headline text-5xl font-extrabold text-emerald-800">{stats?.active_users?.toLocaleString() ?? '--'}</div>
            </div>
            <p className="font-medium text-zinc-600">近 30 天活跃用户</p>
            <p className="mt-2 text-sm text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">点击查看生态分析 →</p>
          </button>
        </div>
      </section>
    </div>
  );
}
