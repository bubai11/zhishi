import React from 'react';
import { Search, Sprout } from 'lucide-react';
import type { UserProfile } from '../types';

interface NavbarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  user?: UserProfile | null;
  alertUnreadCount?: number;
}

const navItems = [
  { name: '首页', id: 'home' },
  { name: '植物库', id: 'library' },
  { name: '分类系统', id: 'classification' },
  { name: '可视化分析', id: 'analysis' },
  { name: '学习中心', id: 'learning' }
];

export default function Navbar({ currentPage, setCurrentPage, user, alertUnreadCount = 0 }: NavbarProps) {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-zinc-200/50 bg-white/75 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-8 font-headline tracking-tight antialiased">
        <div
          className="flex cursor-pointer items-center gap-2 text-xl font-bold text-emerald-800"
          onClick={() => setCurrentPage('home')}
        >
          <Sprout className="text-emerald-600" size={24} fill="currentColor" />
          <span>植识</span>
        </div>

        <div className="hidden items-center space-x-8 md:flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`border-b-2 pb-1 text-sm font-medium transition-all ${
                currentPage === item.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-zinc-600 hover:text-emerald-600'
              }`}
            >
              <span className="relative inline-flex items-center">
                {item.name}
                {item.id === 'analysis' && alertUnreadCount > 0 && (
                  <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {alertUnreadCount > 99 ? '99+' : alertUnreadCount}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button className="rounded-full p-2 text-zinc-600 transition-all hover:bg-emerald-50/50" aria-label="搜索">
            <Search size={20} />
          </button>

          <button
            onClick={() => setCurrentPage('profile')}
            className={`flex items-center gap-3 rounded-full border-2 px-1.5 py-1.5 transition-all ${
              currentPage === 'profile' ? 'border-emerald-600 bg-emerald-50' : 'border-zinc-100 hover:border-emerald-200'
            }`}
            aria-label="打开个人中心"
          >
            <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span>{user?.username?.slice(0, 1).toUpperCase() || '我'}</span>
              )}
              {alertUnreadCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
                  {alertUnreadCount > 9 ? '9+' : alertUnreadCount}
                </span>
              )}
            </div>
            <span className="hidden pr-2 text-xs font-bold text-zinc-600 sm:inline">
              {user?.username || '登录 / 注册'}
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
