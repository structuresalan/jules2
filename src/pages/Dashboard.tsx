import React from 'react';
import { Layers, Frame, Wind, FileText, Map } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWebsiteStyleSettings } from '../utils/websiteStyle';

export const Dashboard: React.FC = () => {
  const { isDesktopStyle, isDesktopGlass } = useWebsiteStyleSettings();

  const cards = [
    {
      to: '/steel',
      icon: <Frame size={24} />,
      title: 'Steel Design',
      description: 'AISC 360 compliant calculations for steel members. Analyze beams, columns, and tension members.',
    },
    {
      to: '/concrete',
      icon: <Layers size={24} />,
      title: 'Concrete Design',
      description: 'ACI 318 compliant calculations for reinforced concrete. Design rectangular beams and slabs.',
    },
    {
      to: '/loads',
      icon: <Wind size={24} />,
      title: 'Loads',
      description: 'Governing IBC and referenced ASCE 7 environmental load calculations. Compute flat roof snow loads.',
    },
    {
      to: '/documents',
      icon: <Map size={24} />,
      title: 'Visual Map & Documents',
      description: 'Save calculation outputs, upload plans or photos, place markers, measure, and export marker schedules.',
    },
  ];

  if (isDesktopStyle) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 p-8 ss-glass-strong">
          {isDesktopGlass && (
            <>
              <span className="ss-orb -left-10 top-5 h-56 w-56 bg-blue-500/25" />
              <span className="ss-orb right-12 top-10 h-56 w-56 bg-purple-500/20" />
            </>
          )}
          <div className="relative">
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Engineering workspace</h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Open a design module, manage project documents, or map calculations directly to plan locations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <Link key={card.to} to={card.to} className="group block">
              <div className="h-full rounded-[1.75rem] border border-white/10 bg-white/8 p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl transition-all hover:-translate-y-1 hover:bg-white/12">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-white transition-colors group-hover:bg-blue-500/30">
                  {card.icon}
                </div>
                <h2 className="mb-2 text-xl font-bold text-white">{card.title}</h2>
                <p className="text-sm leading-6 text-slate-300">{card.description}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-white/8 p-6 shadow-xl backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-300" size={20} />
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Recent Calculations</h3>
          </div>
          <p className="mt-3 text-sm italic text-slate-400">No recent calculations found. Start a new design above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-500">Welcome to your structural calculation workspace.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.slice(0, 3).map((card) => (
          <Link key={card.to} to={card.to} className="block group">
            <div className="p-6 border border-gray-200 rounded-lg bg-white hover:border-gray-300 hover:shadow-sm transition-all h-full">
              <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center text-gray-600 mb-4 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                {card.icon}
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h2>
              <p className="text-gray-500 text-sm">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 p-6 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Recent Calculations</h3>
        <p className="text-sm text-gray-500 italic">No recent calculations found. Start a new design above.</p>
      </div>
    </div>
  );
};
