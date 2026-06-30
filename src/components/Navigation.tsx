import React from 'react';
import { Home, Utensils, Droplets, Calendar, Flame, Ticket, DollarSign, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { AppTab } from '../types';
import { useConsolidatedData } from '../hooks/useConsolidatedData';

interface NavigationProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { participants, installments } = useConsolidatedData();
  
  const today = new Date();
  const overdueCount = participants.filter(p => {
    if (p.isPaid || !p.totalValue || p.totalValue === 0) return false;
    return installments.some(inst => 
      inst.participantId === p.id && 
      !inst.isPaid && 
      new Date(inst.dueDate || inst.month + '-10') < today
    );
  }).length;

  const tabs = [
    { id: 'dashboard' as const, label: 'Home', icon: Home, color: 'text-blue-500' },
    { id: 'participantes' as const, label: 'Acampers', icon: UserCheck, color: 'text-indigo-400', badge: overdueCount },
  ];

  return (
    <nav className="relative bg-slate-900 border-b border-slate-800 z-50 shadow-md">
      <div className="max-w-7xl mx-auto overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex justify-center items-center h-[72px] md:h-16 px-4 gap-8 sm:gap-12 md:gap-0">
          {tabs.map((tab) => {
            const Icon = typeof tab.icon === 'string' ? Calendar : tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[80px] sm:min-w-[100px] md:min-w-0 md:px-8 h-full transition-all relative shrink-0 active:scale-90",
                  isActive 
                    ? "font-black" 
                    : "text-slate-500 hover:text-white"
                )}
              >
                <div className={cn(
                  "p-2.5 rounded-2xl transition-all duration-300 mb-1 relative",
                  isActive ? "bg-indigo-500/10 shadow-lg scale-110" : "bg-transparent"
                )}>
                  <Icon 
                    size={isActive ? 24 : 22} 
                    className={cn(
                      "transition-all duration-300",
                      isActive ? tab.color : "text-slate-500"
                    )} 
                  />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900 px-1 shadow-lg z-10"
                    >
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </motion.div>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] uppercase font-black tracking-[0.15em] leading-none mt-1",
                  isActive ? "text-white" : "text-slate-500"
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
