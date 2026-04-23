import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react';
import { motion } from 'motion/react';
import { getFamilies, getGenera, getPlants, prefetchPlantDetail } from '../api';
import type { Genus, PlantCard, TaxaFamily } from '../types';

const LIBRARY_LIST_CACHE = new Map<string, { plants: PlantCard[]; total: number; cachedAt: number }>();
const LIBRARY_LIST_CACHE_TTL_MS = 90 * 1000;

type LibraryTaxonomyFilter = {
  familyId?: string;
  familyName?: string;
  familyScientificName?: string;
  genusScientificName?: string;
  divisionScientificName?: string;
  divisionName?: string;
};

interface LibraryProps {
  setCurrentPage: (page: string) => void;
  onSelectPlant: (plantId: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sort: 'latest' | 'popular' | 'alpha';
  onSortChange: (value: 'latest' | 'popular' | 'alpha') => void;
  page: number;
  onPageChange: (value: number) => void;
  taxonomyFilter?: LibraryTaxonomyFilter;
  onTaxonomyFilterChange?: (filter: LibraryTaxonomyFilter) => void;
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function buildVisiblePages(page: number, maxPage: number) {
  const visibleCount = Math.min(5, maxPage);
  const halfWindow = Math.floor(visibleCount / 2);
  const startPage = Math.min(
    Math.max(1, page - halfWindow),
    Math.max(1, maxPage - visibleCount + 1)
  );

  return Array.from({ length: visibleCount }, (_, index) => startPage + index);
}

export default function Library({
  onSelectPlant,
  searchQuery,
  onSearchQueryChange,
  sort,
  onSortChange,
  page,
  onPageChange,
  taxonomyFilter,
  onTaxonomyFilterChange
}: LibraryProps) {
  const [plants, setPlants] = useState<PlantCard[]>([]);
  const [families, setFamilies] = useState<TaxaFamily[]>([]);
  const [genera, setGenera] = useState<Genus[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<TaxaFamily | null>(null);
  const [selectedGenus, setSelectedGenus] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [total, setTotal] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);
  const maxPage = Math.max(1, Math.ceil(total / 6));

  const selectedFamilyLabel = selectedFamily?.name || '';
  const selectedGenusLabel = genera.find((item) => item.scientific_name === selectedGenus)?.name || selectedGenus;
  const selectedDivisionLabel = taxonomyFilter?.divisionName || selectedDivision;
  const visiblePages = useMemo(() => buildVisiblePages(page, maxPage), [page, maxPage]);
  const filterLabel = selectedGenus
    ? `当前筛选：${selectedFamilyLabel || '全部科'} / ${selectedGenusLabel}`
    : selectedFamily
      ? `当前筛选：${selectedFamilyLabel}`
      : '筛选科属';

  const displayFilterLabel = selectedDivision && !selectedFamily && !selectedGenus
    ? `当前筛选：类群 / ${selectedDivisionLabel}`
    : filterLabel;

  useEffect(() => {
    getFamilies()
      .then((data) => setFamilies(data.slice(0, 8)))
      .catch(() => setFamilies([]));
  }, []);

  useEffect(() => {
    const nextDivision = String(taxonomyFilter?.divisionScientificName || '').trim();
    setSelectedDivision(nextDivision);
    if (nextDivision) {
      setSelectedFamily(null);
      setSelectedGenus('');
      onPageChange(1);
    }
  }, [onPageChange, taxonomyFilter?.divisionScientificName]);

  useEffect(() => {
    if (!taxonomyFilter?.familyScientificName) {
      if (taxonomyFilter?.genusScientificName) {
        setSelectedDivision('');
        setSelectedGenus(taxonomyFilter.genusScientificName);
        onPageChange(1);
      }
      return;
    }

    const matchedFamily = families.find((family) => family.scientific_name === taxonomyFilter.familyScientificName);
    setSelectedDivision('');
    setSelectedFamily(
      matchedFamily || {
        id: taxonomyFilter.familyId || '',
        name: taxonomyFilter.familyName || taxonomyFilter.familyScientificName,
        scientific_name: taxonomyFilter.familyScientificName,
        species_count: 0
      }
    );
    setSelectedGenus('');
    onPageChange(1);
  }, [
    families,
    onPageChange,
    taxonomyFilter?.familyId,
    taxonomyFilter?.familyName,
    taxonomyFilter?.familyScientificName,
    taxonomyFilter?.genusScientificName
  ]);

  useEffect(() => {
    if (!selectedFamily?.id) {
      setGenera([]);
      if (!taxonomyFilter?.genusScientificName) {
        setSelectedGenus('');
      }
      return;
    }

    let cancelled = false;

    getGenera(selectedFamily.id)
      .then((data) => {
        if (!cancelled) setGenera(data.list || []);
      })
      .catch(() => {
        if (!cancelled) setGenera([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFamily?.id, taxonomyFilter?.genusScientificName]);

  useEffect(() => {
    if (taxonomyFilter?.genusScientificName) {
      setSelectedGenus(taxonomyFilter.genusScientificName);
      onPageChange(1);
    }
  }, [onPageChange, taxonomyFilter?.genusScientificName]);

  useEffect(() => {
    let cancelled = false;

    const cacheKey = JSON.stringify({
      page,
      pageSize: 6,
      sort,
      q: debouncedSearchQuery || '',
      family: selectedFamily?.scientific_name || '',
      genus: selectedGenus || '',
      division: selectedDivision || ''
    });

    const cached = LIBRARY_LIST_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < LIBRARY_LIST_CACHE_TTL_MS) {
      setPlants(cached.plants);
      setTotal(cached.total);
    }

    getPlants({
      page,
      pageSize: 6,
      sort,
      q: debouncedSearchQuery || undefined,
      family: selectedFamily?.scientific_name || undefined,
      genus: selectedGenus || undefined,
      division: selectedDivision || undefined
    })
      .then((data) => {
        if (cancelled) return;
        if (selectedDivision && data.total === 0) {
          setSelectedDivision('');
          onTaxonomyFilterChange?.({});
          onPageChange(1);
          return;
        }
        setPlants(data.list);
        setTotal(data.total);
        LIBRARY_LIST_CACHE.set(cacheKey, {
          plants: data.list,
          total: data.total,
          cachedAt: Date.now()
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPlants([]);
        setTotal(0);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, selectedFamily?.scientific_name, selectedGenus, selectedDivision, page, sort]);

  useEffect(() => {
    if (page > maxPage) {
      onPageChange(maxPage);
    }
  }, [page, maxPage, onPageChange]);

  const handleFamilySelect = (family: TaxaFamily) => {
    const nextFamily = selectedFamily?.scientific_name === family.scientific_name ? null : family;
    setSelectedDivision('');
    onTaxonomyFilterChange?.({});
    setSelectedFamily(nextFamily);
    setSelectedGenus('');
    onPageChange(1);
  };

  const handleGenusSelect = (scientificName: string) => {
    setSelectedDivision('');
    onTaxonomyFilterChange?.({});
    setSelectedGenus(selectedGenus === scientificName ? '' : scientificName);
    onPageChange(1);
  };

  const handleClearFilter = () => {
    setSelectedDivision('');
    setSelectedFamily(null);
    setSelectedGenus('');
    onTaxonomyFilterChange?.({});
    onPageChange(1);
  };

  const handleSortChange = (nextSort: 'latest' | 'popular' | 'alpha') => {
    onSortChange(nextSort);
    onPageChange(1);
  };

  const familyList = (
    <div className="space-y-1">
      {families.map((family) => (
        <button
          key={family.id}
          onClick={() => handleFamilySelect(family)}
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
  );

  const genusList = !selectedFamily ? (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">
      先选择一个科，再查看其下相关属和植物。
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
          onClick={() => handleGenusSelect(genus.scientific_name)}
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
  );

  return (
    <div className="mx-auto flex max-w-screen-2xl gap-8 px-8 py-12">
      <aside className="hidden w-72 flex-shrink-0 space-y-10 lg:block">
        <div className="space-y-6">
          <h3 className="px-4 text-xs font-bold uppercase tracking-widest text-zinc-400">科筛选</h3>
          {familyList}
        </div>

        <div className="space-y-6">
          <h3 className="px-4 text-xs font-bold uppercase tracking-widest text-zinc-400">属快速查看</h3>
          {genusList}
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
                placeholder="搜索植物、科属或常用名"
                className="w-full rounded-lg border-none bg-white py-3 pl-12 pr-4 text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-white p-1 shadow-sm">
              {[
                ['latest', '最新'],
                ['popular', '热门'],
                ['alpha', 'A-Z']
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => handleSortChange(value as 'latest' | 'popular' | 'alpha')}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    sort === value ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">
              显示 <span className="font-bold text-zinc-900">{total}</span> 个已记录物种
            </p>
            <button
              onClick={() => setIsFilterOpen(true)}
              className="flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
            >
              <Filter size={14} />
              <span className="max-w-[16rem] truncate">{displayFilterLabel}</span>
            </button>
          </div>
        </section>

        {plants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-500">
            当前筛选下暂无植物记录。
          </div>
        ) : (
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
        )}

        <nav className="flex flex-wrap items-center justify-center gap-2 pt-10">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Previous page"
          >
            <ChevronLeft size={20} />
          </button>

          {visiblePages.map((num) => (
            <button
              key={num}
              onClick={() => onPageChange(num)}
              className={`h-10 w-10 rounded-full text-sm font-bold transition-colors ${
                page === num ? 'bg-emerald-600 text-white' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {num}
            </button>
          ))}

          <button
            onClick={() => onPageChange(Math.min(maxPage, page + 1))}
            disabled={page >= maxPage}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Next page"
          >
            <ChevronRight size={20} />
          </button>
        </nav>
      </div>

      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40">
          <button
            className="absolute inset-0 cursor-default"
            onClick={() => setIsFilterOpen(false)}
            aria-label="Close taxonomy filter"
          />
          <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">筛选科属</h2>
                <p className="mt-1 text-sm text-zinc-500">{displayFilterLabel}</p>
              </div>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-2">
              <div className="min-h-0 overflow-auto border-b border-zinc-100 p-6 md:border-b-0 md:border-r">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">科</h3>
                  {(selectedFamily || selectedGenus) && (
                    <button onClick={handleClearFilter} className="text-xs font-bold text-zinc-500 hover:text-zinc-900">
                      清除
                    </button>
                  )}
                </div>
                {familyList}
              </div>

              <div className="min-h-0 overflow-auto p-6">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">属</h3>
                {genusList}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-5">
              <button
                onClick={handleClearFilter}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                清除筛选
              </button>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="rounded-xl bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
