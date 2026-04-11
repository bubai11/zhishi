import React, { useEffect, useState } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { getFamilies, getGenera, getPlants, prefetchPlantDetail } from '../api';
import type { Genus, PlantCard, TaxaFamily } from '../types';

interface LibraryProps {
  setCurrentPage: (page: string) => void;
  onSelectPlant: (plantId: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sort: 'latest' | 'popular' | 'alpha';
  onSortChange: (value: 'latest' | 'popular' | 'alpha') => void;
  page: number;
  onPageChange: (value: number) => void;
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function Library({
  onSelectPlant,
  searchQuery,
  onSearchQueryChange,
  sort,
  onSortChange,
  page,
  onPageChange
}: LibraryProps) {
  const [plants, setPlants] = useState<PlantCard[]>([]);
  const [families, setFamilies] = useState<TaxaFamily[]>([]);
  const [genera, setGenera] = useState<Genus[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<TaxaFamily | null>(null);
  const [selectedGenus, setSelectedGenus] = useState('');
  const [total, setTotal] = useState(0);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);
  const maxPage = Math.max(1, Math.ceil(total / 6));

  useEffect(() => {
    getFamilies()
      .then((data) => setFamilies(data.slice(0, 8)))
      .catch(() => setFamilies([]));
  }, []);

  useEffect(() => {
    if (!selectedFamily?.id) {
      setGenera([]);
      setSelectedGenus('');
      return;
    }

    let cancelled = false;

    getGenera(selectedFamily.id)
      .then((data) => {
        if (cancelled) return;
        setGenera(data.list || []);
      })
      .catch(() => {
        if (cancelled) return;
        setGenera([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFamily?.id]);

  useEffect(() => {
    let cancelled = false;

    getPlants({
      page,
      pageSize: 6,
      sort,
      q: debouncedSearchQuery || undefined,
      family: selectedFamily?.scientific_name || undefined,
      genus: selectedGenus || undefined
    })
      .then((data) => {
        if (cancelled) return;
        setPlants(data.list);
        setTotal(data.total);
      })
      .catch(() => {
        if (cancelled) return;
        setPlants([]);
        setTotal(0);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, selectedFamily?.scientific_name, selectedGenus, page, sort]);

  useEffect(() => {
    if (page > maxPage) {
      onPageChange(maxPage);
    }
  }, [page, maxPage, onPageChange]);

  const selectedFamilyLabel = selectedFamily?.name || '';
  const selectedGenusLabel = genera.find((item) => item.scientific_name === selectedGenus)?.name || selectedGenus;

  return (
    <div className="mx-auto flex max-w-screen-2xl gap-8 px-8 py-12">
      <aside className="hidden w-72 flex-shrink-0 space-y-10 lg:block">
        <div className="space-y-6">
          <h3 className="px-4 text-xs font-bold uppercase tracking-widest text-zinc-400">科筛选</h3>
          <div className="space-y-1">
            {families.map((family) => (
              <button
                key={family.id}
                onClick={() => {
                  const nextFamily = selectedFamily?.scientific_name === family.scientific_name ? null : family;
                  setSelectedFamily(nextFamily);
                  setSelectedGenus('');
                  onPageChange(1);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left transition-all ${
                  selectedFamily?.scientific_name === family.scientific_name
                    ? 'bg-emerald-50 font-semibold text-emerald-700'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{family.name}</span>
                  {family.name !== family.scientific_name && (
                    <span className="block truncate text-[11px] font-normal italic text-zinc-400">{family.scientific_name}</span>
                  )}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">{family.species_count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="px-4 text-xs font-bold uppercase tracking-widest text-zinc-400">属快速查看</h3>
          {!selectedFamily ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">
              先选择一个科，再快速查看其下相关属和植物。
            </div>
          ) : genera.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">
              当前科下暂无可快速筛选的属数据。
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={() => {
                  setSelectedGenus('');
                  onPageChange(1);
                }}
                className={`w-full rounded-lg px-4 py-2.5 text-left text-sm transition-all ${
                  !selectedGenus ? 'bg-zinc-900 font-semibold text-white' : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                全部属
              </button>
              {genera.slice(0, 10).map((genus) => (
                <button
                  key={genus.id}
                  onClick={() => {
                    setSelectedGenus(selectedGenus === genus.scientific_name ? '' : genus.scientific_name);
                    onPageChange(1);
                  }}
                  className={`w-full rounded-lg px-4 py-2.5 text-left transition-all ${
                    selectedGenus === genus.scientific_name
                      ? 'bg-emerald-50 font-semibold text-emerald-700'
                      : 'text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  <span className="block truncate text-sm">{genus.name}</span>
                  {genus.name !== genus.scientific_name && (
                    <span className="block truncate text-[11px] italic text-zinc-400">{genus.scientific_name}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <div className="flex-grow space-y-8">
        <section className="space-y-6 rounded-xl border border-zinc-100 bg-zinc-50 p-6">
          <div className="flex flex-col items-center gap-4 md:flex-row">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  onSearchQueryChange(event.target.value);
                  onPageChange(1);
                }}
                placeholder="搜索植物、属名或常用名"
                className="w-full rounded-lg border-none bg-white py-3 pl-12 pr-4 text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-white p-1 shadow-sm">
              <button
                onClick={() => {
                  onSortChange('latest');
                  onPageChange(1);
                }}
                className={`rounded-md px-4 py-2 text-sm font-medium ${sort === 'latest' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
              >
                最新
              </button>
              <button
                onClick={() => {
                  onSortChange('popular');
                  onPageChange(1);
                }}
                className={`rounded-md px-4 py-2 text-sm font-medium ${sort === 'popular' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
              >
                热门
              </button>
              <button
                onClick={() => {
                  onSortChange('alpha');
                  onPageChange(1);
                }}
                className={`rounded-md px-4 py-2 text-sm font-medium ${sort === 'alpha' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
              >
                A-Z
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">显示 <span className="font-bold text-zinc-900">{total}</span> 个已记录物种</p>
            <button className="flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline">
              <Filter size={14} />
              {selectedGenus
                ? `当前筛选：${selectedFamilyLabel} / ${selectedGenusLabel}`
                : selectedFamily
                  ? `当前筛选：${selectedFamilyLabel}`
                  : '筛选科属'}
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plants.map((plant) => (
            <motion.article
              key={plant.id}
              whileHover={{ y: -5 }}
              onClick={() => onSelectPlant(plant.id)}
              onMouseEnter={() => prefetchPlantDetail(plant.id)}
              onFocus={() => prefetchPlantDetail(plant.id)}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm transition-all hover:shadow-md"
            >
              <div className="relative h-56 overflow-hidden">
                <img
                  src={plant.cover_image || 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80&w=1200'}
                  alt={plant.chinese_name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute right-4 top-4 max-w-[10rem] rounded-2xl bg-white/85 px-3 py-2 text-right text-emerald-800 shadow-sm backdrop-blur-md">
                  <div className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700/80">科</div>
                  <div className="truncate text-xs font-bold">{plant.family}</div>
                  {plant.family_scientific_name && plant.family !== plant.family_scientific_name && (
                    <div className="truncate text-[10px] italic text-zinc-500">{plant.family_scientific_name}</div>
                  )}
                </div>
              </div>
              <div className="flex flex-grow flex-col p-6">
                <div className="mb-3">
                  <h2 className="font-headline text-xl font-bold leading-tight text-zinc-900">{plant.chinese_name}</h2>
                  <p className="text-xs font-medium italic text-emerald-600">{plant.scientific_name}</p>
                </div>
                <p className="mb-6 line-clamp-2 text-sm leading-relaxed text-zinc-600">{plant.short_desc}</p>
                <div className="mt-auto flex items-center justify-end border-t border-zinc-50 pt-6">
                  <button className="group/btn flex items-center gap-1 text-sm font-bold text-emerald-700">
                    详情
                    <ArrowRight size={14} className="transition-transform group-hover/btn:translate-x-1" />
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <nav className="flex items-center justify-center gap-4 pt-10">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={20} />
          </button>
          <button className="h-10 w-10 rounded-full bg-emerald-600 text-sm font-bold text-white">{page}</button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= maxPage}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronRight size={20} />
          </button>
        </nav>
      </div>
    </div>
  );
}
