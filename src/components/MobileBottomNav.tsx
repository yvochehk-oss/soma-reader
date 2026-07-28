import React from 'react';
import { Home, BookOpen, Trophy, ShoppingBag, User } from 'lucide-react';
import { ActiveNavTab, Language } from '../types';

interface MobileBottomNavProps {
  activeTab: ActiveNavTab;
  setActiveTab: (tab: ActiveNavTab) => void;
  language: Language;
  onOpenLibrary: () => void;
  onOpenProfile: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  language,
  onOpenLibrary,
  onOpenProfile,
}) => {
  return (
    <nav className="fixed bottom-0 w-full z-40 h-[56px] shadow-[0_-4px_10px_rgba(0,0,0,0.05)] bg-[#e7fefa] flex justify-around items-center px-2 md:hidden border-t border-[#dec0b7]/30">
      <button
        onClick={() => setActiveTab('Home')}
        className={`flex flex-col items-center justify-center rounded-xl p-1 w-16 h-12 transition-all ${
          activeTab === 'Home'
            ? 'text-[#a43d17] bg-[#ed7248]/20 font-bold -translate-y-[2px]'
            : 'text-[#6E7E7A] hover:bg-[#d6ede9]'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-bold mt-0.5">
          {language === 'sw' ? 'Nyumbani' : 'Home'}
        </span>
      </button>

      <button
        onClick={onOpenLibrary}
        className={`flex flex-col items-center justify-center rounded-xl p-1 w-16 h-12 transition-all ${
          activeTab === 'Library'
            ? 'text-[#a43d17] bg-[#ed7248]/20 font-bold -translate-y-[2px]'
            : 'text-[#6E7E7A] hover:bg-[#d6ede9]'
        }`}
      >
        <BookOpen className="w-5 h-5" />
        <span className="text-[10px] font-bold mt-0.5">
          {language === 'sw' ? 'Maktaba' : 'Library'}
        </span>
      </button>

      <button
        onClick={() => setActiveTab('Popular')}
        className={`flex flex-col items-center justify-center rounded-xl p-1 w-16 h-12 transition-all ${
          activeTab === 'Popular'
            ? 'text-[#a43d17] bg-[#ed7248]/20 font-bold -translate-y-[2px]'
            : 'text-[#6E7E7A] hover:bg-[#d6ede9]'
        }`}
      >
        <Trophy className="w-5 h-5" />
        <span className="text-[10px] font-bold mt-0.5">
          {language === 'sw' ? 'Maarufu' : 'Popular'}
        </span>
      </button>

      <button
        onClick={() => setActiveTab('Free Zone')}
        className={`flex flex-col items-center justify-center rounded-xl p-1 w-16 h-12 transition-all ${
          activeTab === 'Free Zone'
            ? 'text-[#a43d17] bg-[#ed7248]/20 font-bold -translate-y-[2px]'
            : 'text-[#6E7E7A] hover:bg-[#d6ede9]'
        }`}
      >
        <ShoppingBag className="w-5 h-5" />
        <span className="text-[10px] font-bold mt-0.5">
          {language === 'sw' ? 'Huru' : 'Free'}
        </span>
      </button>

      <button
        onClick={onOpenProfile}
        className="flex flex-col items-center justify-center rounded-xl p-1 w-16 h-12 text-[#6E7E7A] hover:bg-[#d6ede9] transition-all"
      >
        <User className="w-5 h-5" />
        <span className="text-[10px] font-bold mt-0.5">
          {language === 'sw' ? 'Mimi' : 'Profile'}
        </span>
      </button>
    </nav>
  );
};
