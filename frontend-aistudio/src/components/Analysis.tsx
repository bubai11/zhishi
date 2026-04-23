import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Database, Map as MapIcon, MapPin, ShieldCheck, Sprout, Table as TableIcon } from 'lucide-react';
import * as echarts from 'echarts/core';
import { ScatterChart } from 'echarts/charts';
import {
  GeoComponent,
  TooltipComponent,
  VisualMapComponent,
  TitleComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  dismissAlert,
  getAlertUnreadCount,
  getAlertsFiltered,
  getAnalyticsSummary,
  getDiversity,
  getHeatmap,
  getMyAlerts,
  getProtectedAreaDetail,
  getProtectedAreas,
  getProtectedAreaStats,
  getRegionProtectionSummary,
  markAlertRead,
  markAllAlertsRead,
  restoreAlert
} from '../api';
import type { Alert, AnalyticsSummary, DiversityItem, ProtectedArea, ProtectedAreaStats, RegionalData, RegionProtectionSummary } from '../types';
import { WGSRPD_CENTROIDS } from '../data/wgsrpdCentroids';
import { getRegionZhName } from '../data/wgsrpdNames';

echarts.use([ScatterChart, GeoComponent, TooltipComponent, VisualMapComponent, TitleComponent, CanvasRenderer]);

const REDLIST_CATEGORY_LABELS: Record<string, string> = {
  CR: '极危',
  EN: '濒危',
  VU: '易危',
  NT: '近危',
  LC: '无危',
  DD: '数据缺乏',
  EX: '灭绝',
  EW: '野外灭绝'
};

interface AnalysisProps {
  setCurrentPage?: (page: string) => void;
  onSelectPlant?: (plantId: string) => void;
  onOpenLibraryWithFamily?: (familyScientificName: string, familyName?: string) => void;
  token: string | null;
}

export default function Analysis({ setCurrentPage, onSelectPlant, onOpenLibraryWithFamily, token }: AnalysisProps) {
  const [alertDisplayLimit, setAlertDisplayLimit] = useState(5);
  const [alertPage, setAlertPage] = useState(1);
  const [alertPages, setAlertPages] = useState(1);
  const [alertTotal, setAlertTotal] = useState(0);
  const [alertLevelFilter, setAlertLevelFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [changeTypeFilter, setChangeTypeFilter] = useState<'all' | 'upgraded' | 'downgraded' | 'new_assessment' | 'new_addition'>('all');
  const [viewMode, setViewMode] = useState<'map' | 'table'>('table');
  const [alertFilter, setAlertFilter] = useState<'unread' | 'all' | 'dismissed'>('unread');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [protectedAreaBaseStats, setProtectedAreaBaseStats] = useState<ProtectedAreaStats | null>(null);
  const [protectedAreaStats, setProtectedAreaStats] = useState<ProtectedAreaStats | null>(null);
  const [protectedAreaList, setProtectedAreaList] = useState<ProtectedArea[]>([]);
  const [protectedAreaTotal, setProtectedAreaTotal] = useState(0);
  const [protectedAreaFilters, setProtectedAreaFilters] = useState({
    iucnCategory: '',
    siteType: '',
    realm: '',
    iso3: ''
  });
  const [protectedAreaLoading, setProtectedAreaLoading] = useState(false);
  const [activeProtectedArea, setActiveProtectedArea] = useState<ProtectedArea | null>(null);
  const [diversity, setDiversity] = useState<DiversityItem[]>([]);
  const [heatmap, setHeatmap] = useState<RegionalData[]>([]);       // top-8 表格用
  const [heatmapFull, setHeatmapFull] = useState<RegionalData[]>([]); // 地图用
  const [selectedRegion, setSelectedRegion] = useState<RegionalData | null>(null);
  const [regionProtection, setRegionProtection] = useState<RegionProtectionSummary | null>(null);
  const [regionProtectionLoading, setRegionProtectionLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [worldGeoReady, setWorldGeoReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const handleOpenFamily = (item: DiversityItem) => {
    const familyValue = String(item.scientific_name || item.name || '').trim();
    if (!familyValue || familyValue.toLowerCase() === 'unknown_family') return;
    onOpenLibraryWithFamily?.(familyValue, item.name);
  };

  const refreshUnreadCount = async () => {
    if (!token) return;
    const result = await getAlertUnreadCount(token);
    setUnreadCount(result.total);
  };

  const handleSelectRegion = useCallback((region: RegionalData) => {
    setSelectedRegion(region);
    window.setTimeout(() => {
      summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }, []);

  useEffect(() => {
    setAlertPage(1);
  }, [alertDisplayLimit, alertFilter, alertLevelFilter, changeTypeFilter, token]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      getAnalyticsSummary(),
      getProtectedAreaStats(),
      getProtectedAreas({ limit: 5 }),
      getDiversity('family'),
      getHeatmap({ limit: 500 }),
      token
        ? getMyAlerts(token, {
            unreadOnly: alertFilter === 'unread',
            includeDismissed: alertFilter === 'dismissed',
            limit: alertDisplayLimit,
            page: alertPage,
            alertLevel: alertLevelFilter,
            changeType: changeTypeFilter
          }).then((result) => ({
            ...result,
            data: result.data.filter((item) => alertFilter !== 'dismissed' || item.is_dismissed)
          }))
        : getAlertsFiltered({
            limit: alertDisplayLimit,
            page: alertPage,
            alertLevel: alertLevelFilter,
            changeType: changeTypeFilter
          }),
      token ? getAlertUnreadCount(token).then((result) => result.total) : Promise.resolve(0)
    ])
      .then(([summaryData, protectedStatsData, protectedAreaData, diversityData, heatmapData, alertResponse, unreadTotal]) => {
        setSummary(summaryData);
        setProtectedAreaBaseStats(protectedStatsData);
        setProtectedAreaStats(protectedStatsData);
        setProtectedAreaList(protectedAreaData.data);
        setProtectedAreaTotal(protectedAreaData.total);
        setDiversity(diversityData);
        setHeatmapFull(heatmapData);
        setHeatmap(heatmapData.slice(0, 8));
        setSelectedRegion((current) => current || heatmapData[0] || null);
        setAlerts(alertResponse.data);
        setAlertPages(Math.max(1, alertResponse.pages || 1));
        setAlertTotal(alertResponse.total || 0);
        setUnreadCount(unreadTotal);
      })
      .catch((err) => {
        setSummary(null);
        setProtectedAreaBaseStats(null);
        setProtectedAreaStats(null);
        setProtectedAreaList([]);
        setProtectedAreaTotal(0);
        setDiversity([]);
        setHeatmap([]);
        setHeatmapFull([]);
        setSelectedRegion(null);
        setRegionProtection(null);
        setAlerts([]);
        setAlertPages(1);
        setAlertTotal(0);
        setUnreadCount(0);
        setError(err instanceof Error ? err.message : '分析数据加载失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [alertDisplayLimit, alertFilter, alertLevelFilter, changeTypeFilter, alertPage, token]);

  // 加载世界地图 GeoJSON 并注册到 ECharts（优先本地，降级 CDN）
  useEffect(() => {
    if ((echarts as any).getMap('world')) {
      setWorldGeoReady(true);
      return;
    }
    const localUrl = '/data/world.geojson';
    const cdnUrl = 'https://cdn.jsdelivr.net/gh/holtzy/D3-graph-gallery@master/DATA/world.geojson';
    fetch(localUrl)
      .then((r) => (r.ok ? r : fetch(cdnUrl)))
      .then((r) => r.json())
      .then((geojson) => {
        echarts.registerMap('world', geojson);
        setWorldGeoReady(true);
      })
      .catch(() => setWorldGeoReady(false));
  }, []);

  // 挂载 / 更新 ECharts 实例
  useEffect(() => {
    if (viewMode !== 'map' || !worldGeoReady || !mapRef.current || heatmapFull.length === 0) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(mapRef.current, null, { renderer: 'canvas' });
    }

    const scatterData = heatmapFull
      .filter((d) => d.area_code_l3 && WGSRPD_CENTROIDS[d.area_code_l3])
      .map((d) => {
        const [lng, lat] = WGSRPD_CENTROIDS[d.area_code_l3!];
        return {
          name: d.region,
          value: [lng, lat, d.species_count],
          area_code: d.area_code_l3,
          region_zh: d.region_zh || getRegionZhName(d.area_code_l3, d.region),
          protected_area_count: d.protected_area_count || 0,
          high_risk_species_count: d.high_risk_species_count || 0
        };
      });

    const maxCount = Math.max(...scatterData.map((d) => d.value[2] as number), 1);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const [, , count] = params.value;
          const data = params.data || {};
          return [
            `<b>${params.name}</b>`,
            `中文名：${data.region_zh || '-'}`,
            `物种记录数：${Number(count).toLocaleString()}`,
            `保护地数量：${Number(data.protected_area_count || 0).toLocaleString()}`,
            `高风险物种：${Number(data.high_risk_species_count || 0).toLocaleString()}`
          ].join('<br/>');
        }
      },
      visualMap: {
        min: 0,
        max: maxCount,
        show: true,
        orient: 'vertical',
        left: 10,
        bottom: 20,
        text: ['多', '少'],
        textStyle: { color: '#6b7280', fontSize: 11 },
        inRange: { color: ['#bbf7d0', '#4ade80', '#16a34a', '#14532d'] }
      },
      geo: {
        map: 'world',
        roam: true,
        zoom: 1.2,
        itemStyle: {
          areaColor: '#1a2a1a',
          borderColor: '#2d5a27',
          borderWidth: 0.5
        },
        emphasis: {
          itemStyle: { areaColor: '#2d5a27' },
          label: { show: false }
        },
        label: { show: false }
      },
      series: [{
        type: 'scatter',
        coordinateSystem: 'geo',
        data: scatterData,
        symbolSize: (val: number[]) => Math.max(6, Math.min(40, Math.sqrt(val[2]) * 1.5)),
        encode: { value: 2 },
        itemStyle: { color: '#4ade80', opacity: 0.85 },
        emphasis: {
          itemStyle: { color: '#fbbf24', opacity: 1 },
          scale: 1.4
        }
      }]
    } as any;

    chartRef.current.setOption(option, true);
    chartRef.current.off('click');
    chartRef.current.on('click', (params: any) => {
      const areaCode = params?.data?.area_code;
      const target = heatmapFull.find((item) => item.area_code_l3 === areaCode);
      if (target) {
        handleSelectRegion(target);
      }
    });

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode, worldGeoReady, heatmapFull, handleSelectRegion]);

  // 切离地图视图时销毁实例，避免内存泄漏
  useEffect(() => {
    if (viewMode !== 'map' && chartRef.current) {
      chartRef.current.dispose();
      chartRef.current = null;
    }
  }, [viewMode]);

  useEffect(() => {
    if (!selectedRegion?.area_code_l3) {
      setRegionProtection(null);
      return;
    }

    setRegionProtectionLoading(true);
    getRegionProtectionSummary(selectedRegion.area_code_l3)
      .then(setRegionProtection)
      .catch(() => setRegionProtection(null))
      .finally(() => setRegionProtectionLoading(false));
  }, [selectedRegion?.area_code_l3]);

  useEffect(() => {
    setProtectedAreaLoading(true);
    const statsParams = {
      iucnCategory: protectedAreaFilters.iucnCategory || undefined,
      siteType: protectedAreaFilters.siteType || undefined,
      realm: protectedAreaFilters.realm || undefined,
      iso3: protectedAreaFilters.iso3 || undefined
    };
    const listParams = {
      ...statsParams,
      limit: 8
    };

    Promise.all([
      getProtectedAreaStats(statsParams),
      getProtectedAreas(listParams)
    ])
      .then(([statsData, listData]) => {
        setProtectedAreaStats(statsData);
        setProtectedAreaList(listData.data);
        setProtectedAreaTotal(listData.total);
      })
      .catch(() => {
        setProtectedAreaStats(null);
        setProtectedAreaList([]);
        setProtectedAreaTotal(0);
      })
      .finally(() => setProtectedAreaLoading(false));
  }, [protectedAreaFilters.iucnCategory, protectedAreaFilters.siteType, protectedAreaFilters.realm, protectedAreaFilters.iso3]);

  const handleOpenPlantDetail = (plantId?: number | null) => {
    if (!plantId) return;
    setActiveAlert(null);
    onSelectPlant?.(String(plantId));
  };

  const handleMarkRead = async (alertId?: number) => {
    if (!token || !alertId) return;
    await markAlertRead(alertId, token);
    setAlerts((current) => current.map((item) => (item.id === alertId ? { ...item, is_read: true } : item)));
    setActiveAlert((current) => (current?.id === alertId ? { ...current, is_read: true } : current));
    await refreshUnreadCount();
  };

  const handleDismiss = async (alertId?: number) => {
    if (!token || !alertId) return;
    await dismissAlert(alertId, token);
    setAlerts((current) =>
      current
        .map((item) => (item.id === alertId ? { ...item, is_read: true, is_dismissed: true } : item))
        .filter((item) => alertFilter === 'dismissed' || !item.is_dismissed)
    );
    setActiveAlert((current) => (current?.id === alertId ? { ...current, is_read: true, is_dismissed: true } : current));
    await refreshUnreadCount();
  };

  const handleRestore = async (alertId?: number) => {
    if (!token || !alertId) return;
    await restoreAlert(alertId, token);
    if (alertFilter === 'dismissed') {
      setAlerts((current) => current.filter((item) => item.id !== alertId));
    } else {
      setAlerts((current) => current.map((item) => (item.id === alertId ? { ...item, is_read: false, is_dismissed: false } : item)));
    }
    setActiveAlert((current) => (current?.id === alertId ? { ...current, is_read: false, is_dismissed: false } : current));
    await refreshUnreadCount();
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    await markAllAlertsRead(token);
    setAlerts((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  };

  const handleToggleAlertExpand = () => {
    setAlertDisplayLimit((current) => (current === 5 ? 12 : 5));
  };

  const topRegions = heatmap.slice(0, 3);
  const maxTopRegionCount = Math.max(...topRegions.map((item) => item.species_count), 1);
  const totalSpeciesDisplay = summary?.total_species?.toLocaleString() ?? '--';
  const topProtectedCategories = protectedAreaStats?.byCategory?.slice(0, 4) ?? [];
  const topProtectedTypes = protectedAreaStats?.byType?.slice(0, 4) ?? [];
  const topProtectedRealms = protectedAreaStats?.byRealm?.slice(0, 4) ?? [];
  const categoryOptions = protectedAreaBaseStats?.byCategory?.map((item) => item.iucn_category).filter((item): item is string => Boolean(item)) ?? [];
  const siteTypeOptions = protectedAreaBaseStats?.byType?.map((item) => item.site_type).filter((item): item is string => Boolean(item)) ?? [];
  const realmOptions = protectedAreaBaseStats?.byRealm?.map((item) => item.realm).filter((item): item is string => Boolean(item)) ?? [];
  const formatArea = (value?: string | number | null) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return '面积未标注';
    return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 1 })} km²`;
  };
  const renderDistribution = (items: Array<{ count: number; iucn_category?: string | null; site_type?: string | null; realm?: string | null }>, keyName: 'iucn_category' | 'site_type' | 'realm') => {
    const maxCount = Math.max(...items.map((row) => Number(row.count || 0)), 1);

    if (items.length === 0) {
      return <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">暂无统计数据。</div>;
    }

    return items.map((item) => {
      const label = item[keyName] || '未标注';
      const count = Number(item.count || 0);
      return (
        <div key={`${keyName}-${label}`} className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-zinc-700">{label}</span>
            <span className="font-mono text-xs font-bold text-emerald-700">{count.toLocaleString()}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(6, (count / maxCount) * 100)}%` }} />
          </div>
        </div>
      );
    });
  };
  const handleOpenProtectedArea = async (siteId: number) => {
    const current = protectedAreaList.find((area) => area.site_id === siteId) || regionProtection?.protected_areas.find((area) => area.site_id === siteId) || null;
    setActiveProtectedArea(current);
    try {
      const detail = await getProtectedAreaDetail(siteId);
      setActiveProtectedArea(detail);
    } catch {
      // Keep list-level information visible if the detail request fails.
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-8 py-12">
      <header className="mb-10">
        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-zinc-900 md:text-5xl">生态智能分析</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          汇总植物多样性、区域热度与红色名录预警，帮助快速识别重点保护区域与风险物种。
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          分析数据加载失败：{error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm lg:col-span-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-headline font-bold text-zinc-900">全球分布情况</h2>
              <p className="mt-1 text-sm text-zinc-500">切换地图与表格视图浏览各区域物种分布情况。</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-1">
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold ${
                  viewMode === 'map' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500'
                }`}
              >
                <MapIcon size={14} />
                地图
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold ${
                  viewMode === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500'
                }`}
              >
                <TableIcon size={14} />
                表格
              </button>
            </div>
          </div>

          <div className="relative mb-6 overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-900" style={{ height: '420px' }}>
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">正在加载分析数据...</div>
            ) : viewMode === 'map' ? (
              !worldGeoReady ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-zinc-400">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  正在加载世界地图...
                </div>
              ) : (
                <div ref={mapRef} className="h-full w-full" />
              )
            ) : heatmap.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500 bg-zinc-50">暂无区域热度数据。</div>
            ) : (
              <div className="absolute inset-0 overflow-auto bg-zinc-50 p-6">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="py-3 text-xs font-bold uppercase tracking-widest text-zinc-400">区域</th>
                      <th className="py-3 text-xs font-bold uppercase tracking-widest text-zinc-400">物种记录数</th>
                      <th className="py-3 text-xs font-bold uppercase tracking-widest text-zinc-400">来源结构</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.map((row, index) => (
                      <tr
                        key={`${row.region}-${index}`}
                        onClick={() => handleSelectRegion(row)}
                        className={`cursor-pointer border-b border-zinc-50 transition-colors ${
                          selectedRegion?.area_code_l3 === row.area_code_l3 ? 'bg-emerald-50' : 'hover:bg-white'
                        }`}
                      >
                        <td className="py-4 text-sm font-bold text-zinc-900">
                          <span>{getRegionZhName(row.area_code_l3, row.region)}</span>
                          <span className="ml-2 text-xs font-normal text-zinc-400">{row.region}</span>
                        </td>
                        <td className="py-4 text-sm font-mono text-emerald-700">{row.species_count.toLocaleString()}</td>
                        <td className="py-4 text-sm text-zinc-600">{row.trend}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-100 pt-6">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-lg font-headline font-bold text-zinc-900">区域保护信息</h3>
                <p className="mt-1 text-sm text-zinc-500">点击记录较多区域，查看物种记录、保护地数量、受胁物种与保护信息。</p>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <Activity size={14} />
                WCVP + IUCN + WDPA 联合分析
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">物种知识底座</p>
                    <p className="mt-2 font-headline text-3xl font-extrabold text-zinc-900">{totalSpeciesDisplay}</p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">一次性导入的 WCVP 初始知识库记录，用于支撑检索、分类浏览和区域统计。</p>
                  </div>
                  <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(#059669_0_78%,#e4efe9_78%_100%)]">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                      <Sprout size={28} />
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/75 px-3 py-3">
                    <p className="text-[11px] font-bold text-zinc-400">关键区域</p>
                    <p className="mt-1 text-lg font-extrabold text-zinc-900">{summary?.critical_regions ?? '--'}</p>
                  </div>
                  <div className="rounded-xl bg-white/75 px-3 py-3">
                    <p className="text-[11px] font-bold text-zinc-400">受胁物种</p>
                    <p className="mt-1 text-lg font-extrabold text-rose-700">{summary?.threatened_species ?? '--'}</p>
                  </div>
                  <div className="rounded-xl bg-white/75 px-3 py-3">
                    <p className="text-[11px] font-bold text-zinc-400">保护地</p>
                    <p className="mt-1 text-lg font-extrabold text-zinc-900">{protectedAreaStats?.total ?? summary?.protected_areas ?? '--'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-100 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-rose-500">记录较多区域</p>
                    <p className="mt-1 text-sm text-zinc-500">记录较多区域 {summary?.critical_regions ?? '--'} 个，来源结构表示原生记录与引种记录的相对占比。</p>
                  </div>
                  <MapPin className="text-rose-500" size={22} />
                </div>
                <div className="space-y-3">
                  {topRegions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-500">暂无热点区域数据。</div>
                  ) : (
                    topRegions.map((item, index) => (
                      <button
                        key={`${item.region}-status-${index}`}
                        onClick={() => handleSelectRegion(item)}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition-all ${
                          selectedRegion?.area_code_l3 === item.area_code_l3
                            ? 'border-rose-200 bg-rose-50'
                            : 'border-zinc-100 bg-zinc-50 hover:border-zinc-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold text-zinc-800">{index + 1}. {getRegionZhName(item.area_code_l3, item.region)}</span>
                          <span className="font-mono text-xs font-bold text-emerald-700">{item.species_count.toLocaleString()}</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white">
                          <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(8, (item.species_count / maxTopRegionCount) * 100)}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-400">{item.trend || item.density_label}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div ref={summaryRef} className="mt-4 scroll-mt-6 rounded-2xl border border-zinc-100 bg-zinc-50 p-5">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">信息摘要</p>
                  <h4 className="mt-1 text-lg font-headline font-bold text-zinc-900">
                    {selectedRegion ? (
                      <>
                        {getRegionZhName(selectedRegion.area_code_l3, selectedRegion.region)}
                        <span className="ml-2 text-sm font-normal text-zinc-400">{selectedRegion.region}</span>
                      </>
                    ) : (
                      <span className="text-zinc-400 font-normal text-base">请在上方点击区域查看信息摘要</span>
                    )}
                  </h4>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-600">
                  <ShieldCheck size={14} />
                  区域保护响应
                </div>
              </div>

              {regionProtectionLoading ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">正在加载信息摘要...</div>
              ) : regionProtection ? (
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-white px-4 py-3">
                        <p className="text-[11px] font-bold text-zinc-400">物种记录数</p>
                        <p className="mt-1 text-xl font-extrabold text-zinc-900">{regionProtection.species_count.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-white px-4 py-3">
                        <p className="text-[11px] font-bold text-zinc-400">对应保护地</p>
                        <p className="mt-1 text-xl font-extrabold text-emerald-700">{regionProtection.protected_area_count.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-white px-4 py-3">
                        <p className="text-[11px] font-bold text-zinc-400">高风险物种</p>
                        <p className="mt-1 text-xl font-extrabold text-rose-700">{regionProtection.high_risk_species_count.toLocaleString()}</p>
                      </div>
                    </div>
                    {regionProtection.protected_area_count > 0 && (
                      <p className="mt-4 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm leading-6 text-zinc-600">
                        {regionProtection.protection_prompt}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {regionProtection.protected_area_categories.length === 0 ? (
                        null
                      ) : (
                        regionProtection.protected_area_categories.map((item) => (
                          <span key={item.iucn_category} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                            {item.iucn_category}: {item.count}
                          </span>
                        ))
                      )}
                    </div>

                    <div className="rounded-xl bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold text-zinc-900">代表性物种记录</p>
                        <span className="text-xs text-zinc-400">WCVP 分布记录</span>
                      </div>
                      <div className="space-y-3">
                        {(regionProtection.species_records || []).length === 0 ? (
                          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">暂无可展示物种记录。</div>
                        ) : (
                          (regionProtection.species_records || []).map((plant) => (
                            <button
                              key={plant.id}
                              onClick={() => handleOpenPlantDetail(plant.id)}
                              className="w-full rounded-xl border border-zinc-100 px-3 py-3 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-bold text-zinc-900">{plant.chinese_name || plant.scientific_name || `植物 ${plant.id}`}</p>
                                <span className="shrink-0 rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-600">{plant.occurrence_status || 'native'}</span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-500">{plant.scientific_name || '暂无学名'} · {plant.family || plant.genus || '分类信息未标注'}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold text-zinc-900">高风险物种</p>
                        <span className="text-xs text-zinc-400">CR / EN / VU</span>
                      </div>
                      <div className="space-y-3">
                        {(regionProtection.high_risk_species || []).length === 0 ? (
                          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">暂无高风险物种记录。</div>
                        ) : (
                          (regionProtection.high_risk_species || []).map((plant) => (
                            <button
                              key={`${plant.id}-${plant.plant_id || 'risk'}`}
                              onClick={() => plant.plant_id && handleOpenPlantDetail(plant.plant_id)}
                              className="w-full rounded-xl border border-zinc-100 px-3 py-3 text-left transition-colors hover:border-rose-200 hover:bg-rose-50"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-bold text-zinc-900">{plant.chinese_name || plant.scientific_name || `受胁物种 ${plant.id}`}</p>
                                <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                  {plant.red_list_category || '-'} {plant.red_list_category ? REDLIST_CATEGORY_LABELS[plant.red_list_category] || '未标注' : ''}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-500">{plant.scientific_name || '暂无学名'} · 种群趋势 {plant.population_trend || 'unknown'}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-bold text-zinc-900">代表性保护地</p>
                      <span className="text-xs text-zinc-400">{regionProtection.country_codes.join(', ') || '无国家代码'}</span>
                    </div>
                    <div className="space-y-3">
                      {regionProtection.protected_areas.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">暂无可关联保护地记录。</div>
                      ) : (
                        regionProtection.protected_areas.map((area) => (
                          <button key={area.site_id} onClick={() => handleOpenProtectedArea(area.site_id)} className="w-full rounded-xl border border-zinc-100 px-3 py-3 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-bold text-zinc-900">{area.name_local || area.name_eng || `保护地 ${area.site_id}`}</p>
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{area.iucn_category || '未标注'}</span>
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">{area.designation_eng || area.status || '暂无类型说明'} · {formatArea(area.gis_area || area.rep_area)}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">暂无区域信息摘要。</div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">保护地数据展示结果</p>
                  <p className="mt-1 text-sm text-zinc-500">基于 WDPA 保护地数据，支持类别分布、条件筛选、列表查看和详情弹窗。</p>
                </div>
                <Database className="text-zinc-700" size={22} />
              </div>

              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">作用范围：仅保护地模块</span>
              </div>
              <div className="mb-4 grid gap-3 md:grid-cols-4">
                <label className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                  <span className="mb-1 block font-bold text-zinc-700">IUCN Category</span>
                  <select
                    value={protectedAreaFilters.iucnCategory}
                    onChange={(event) => setProtectedAreaFilters((current) => ({ ...current, iucnCategory: event.target.value }))}
                    className="w-full bg-transparent text-xs font-medium text-zinc-700 outline-none"
                  >
                    <option value="">全部类别</option>
                    {categoryOptions.map((item) => <option key={item} value={item || ''}>{item}</option>)}
                  </select>
                </label>
                <label className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                  <span className="mb-1 block font-bold text-zinc-700">siteType</span>
                  <select
                    value={protectedAreaFilters.siteType}
                    onChange={(event) => setProtectedAreaFilters((current) => ({ ...current, siteType: event.target.value }))}
                    className="w-full bg-transparent text-xs font-medium text-zinc-700 outline-none"
                  >
                    <option value="">全部类型</option>
                    {siteTypeOptions.map((item) => <option key={item} value={item || ''}>{item}</option>)}
                  </select>
                </label>
                <label className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                  <span className="mb-1 block font-bold text-zinc-700">realm</span>
                  <select
                    value={protectedAreaFilters.realm}
                    onChange={(event) => setProtectedAreaFilters((current) => ({ ...current, realm: event.target.value }))}
                    className="w-full bg-transparent text-xs font-medium text-zinc-700 outline-none"
                  >
                    <option value="">全部领域</option>
                    {realmOptions.map((item) => <option key={item} value={item || ''}>{item}</option>)}
                  </select>
                </label>
                <label className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                  <span className="mb-1 block font-bold text-zinc-700">iso3</span>
                  <input
                    value={protectedAreaFilters.iso3}
                    onChange={(event) => setProtectedAreaFilters((current) => ({ ...current, iso3: event.target.value.toUpperCase().slice(0, 3) }))}
                    placeholder="如 CHN"
                    className="w-full bg-transparent text-xs font-medium uppercase text-zinc-700 outline-none"
                  />
                </label>
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-3">
                <div className="text-sm font-semibold text-zinc-700">
                  保护区总数 <span className="font-mono text-emerald-700">{(protectedAreaStats?.total ?? 0).toLocaleString()}</span>
                  <span className="ml-3 text-xs font-normal text-zinc-500">当前列表 {protectedAreaTotal.toLocaleString()} 条匹配结果</span>
                </div>
                <button
                  onClick={() => setProtectedAreaFilters({ iucnCategory: '', siteType: '', realm: '', iso3: '' })}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 transition-colors hover:border-zinc-300"
                >
                  清除筛选
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-3 rounded-xl border border-zinc-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">IUCN Category 分布</p>
                  {renderDistribution(topProtectedCategories, 'iucn_category')}
                </div>
                <div className="space-y-3 rounded-xl border border-zinc-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">siteType 分布</p>
                  {renderDistribution(topProtectedTypes, 'site_type')}
                </div>
                <div className="space-y-3 rounded-xl border border-zinc-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">realm 分布</p>
                  {renderDistribution(topProtectedRealms, 'realm')}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-zinc-900">保护区列表</p>
                  {protectedAreaLoading && <span className="text-xs text-zinc-400">正在更新...</span>}
                </div>
                <div className="space-y-3">
                  {protectedAreaList.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">暂无保护地列表数据。</div>
                  ) : (
                    protectedAreaList.map((area) => (
                      <button key={area.site_id} onClick={() => handleOpenProtectedArea(area.site_id)} className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold text-zinc-900">{area.name_local || area.name_eng || `保护地 ${area.site_id}`}</p>
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-600">{area.site_type || area.iucn_category || 'WDPA'}</span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">{area.iso3 || 'ISO 未标注'} · {area.status || '状态未标注'} · {formatArea(area.gis_area || area.rep_area)}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="col-span-12 flex flex-col gap-6 lg:col-span-4">
          <div className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">辅助信息</p>
              <h2 className="mt-1 text-base font-bold text-zinc-700">主要科属构成</h2>
              <p className="mt-0.5 text-xs text-zinc-400">展示当前知识库中主要科级类群的组成比例，点击类群可查看对应植物。</p>
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                  正在加载分类结构...
                </div>
              ) : diversity.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                  暂无分类统计数据。
                </div>
              ) : (
                diversity.map((item) => {
                  const familyValue = String(item.scientific_name || item.name || '').trim();
                  const canOpenFamily = Boolean(familyValue) && familyValue.toLowerCase() !== 'unknown_family';

                  return (
                  <button
                    key={`${item.scientific_name || item.name}-${item.name}`}
                    type="button"
                    disabled={!canOpenFamily}
                    onClick={() => handleOpenFamily(item)}
                    className="w-full cursor-pointer space-y-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-emerald-50 disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-zinc-700">{item.name}</span>
                      <span className="font-bold text-emerald-700">{item.count ? `${item.count} 种` : `${item.percentage}%`}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full border border-zinc-100 bg-zinc-50">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-900">濒危物种预警</p>
                <p className="text-xs text-zinc-500">
                  {token ? `未读 ${unreadCount} 条，共 ${alertTotal} 条匹配结果。` : `当前共有 ${alertTotal} 条匹配的红色名录预警。`}
                </p>
              </div>
            </div>

            {token && (
              <div className="mb-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-1">
                    <button onClick={() => setAlertFilter('unread')} className={`rounded-lg px-3 py-1 text-xs font-bold ${alertFilter === 'unread' ? 'bg-white text-rose-600 shadow-sm' : 'text-zinc-500'}`}>未读</button>
                    <button onClick={() => setAlertFilter('all')} className={`rounded-lg px-3 py-1 text-xs font-bold ${alertFilter === 'all' ? 'bg-white text-rose-600 shadow-sm' : 'text-zinc-500'}`}>全部</button>
                    <button onClick={() => setAlertFilter('dismissed')} className={`rounded-lg px-3 py-1 text-xs font-bold ${alertFilter === 'dismissed' ? 'bg-white text-rose-600 shadow-sm' : 'text-zinc-500'}`}>已忽略</button>
                  </div>
                  <button onClick={handleMarkAllRead} className="text-xs font-bold text-zinc-500 hover:text-zinc-900">全部已读</button>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">作用范围：仅预警模块</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                    <span className="font-bold text-zinc-700">风险</span>
                    <select value={alertLevelFilter} onChange={(event) => setAlertLevelFilter(event.target.value as 'all' | 'high' | 'medium' | 'low')} className="w-full bg-transparent text-xs font-medium text-zinc-700 outline-none">
                      <option value="all">全部等级</option>
                      <option value="high">高风险</option>
                      <option value="medium">中风险</option>
                      <option value="low">低风险</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                    <span className="font-bold text-zinc-700">变化</span>
                    <select value={changeTypeFilter} onChange={(event) => setChangeTypeFilter(event.target.value as 'all' | 'upgraded' | 'downgraded' | 'new_assessment' | 'new_addition')} className="w-full bg-transparent text-xs font-medium text-zinc-700 outline-none">
                      <option value="all">全部类型</option>
                      <option value="upgraded">风险升级</option>
                      <option value="downgraded">等级调整</option>
                      <option value="new_assessment">重新评估</option>
                      <option value="new_addition">新增受胁</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            {!token && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">作用范围：仅预警模块</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                  <span className="font-bold text-zinc-700">风险</span>
                  <select value={alertLevelFilter} onChange={(event) => setAlertLevelFilter(event.target.value as 'all' | 'high' | 'medium' | 'low')} className="w-full bg-transparent text-xs font-medium text-zinc-700 outline-none">
                    <option value="all">全部等级</option>
                    <option value="high">高风险</option>
                    <option value="medium">中风险</option>
                    <option value="low">低风险</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                  <span className="font-bold text-zinc-700">变化</span>
                  <select value={changeTypeFilter} onChange={(event) => setChangeTypeFilter(event.target.value as 'all' | 'upgraded' | 'downgraded' | 'new_assessment' | 'new_addition')} className="w-full bg-transparent text-xs font-medium text-zinc-700 outline-none">
                    <option value="all">全部类型</option>
                    <option value="upgraded">风险升级</option>
                    <option value="downgraded">等级调整</option>
                    <option value="new_assessment">重新评估</option>
                    <option value="new_addition">新增受胁</option>
                  </select>
                </label>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">正在加载预警...</div>
              ) : alerts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">暂无预警数据。</div>
              ) : (
                alerts.map((item, index) => (
                  <div key={`${item.id || item.title || 'alert'}-${index}`} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <button onClick={() => setActiveAlert(item)} className="text-left text-sm font-bold text-zinc-900 hover:text-rose-700">
                        {item.title || item.plant?.chinese_name || '未命名预警'}
                      </button>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        item.alert_level === 'high'
                          ? 'bg-rose-100 text-rose-700'
                          : item.alert_level === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {item.alert_level || 'info'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {item.plant?.scientific_name || '暂无学名'} ·{' '}
                      {item.old_category
                        ? `${item.old_category} -> ${item.new_category || item.threatenedSpecies?.red_list_category || '-'}`
                        : item.new_category || item.threatenedSpecies?.red_list_category || '未标注等级'}
                    </div>
                    {item.alert_reason && <div className="mt-2 text-xs leading-5 text-zinc-600">{item.alert_reason}</div>}
                    {item.alert_month && <div className="mt-2 text-[11px] text-zinc-400">{item.alert_month}</div>}
                    {token && item.id && (
                      <div className="mt-3 flex items-center gap-3">
                        {item.plant_id && (
                          <button onClick={() => handleOpenPlantDetail(item.plant_id)} className="text-[11px] font-bold text-rose-700 hover:text-rose-900">查看植物详情</button>
                        )}
                        {!item.is_read && !item.is_dismissed && (
                          <button onClick={() => handleMarkRead(item.id)} className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900">标记已读</button>
                        )}
                        {item.is_dismissed ? (
                          <button onClick={() => handleRestore(item.id)} className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900">恢复</button>
                        ) : (
                          <button onClick={() => handleDismiss(item.id)} className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800">忽略</button>
                        )}
                      </div>
                    )}
                    {!token && item.plant_id && (
                      <div className="mt-3 flex items-center gap-3">
                        <button onClick={() => handleOpenPlantDetail(item.plant_id)} className="text-[11px] font-bold text-rose-700 hover:text-rose-900">查看植物详情</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {alertTotal > alertDisplayLimit && (
              <button onClick={handleToggleAlertExpand} className="mt-4 w-full rounded-xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50">
                {alertDisplayLimit === 5 ? '查看更多预警' : '收起更多预警'}
              </button>
            )}

            {alertTotal > alertDisplayLimit && (
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500">
                <span>第 {alertPage} / {alertPages} 页</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAlertPage((current) => Math.max(1, current - 1))}
                    disabled={alertPage <= 1}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 font-semibold text-zinc-700 transition-all enabled:hover:border-zinc-300 enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setAlertPage((current) => Math.min(alertPages, current + 1))}
                    disabled={alertPage >= alertPages}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 font-semibold text-zinc-700 transition-all enabled:hover:border-zinc-300 enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}

            <button onClick={() => setCurrentPage?.('library')} className="mt-6 w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800">
              返回植物库查看详情
            </button>
          </div>
        </section>
      </div>

      {activeAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-headline font-bold text-zinc-900">{activeAlert.title || '预警详情'}</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {activeAlert.plant?.scientific_name || activeAlert.scientific_name || '暂无学名'}
                </p>
              </div>
              <button onClick={() => setActiveAlert(null)} className="text-sm font-bold text-zinc-400 hover:text-zinc-800">
                关闭
              </button>
            </div>

            <div className="space-y-4 text-sm text-zinc-600">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">风险变化</div>
                <div className="mt-2 font-semibold text-zinc-900">
                  {activeAlert.old_category
                    ? `${activeAlert.old_category} -> ${activeAlert.new_category || '-'}`
                    : activeAlert.new_category || activeAlert.threatenedSpecies?.red_list_category || '-'}
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">预警原因</div>
                <div className="mt-2 leading-6">{activeAlert.alert_reason || '暂无原因说明。'}</div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">变化类型</div>
                  <div className="mt-2 font-semibold text-zinc-900">{activeAlert.change_type || '-'}</div>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">预警月份</div>
                  <div className="mt-2 font-semibold text-zinc-900">{activeAlert.alert_month || '-'}</div>
                </div>
              </div>

              {activeAlert.plant_id && (
                <button onClick={() => handleOpenPlantDetail(activeAlert.plant_id)} className="w-full rounded-2xl bg-zinc-900 py-3 font-semibold text-white transition-all hover:bg-zinc-800">
                  打开植物详情
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeProtectedArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-8 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">保护区详情</p>
                <h3 className="mt-1 text-2xl font-headline font-bold text-zinc-900">
                  {activeProtectedArea.name_local || activeProtectedArea.name_eng || `保护地 ${activeProtectedArea.site_id}`}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">{activeProtectedArea.name_eng || activeProtectedArea.designation_eng || '暂无英文名称'}</p>
              </div>
              <button onClick={() => setActiveProtectedArea(null)} className="text-sm font-bold text-zinc-400 hover:text-zinc-800">
                关闭
              </button>
            </div>

            <div className="grid gap-4 text-sm text-zinc-600 md:grid-cols-2">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">基础标识</div>
                <div className="mt-2 space-y-1">
                  <p>site_id：<span className="font-semibold text-zinc-900">{activeProtectedArea.site_id}</span></p>
                  <p>ISO3：<span className="font-semibold text-zinc-900">{activeProtectedArea.iso3 || activeProtectedArea.parent_iso3 || '-'}</span></p>
                  <p>siteType：<span className="font-semibold text-zinc-900">{activeProtectedArea.site_type || '-'}</span></p>
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">保护分类</div>
                <div className="mt-2 space-y-1">
                  <p>IUCN Category：<span className="font-semibold text-zinc-900">{activeProtectedArea.iucn_category || '-'}</span></p>
                  <p>realm：<span className="font-semibold text-zinc-900">{activeProtectedArea.realm || '-'}</span></p>
                  <p>status：<span className="font-semibold text-zinc-900">{activeProtectedArea.status || '-'}</span></p>
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">面积信息</div>
                <div className="mt-2 space-y-1">
                  <p>GIS 面积：<span className="font-semibold text-zinc-900">{formatArea(activeProtectedArea.gis_area)}</span></p>
                  <p>报告面积：<span className="font-semibold text-zinc-900">{formatArea(activeProtectedArea.rep_area)}</span></p>
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">管理信息</div>
                <div className="mt-2 space-y-1">
                  <p>治理类型：<span className="font-semibold text-zinc-900">{activeProtectedArea.governance_type || '-'}</span></p>
                  <p>管理机构：<span className="font-semibold text-zinc-900">{activeProtectedArea.management_authority || '-'}</span></p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-sm text-zinc-600">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">保护目标</div>
                <p className="mt-2 leading-6">{activeProtectedArea.conservation_objective || '暂无保护目标说明。'}</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">管理计划</div>
                <p className="mt-2 leading-6">{activeProtectedArea.management_plan || '暂无管理计划说明。'}</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">数据来源</div>
                <p className="mt-2 font-semibold text-zinc-900">{activeProtectedArea.data_source || 'WDPA'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
