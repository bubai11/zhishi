import React, { useEffect, useState } from 'react';
import { Compass, GitBranch, Search, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { getPlants, getPlantStats, prefetchPlantDetail } from '../api';
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

  const openLibraryWithSearch = () => {
    onOpenLibrary();
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
          <div className="mx-auto flex max-w-2xl items-center rounded-xl border border-white/20 bg-white/70 p-2 shadow-xl backdrop-blur-md">
            <div className="flex flex-1 items-center px-4">
              <Search className="text-zinc-500" size={24} />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    openLibraryWithSearch();
                  }
                }}
                placeholder="输入植物名称或学名"
                className="w-full border-none bg-transparent py-4 text-lg text-zinc-900 placeholder-zinc-500 focus:ring-0"
              />
            </div>
            <button onClick={openLibraryWithSearch} className="rounded-lg bg-emerald-600 px-8 py-4 font-bold text-white transition-all hover:bg-emerald-700">
              搜索植物
            </button>
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
              <img src={featured.cover_image || 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&q=80&w=1200'} alt={featured.chinese_name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" decoding="async" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 p-8">
                <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">本周焦点</span>
                <h3 className="mt-4 font-headline text-3xl font-bold text-white">{featured.chinese_name}</h3>
                <p className="mt-2 max-w-md text-white/80 italic">{featured.scientific_name}</p>
                <p className="mt-2 max-w-md text-white/70">{featured.short_desc}</p>
              </div>
            </div>

            {others.map((plant) => (
              <div key={plant.id} onClick={() => onSelectPlant(plant.id)} onMouseEnter={() => prefetchPlantDetail(plant.id)} onFocus={() => prefetchPlantDetail(plant.id)} className="group cursor-pointer overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                <img src={plant.cover_image || 'https://images.unsplash.com/photo-1508349167430-309603099951?auto=format&fit=crop&q=80&w=800'} alt={plant.chinese_name} className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                <div className="p-5">
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
          <div>
            <div className="mb-2 font-headline text-5xl font-extrabold text-emerald-800">{stats?.total_species ?? '--'}</div>
            <p className="font-medium text-zinc-600">记录物种</p>
          </div>
          <div>
            <div className="mb-2 font-headline text-5xl font-extrabold text-emerald-800">{stats?.total_images ?? '--'}</div>
            <p className="font-medium text-zinc-600">植物图像</p>
          </div>
          <div>
            <div className="mb-2 font-headline text-5xl font-extrabold text-emerald-800">{stats?.active_users ?? '--'}</div>
            <p className="font-medium text-zinc-600">近 30 天活跃用户</p>
          </div>
        </div>
      </section>
    </div>
  );
}
