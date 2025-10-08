import React from "react";
import { NavLink } from "react-router-dom";
import {
  ChartBarIcon,
  ChartPieIcon,
  MegaphoneIcon,
  PhoneIcon,
  SignalIcon,
  SpeakerWaveIcon,
  CpuChipIcon,
  BookOpenIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const Navigation = () => {
  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: ChartBarIcon },
    { name: "Executive View", href: "/executive", icon: ChartPieIcon },
    { name: "Campaigns", href: "/campaigns", icon: MegaphoneIcon },
    { name: "Call History", href: "/calls", icon: PhoneIcon },
    { name: "Live Monitor", href: "/live-monitor", icon: SignalIcon },
    { name: "Voice Studio", href: "/voice-studio", icon: SpeakerWaveIcon },
    { name: "AI Intelligence", href: "/ai-intelligence", icon: CpuChipIcon },
    { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpenIcon },
    { name: "Compliance", href: "/compliance", icon: ShieldCheckIcon },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="px-6">
        <div className="flex space-x-8">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`
              }
            >
              <item.icon className="mr-2 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {item.name}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
