import React from 'react';
import { Sprout, Mail, Globe } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-zinc-200/50 bg-zinc-50 py-12 font-inter text-sm text-zinc-500">
      <div className="mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-4 px-10 md:flex-row">
        <div className="flex items-center gap-2 text-lg font-headline font-semibold text-emerald-900">
          <Sprout size={20} />
          <span>植物科普系统</span>
        </div>

        <div className="flex gap-8">
          <a href="#" className="text-zinc-500 transition-colors hover:text-emerald-600">隐私政策</a>
          <a href="#" className="text-zinc-500 transition-colors hover:text-emerald-600">服务条款</a>
          <a href="#" className="text-zinc-500 transition-colors hover:text-emerald-600">科学来源</a>
        </div>

        <div className="flex items-center gap-4 text-zinc-400">
          <Globe size={18} className="cursor-pointer transition-colors hover:text-emerald-600" />
          <Mail size={18} className="cursor-pointer transition-colors hover:text-emerald-600" />
          <span>&copy; 2024 植物科普系统. 保留所有权利.</span>
        </div>
      </div>
    </footer>
  );
}
