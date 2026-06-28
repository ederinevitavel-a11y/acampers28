import React from 'react';
import { Home, Utensils, Droplets, Calendar, Flame, Ticket, DollarSign, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { AppTab } from '../types';

interface NavigationProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'dashboard' as const, label: 'Home', icon: Home, color: 'text-blue-500' },
    { id: 'participantes' as const, label: 'Acampers', icon: UserCheck, color: 'text-indigo-400' },
    { id: 'sabor' as const, label: 'Sabor', icon: Utensils, color: 'text-emerald-400' },
    { id: 'brilho' as const, label: 'Brilho', icon: Droplets, color: 'text-cyan-400' },
    { id: 'conecta' as const, label: 'Conecta', icon: Calendar, color: 'text-violet-400' },
    { id: 'brasa' as const, label: 'Brasa', icon: Flame, color: 'text-orange-500' },
    { id: 'bencao' as const, label: 'Bênção', icon: Ticket, color: 'text-rose-400' },
    { id: 'financeiro' as const, label: 'Finanças', icon: DollarSign, color: 'text-amber-400' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 md:top-[72px] md:bottom-auto md:border-b md:border-t-0 shadow-[0_-8px_20px_rgba(0,0,0,0.6)] md:shadow-md">
      <div className="max-w-7xl mx-auto overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex justify-start sm:justify-center items-center h-[72px] md:h-16 px-2">
          {tabs.map((tab) => {
            const Icon = typeof tab.icon === 'string' ? Calendar : tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[72px] sm:min-w-[90px] md:min-w-0 md:px-6 h-full transition-all relative shrink-0 active:scale-95",
                  isActive 
                    ? "font-black" 
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                <div className={cn(
                  "p-2 rounded-2xl transition-all duration-300 mb-1",
                  isActive ? "bg-slate-800/80 shadow-inner scale-110" : "bg-transparent"
                )}>
                  <Icon 
                    size={isActive ? 22 : 20} 
                    className={cn(
                      "transition-all duration-300",
                      isActive ? tab.color : "text-slate-600"
                    )} 
                  />
                </div>
                <span className={cn(
                  "text-[9px] uppercase font-black tracking-widest leading-none",
                  isActive ? "text-slate-100" : "text-slate-500"
                )}>
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="nav-active"
                    className={cn("absolute bottom-0 w-6 h-1 rounded-t-full md:top-0 md:rounded-t-none md:rounded-b-full", tab.color?.replace('text-', 'bg-'))} 
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
