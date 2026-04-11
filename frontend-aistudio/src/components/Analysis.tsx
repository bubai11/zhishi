import React, { useEffect, useState } from 'react';
import { AlertTriangle, Map as MapIcon, Table as TableIcon } from 'lucide-react';
import {
  dismissAlert,
  getAlertUnreadCount,
  getAlertsFiltered,
  getAnalyticsSummary,
  getDiversity,
  getHeatmap,
  getMyAlerts,
  markAlertRead,
  markAllAlertsRead,
  restoreAlert
} from '../api';
import type { Alert, AnalyticsSummary, DiversityItem, RegionalData } from '../types';

interface AnalysisProps {
  setCurrentPage?: (page: string) => void;
  onSelectPlant?: (plantId: string) => void;
  token: string | null;
}

export default function Analysis({ setCurrentPage, onSelectPlant, token }: AnalysisProps) {
  const [alertDisplayLimit, setAlertDisplayLimit] = useState(5);
  const [alertPage, setAlertPage] = useState(1);
  const [alertPages, setAlertPages] = useState(1);
  const [alertTotal, setAlertTotal] = useState(0);
  const [alertLevelFilter, setAlertLevelFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [changeTypeFilter, setChangeTypeFilter] = useState<'all' | 'upgraded' | 'downgraded' | 'new_assessment' | 'new_addition'>('all');
  const [viewMode, setViewMode] = useState<'map' | 'table'>('table');
  const [alertFilter, setAlertFilter] = useState<'unread' | 'all' | 'dismissed'>('unread');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [diversity, setDiversity] = useState<DiversityItem[]>([]);
  const [heatmap, setHeatmap] = useState<RegionalData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUnreadCount = async () => {
    if (!token) return;
    const result = await getAlertUnreadCount(token);
    setUnreadCount(result.total);
  };

  useEffect(() => {
    setAlertPage(1);
  }, [alertDisplayLimit, alertFilter, alertLevelFilter, changeTypeFilter, token]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      getAnalyticsSummary(),
      getDiversity('division'),
      getHeatmap(),
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
      .then(([summaryData, diversityData, heatmapData, alertResponse, unreadTotal]) => {
        setSummary(summaryData);
        setDiversity(diversityData);
        setHeatmap(heatmapData.slice(0, 8));
        setAlerts(alertResponse.data);
        setAlertPages(Math.max(1, alertResponse.pages || 1));
        setAlertTotal(alertResponse.total || 0);
        setUnreadCount(unreadTotal);
      })
      .catch((err) => {
        setSummary(null);
        setDiversity([]);
        setHeatmap([]);
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
              <h2 className="text-xl font-headline font-bold text-zinc-900">全球分布热度</h2>
              <p className="mt-1 text-sm text-zinc-500">切换地图与表格视图浏览区域热度摘要。</p>
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

          <div className="relative mb-6 aspect-[21/9] overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">正在加载分析数据...</div>
            ) : viewMode === 'map' ? (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(16,185,129,0.2),transparent_30%),radial-gradient(circle_at_70%_35%,rgba(244,63,94,0.15),transparent_25%),radial-gradient(circle_at_50%_70%,rgba(245,158,11,0.16),transparent_28%),linear-gradient(180deg,#fafafa_0%,#f4f4f5_100%)]" />
            ) : heatmap.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">暂无区域热度数据。</div>
            ) : (
              <div className="absolute inset-0 overflow-auto p-6">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="py-3 text-xs font-bold uppercase tracking-widest text-zinc-400">区域</th>
                      <th className="py-3 text-xs font-bold uppercase tracking-widest text-zinc-400">密度</th>
                      <th className="py-3 text-xs font-bold uppercase tracking-widest text-zinc-400">物种数</th>
                      <th className="py-3 text-xs font-bold uppercase tracking-widest text-zinc-400">趋势</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.map((row, index) => (
                      <tr key={`${row.region}-${index}`} className="border-b border-zinc-50">
                        <td className="py-4 text-sm font-bold text-zinc-900">{row.region}</td>
                        <td className="py-4 text-sm text-zinc-600">{row.density_label}</td>
                        <td className="py-4 text-sm font-mono text-emerald-700">{row.species_count}</td>
                        <td className="py-4 text-sm text-zinc-600">{row.trend}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid gap-4 border-t border-zinc-100 pt-6 md:grid-cols-4">
            <div className="rounded-2xl bg-zinc-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">总物种数</p>
              <p className="font-headline text-2xl font-extrabold text-zinc-900">{summary?.total_species ?? '--'}</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-rose-400">关键区域</p>
              <p className="font-headline text-2xl font-extrabold text-rose-600">{summary?.critical_regions ?? '--'}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-500">年度增长</p>
              <p className="font-headline text-2xl font-extrabold text-emerald-700">{summary?.annual_growth_rate ?? '--'}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">保护区</p>
              <p className="font-headline text-2xl font-extrabold text-zinc-900">{summary?.protected_areas ?? '--'}</p>
            </div>
          </div>
        </section>

        <section className="col-span-12 flex flex-col gap-6 lg:col-span-4">
          <div className="rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-headline font-bold text-zinc-900">分类占比</h2>
              <p className="mt-1 text-sm text-zinc-500">按 division 聚合。</p>
            </div>
            <div className="space-y-5">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                  正在加载分类占比...
                </div>
              ) : diversity.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                  暂无分类统计数据。
                </div>
              ) : (
                diversity.map((item) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-zinc-700">{item.name}</span>
                      <span className="font-bold text-emerald-700">{item.percentage}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full border border-zinc-100 bg-zinc-50">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))
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
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
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

            {alerts.length >= 5 && (
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
    </div>
  );
}
