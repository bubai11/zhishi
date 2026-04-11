import React, { useEffect, useState } from 'react';
import { ChevronLeft, Heart, Info, MapPin, Wind, Sun, Droplets, Thermometer } from 'lucide-react';
import { createFavorite, deleteFavorite, getFavoriteStatus, getPlantDetail, recordBrowseEvent } from '../api';
import type { PlantDetailResponse } from '../types';

interface PlantDetailProps {
  plantId: string;
  setCurrentPage?: (page: string) => void;
  token: string | null;
}

export default function PlantDetail({ plantId, setCurrentPage, token }: PlantDetailProps) {
  const [detail, setDetail] = useState<PlantDetailResponse | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteSubmitting, setFavoriteSubmitting] = useState(false);

  useEffect(() => {
    getPlantDetail(plantId)
      .then((detailData) => {
        setDetail(detailData);
        setActiveImage(0);
      })
      .catch(() => {
        setDetail(null);
      });
  }, [plantId]);

  useEffect(() => {
    if (!token) {
      setIsFavorite(false);
      return;
    }

    getFavoriteStatus(plantId, token)
      .then((result) => setIsFavorite(result.is_favorite))
      .catch(() => setIsFavorite(false));
  }, [plantId, token]);

  useEffect(() => {
    if (!token) return;
    recordBrowseEvent(plantId, token).catch(() => {});
  }, [plantId, token]);

  const images = detail?.images?.length ? detail.images : (detail?.cover_image ? [detail.cover_image] : []);
  const iucnCategory = detail?.iucn_category || detail?.conservation_status || '';

  const conservationGuide = (() => {
    switch (iucnCategory) {
      case 'CR':
        return {
          label: '极危',
          tone: 'bg-rose-50 border-rose-100 text-rose-700',
          description: '该植物面临极高灭绝风险，野外种群通常非常脆弱，适合作为重点保护案例深入学习。'
        };
      case 'EN':
        return {
          label: '濒危',
          tone: 'bg-amber-50 border-amber-100 text-amber-700',
          description: '该植物已处于较高风险状态，建议重点关注其分布范围、栖息环境以及人为干扰压力。'
        };
      case 'VU':
        return {
          label: '易危',
          tone: 'bg-yellow-50 border-yellow-100 text-yellow-700',
          description: '该植物尚未达到最严峻风险等级，但已出现种群下降趋势，适合结合生态环境一起理解。'
        };
      case 'NT':
        return {
          label: '近危',
          tone: 'bg-sky-50 border-sky-100 text-sky-700',
          description: '该植物暂未进入核心濒危等级，但已接近风险阈值，适合作为保护预警案例观察。'
        };
      case 'LC':
        return {
          label: '无危',
          tone: 'bg-emerald-50 border-emerald-100 text-emerald-700',
          description: '该植物整体风险较低，可与濒危植物进行对比，理解不同保护等级背后的生态差异。'
        };
      default:
        return {
          label: detail?.conservation_status || '暂无数据',
          tone: 'bg-zinc-50 border-zinc-100 text-zinc-700',
          description: '当前知识库尚未提供标准化保护等级，可结合分布、观察记录和生态描述进行综合判断。'
        };
    }
  })();

  const handleToggleFavorite = async () => {
    if (!token || favoriteSubmitting) return;

    setFavoriteSubmitting(true);
    try {
      if (isFavorite) {
        await deleteFavorite(plantId, token);
        setIsFavorite(false);
      } else {
        await createFavorite(plantId, token);
        setIsFavorite(true);
      }
    } finally {
      setFavoriteSubmitting(false);
    }
  };

  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-20">
        <button
          onClick={() => setCurrentPage?.('library')}
          className="mb-8 flex items-center gap-2 text-sm font-bold text-zinc-500 transition-colors hover:text-emerald-600"
        >
          <ChevronLeft size={18} />
          返回植物库
        </button>
        <div className="rounded-3xl border border-zinc-100 bg-white px-8 py-12 text-sm text-zinc-500 shadow-sm">
          暂未获取到植物详情，请返回植物库后重试。
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-12 px-8 py-12">
      <button
        onClick={() => setCurrentPage?.('library')}
        className="group mb-4 flex items-center gap-2 text-zinc-400 transition-colors hover:text-emerald-600"
      >
        <ChevronLeft size={20} className="transition-transform group-hover:-translate-x-1" />
        <span className="text-sm font-bold uppercase tracking-widest">返回植物库</span>
      </button>

      <header className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-800">
              科：{detail.family_name || '未知'}
            </span>
            <span className="rounded bg-zinc-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              属：{detail.genus_name || '未知'}
            </span>
          </div>
          <h1 className="font-headline text-5xl font-extrabold tracking-tight text-zinc-900 md:text-6xl">
            {detail.chinese_name || detail.scientific_name}
          </h1>
          <p className="text-xl font-medium italic text-emerald-600">{detail.scientific_name}</p>
        </div>

        <button
          onClick={handleToggleFavorite}
          disabled={!token || favoriteSubmitting}
          className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition-all ${
            isFavorite
              ? 'border-rose-200 bg-rose-50 text-rose-600'
              : 'border-zinc-200 bg-white text-zinc-600'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          {isFavorite ? '已收藏' : token ? '加入收藏' : '登录后可收藏'}
        </button>
      </header>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 lg:col-span-7">
          <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-zinc-100 shadow-xl">
            <img
              src={images[activeImage] || 'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?auto=format&fit=crop&q=80&w=1600'}
              alt={detail.chinese_name || detail.scientific_name}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              decoding="async"
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            {images.slice(0, 4).map((img, index) => (
              <button
                key={img}
                onClick={() => setActiveImage(index)}
                className={`aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                  index === activeImage ? 'border-emerald-600' : 'border-transparent hover:border-emerald-200'
                }`}
              >
                <img
                  src={img}
                  alt={`${detail.chinese_name || detail.scientific_name}-${index + 1}`}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        </div>

        <aside className="col-span-12 space-y-8 lg:col-span-5">
          <div className="space-y-6 rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-xl font-bold text-zinc-900">科学分类</h2>
              <Info size={18} className="text-zinc-300" />
            </div>
            <div className="space-y-4">
              {Object.entries(detail.taxonomy).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between border-b border-zinc-50 py-2 last:border-0">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{key}</span>
                  <span className="text-sm font-semibold text-zinc-900">{value || '-'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 rounded-2xl border border-zinc-100 bg-zinc-50 p-8">
            <h2 className="font-headline text-xl font-bold text-zinc-900">环境适应性</h2>
            <div className="space-y-4">
              {([
                { icon: <Sun size={15} />, label: '光照需求', value: detail.ecology.light, low: '耐阴', high: '强光' },
                { icon: <Droplets size={15} />, label: '水分需求', value: detail.ecology.water, low: '耐旱', high: '喜湿' },
                { icon: <Thermometer size={15} />, label: '温度适应', value: detail.ecology.temperature, low: '耐寒', high: '喜热' },
                { icon: <Wind size={15} />, label: '空气湿度', value: detail.ecology.air, low: '耐干燥', high: '喜湿润' }
              ] as const).map(({ icon, label, value, low, high }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5 font-semibold text-zinc-700">{icon}{label}</span>
                    <span className="font-mono text-zinc-400">{value}/100</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>{low}</span>
                    <span>{high}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-xl font-bold text-zinc-900">全球分布</h2>
              <MapPin size={18} className="text-emerald-600" />
            </div>
            <p className="text-sm text-zinc-600">{detail.detail.distribution_text || '暂无分布描述。'}</p>
            <p className="text-xs text-zinc-500">观察记录数：{detail.observation_count}</p>
          </div>

          <div className="space-y-5 rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-xl font-bold text-zinc-900">保护等级解读</h2>
              <Info size={18} className="text-zinc-300" />
            </div>
            <div className={`rounded-2xl border p-4 ${conservationGuide.tone}`}>
              <div className="text-xs font-bold uppercase tracking-widest">IUCN / 保护现状</div>
              <div className="mt-2 text-lg font-bold">{conservationGuide.label}</div>
              <p className="mt-2 text-sm leading-6">{conservationGuide.description}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
              学习提示：可以先结合分布区域、观察记录数量和生态说明理解该植物的生存环境，再对照保护等级，更容易建立“植物特征与保护需求之间的联系”。
            </div>
          </div>
        </aside>
      </div>

      <section className="mx-auto max-w-4xl space-y-10 py-16">
        <div className="space-y-6">
          <h2 className="border-l-4 border-emerald-600 pl-6 font-headline text-3xl font-extrabold text-zinc-900">
            植物学概览
          </h2>
          <p className="font-body text-lg leading-relaxed text-zinc-600">{detail.detail.intro || '暂无概览信息。'}</p>
        </div>

        <div className="grid grid-cols-1 gap-12 pt-10 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="font-headline text-xl font-bold text-zinc-900">形态特征</h3>
            <p className="text-sm leading-relaxed text-zinc-600">{detail.detail.morphology || '暂无形态信息。'}</p>
          </div>

          <div className="space-y-4">
            <h3 className="font-headline text-xl font-bold text-zinc-900">生态意义</h3>
            <p className="text-sm leading-relaxed text-zinc-600">{detail.detail.ecology_importance || '暂无生态说明。'}</p>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-800">保护现状</p>
              <p className="text-sm font-semibold text-emerald-700">{detail.conservation_status || '暂无数据'}</p>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-white p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">继续学习</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCurrentPage?.('analysis')}
                  className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800"
                >
                  查看保护分析
                </button>
                <button
                  onClick={() => setCurrentPage?.('classification')}
                  className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200"
                >
                  回到分类系统
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {(detail.translation_source || detail.translation_confidence !== undefined) && (
        <section className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-6 py-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">中文名数据来源</p>
            <div className="flex flex-wrap items-center gap-3">
              {detail.translation_source && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  detail.translation_source === 'iplant' ? 'bg-emerald-100 text-emerald-800' :
                  detail.translation_source === 'gbif' ? 'bg-blue-100 text-blue-800' :
                  detail.translation_source === 'manual' ? 'bg-violet-100 text-violet-800' :
                  detail.translation_source === 'rule' ? 'bg-amber-100 text-amber-800' :
                  'bg-zinc-100 text-zinc-600'
                }`}>
                  {{
                    iplant: '中国植物志 (iPlant)',
                    gbif: '全球生物多样性数据库 (GBIF)',
                    manual: '人工核定',
                    rule: '属名规则推断',
                    legacy: '历史数据'
                  }[detail.translation_source] || detail.translation_source}
                </span>
              )}
              {(detail.translation_confidence ?? 0) > 0 && (
                <span className="text-xs text-zinc-500">
                  置信度 <span className="font-bold text-zinc-700">{detail.translation_confidence}%</span>
                </span>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
