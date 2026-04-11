import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  Bell,
  Book,
  Heart,
  LogOut,
  Settings,
  Shield,
  Sparkles,
  Trophy
} from 'lucide-react';
import { getUserAchievements, getUserProfile, getUserStats } from '../api';
import type { Achievement, UserProfile as UserProfileType, UserStats as UserStatsType } from '../types';

interface UserProfileProps {
  setCurrentPage?: (page: string) => void;
  token: string | null;
  user: UserProfileType | null;
  onLogout: () => void;
}

export default function UserProfile({ setCurrentPage, token, user, onLogout }: UserProfileProps) {
  const [profile, setProfile] = useState<UserProfileType | null>(user);
  const [stats, setStats] = useState<UserStatsType | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError(null);
    Promise.all([getUserProfile(token), getUserStats(token), getUserAchievements(token)])
      .then(([profileData, statsData, achievementsData]) => {
        setProfile(profileData);
        setStats(statsData);
        setAchievements(achievementsData);
      })
      .catch((err) => {
        setProfile(null);
        setStats(null);
        setAchievements([]);
        setError(err instanceof Error ? err.message : '个人信息加载失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  if (!token) {
    const guestHighlights = [
      {
        title: '收藏清单',
        desc: '把感兴趣的植物收进自己的列表，后续可以集中回看和复习。',
        icon: Heart
      },
      {
        title: '学习进度',
        desc: '记录浏览、测验和连续学习天数，形成清晰的学习轨迹。',
        icon: Book
      },
      {
        title: '成就徽章',
        desc: '完成测验与学习目标后逐步解锁，让积累更有反馈感。',
        icon: Trophy
      }
    ];

    return (
      <div className="mx-auto max-w-screen-xl px-8 py-12">
        <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-[linear-gradient(135deg,#f5fff8_0%,#ffffff_55%,#ecfdf3_100%)] shadow-sm">
          <div className="grid gap-8 px-8 py-10 lg:grid-cols-[1.2fr_.8fr] lg:px-12 lg:py-14">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-bold tracking-[0.24em] text-emerald-700 shadow-sm">
                <Sparkles size={14} />
                个人档案
              </div>
              <div className="space-y-4">
                <h1 className="max-w-2xl font-headline text-4xl font-black leading-tight text-zinc-900">
                  登录后开启你的植物学习档案
                </h1>
                <p className="max-w-2xl text-base leading-7 text-zinc-600">
                  收藏感兴趣的植物，记录学习进度，积累成就徽章。右上角入口会一直保留，你可以随时回来查看自己的学习状态。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setCurrentPage?.('learning')}
                  className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  登录
                </button>
                <button
                  onClick={() => setCurrentPage?.('learning')}
                  className="rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  注册新账号
                </button>
                <button
                  onClick={() => setCurrentPage?.('library')}
                  className="rounded-full px-3 py-3 text-sm font-bold text-zinc-600 transition hover:text-emerald-700"
                >
                  先去逛植物库
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {guestHighlights.map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <item.icon size={20} />
                  </div>
                  <h2 className="text-lg font-bold text-zinc-900">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (loading && !profile) {
    return (
      <div className="mx-auto max-w-screen-xl px-8 py-12">
        <div className="rounded-3xl border border-zinc-100 bg-white px-8 py-12 text-sm text-zinc-500 shadow-sm">
          正在整理你的学习档案...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-screen-xl px-8 py-12">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-8 py-12 text-sm text-rose-700 shadow-sm">
          个人信息加载失败：{error || '暂时无法获取你的资料。'}
        </div>
      </div>
    );
  }

  const overviewCards = [
    {
      label: '收藏植物',
      value: stats?.favorites_count ?? '--',
      hint: '回看你正在关注的植物',
      icon: Heart,
      tone: 'bg-rose-50 text-rose-600'
    },
    {
      label: '连续学习',
      value: stats?.streak_days ?? '--',
      hint: '保持节奏比突击更有效',
      icon: Sparkles,
      tone: 'bg-amber-50 text-amber-600'
    },
    {
      label: '测验均分',
      value: stats?.avg_quiz_score ?? '--',
      hint: '用结果检验识别和记忆',
      icon: Trophy,
      tone: 'bg-emerald-50 text-emerald-600'
    },
    {
      label: '已解锁成就',
      value: stats?.badges_unlocked ?? '--',
      hint: '你的阶段性学习反馈',
      icon: Award,
      tone: 'bg-sky-50 text-sky-600'
    }
  ];

  const quickLinks = [
    {
      title: '我的学习',
      desc: '查看收藏、浏览记录和测验历史',
      icon: Book,
      action: () => setCurrentPage?.('learning')
    },
    {
      title: '通知与动态',
      desc: '关注提醒和近期变化',
      icon: Bell,
      action: () => setCurrentPage?.('analysis')
    },
    {
      title: '账户与安全',
      desc: '查看账号状态与使用说明',
      icon: Shield,
      action: () => setCurrentPage?.('home')
    },
    {
      title: '偏好设置',
      desc: '后续可扩展通知、主题与展示偏好',
      icon: Settings,
      action: () => setCurrentPage?.('home')
    }
  ];

  return (
    <div className="mx-auto max-w-screen-xl px-8 py-12">
      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-[2rem] border border-zinc-100 bg-[linear-gradient(140deg,#0f172a_0%,#123524_48%,#f8fafc_48%,#ffffff_100%)] shadow-sm">
        <div className="grid gap-8 px-8 py-10 lg:grid-cols-[1fr_.95fr] lg:px-10 lg:py-12">
          <div className="space-y-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white/20 bg-white/10 text-2xl font-black">
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.username} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{profile.username.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-200">个人档案</div>
                <h1 className="mt-2 font-headline text-3xl font-black">{profile.username}</h1>
                <p className="mt-1 text-sm text-zinc-300">{profile.email}</p>
              </div>
            </div>

            <div className="grid max-w-md gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">等级</div>
                <div className="mt-2 text-3xl font-black">LV.{profile.level}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">积分</div>
                <div className="mt-2 text-3xl font-black">{profile.points}</div>
              </div>
            </div>

            <div className="max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5 text-sm leading-7 text-zinc-200 backdrop-blur">
              {profile.bio || '这里将展示你的学习标签、收藏偏好和个人简介。先去学习中心积累一些记录，会更有内容。'}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setCurrentPage?.('learning')}
                className="rounded-full bg-white px-5 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
              >
                查看学习中心
              </button>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <LogOut size={16} />
                退出登录
              </button>
            </div>
          </div>

          <div className="grid gap-4 self-end sm:grid-cols-2">
            {overviewCards.map((item) => (
              <div key={item.label} className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${item.tone}`}>
                  <item.icon size={20} />
                </div>
                <div className="text-sm font-bold text-zinc-500">{item.label}</div>
                <div className="mt-2 font-headline text-3xl font-black text-zinc-900">{item.value}</div>
                <div className="mt-2 text-sm leading-6 text-zinc-500">{item.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-8">
          <div className="rounded-[2rem] border border-zinc-100 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-headline text-2xl font-bold text-zinc-900">学习概览</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">把收藏、练习和成就放到同一页，方便你快速回到下一步学习。</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-zinc-50 p-5">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">学习笔记</div>
                <div className="mt-3 text-3xl font-black text-zinc-900">{stats?.notes_count ?? '--'}</div>
                <div className="mt-2 text-sm text-zinc-500">记录术语、特征和识别要点。</div>
              </div>
              <div className="rounded-3xl bg-zinc-50 p-5">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">通知</div>
                <div className="mt-3 text-3xl font-black text-zinc-900">{stats?.notifications_count ?? '--'}</div>
                <div className="mt-2 text-sm text-zinc-500">关注提醒和近期变化入口。</div>
              </div>
              <div className="rounded-3xl bg-zinc-50 p-5">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">下一步建议</div>
                <div className="mt-3 text-lg font-bold text-zinc-900">继续做一次测验</div>
                <div className="mt-2 text-sm text-zinc-500">让收藏和浏览记录形成闭环。</div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-100 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <Award className="text-emerald-600" />
              <h2 className="font-headline text-2xl font-bold text-zinc-900">成就徽章墙</h2>
            </div>

            {achievements.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-10 text-sm leading-6 text-zinc-500">
                你还没有解锁成就。先去收藏几种植物，完成一次测验，再回来看看这里的变化。
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {achievements.map((item) => (
                  <div key={`${item.name}-${item.earned_at}`} className="rounded-3xl border border-zinc-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
                    <div className="text-3xl">{item.icon}</div>
                    <div className="mt-4 text-lg font-bold text-zinc-900">{item.name}</div>
                    <div className="mt-2 text-xs font-medium tracking-wide text-zinc-400">{item.earned_at}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-zinc-100 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="font-headline text-2xl font-bold text-zinc-900">快捷入口</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">从个人中心直接跳转到最常用的学习和管理页面。</p>
          </div>

          <div className="space-y-3">
            {quickLinks.map((item) => (
              <button
                key={item.title}
                onClick={item.action}
                className="group flex w-full items-center justify-between rounded-3xl border border-zinc-100 bg-zinc-50 px-5 py-5 text-left transition hover:border-emerald-200 hover:bg-emerald-50/50"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-zinc-600 shadow-sm transition group-hover:text-emerald-600">
                    <item.icon size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-900">{item.title}</div>
                    <div className="mt-1 text-sm leading-6 text-zinc-500">{item.desc}</div>
                  </div>
                </div>
                <ArrowRight size={18} className="text-zinc-300 transition group-hover:text-emerald-600" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
