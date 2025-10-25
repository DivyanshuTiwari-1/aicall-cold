import {
    BookOpenIcon,
    ChartBarIcon,
    ChartPieIcon,
    ClipboardDocumentListIcon,
    CogIcon,
    CpuChipIcon,
    DocumentArrowUpIcon,
    MegaphoneIcon,
    PhoneIcon,
    ShieldCheckIcon,
    SignalIcon,
    SpeakerWaveIcon,
    UserGroupIcon
} from "@heroicons/react/24/outline";
import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Navigation = () => {
    const { user } = useAuth();
    const roleType = user?.roleType || 'agent';

    // Role-based navigation items
    const getNavigationItems = () => {
        // Agent-specific navigation (simplified)
        if (roleType === 'agent') {
            return [
                { name: "Dashboard", href: "/agent", icon: ChartBarIcon, roles: ['agent'] },
                { name: "My Leads", href: "/agent/leads", icon: ClipboardDocumentListIcon, roles: ['agent'] },
                { name: "Call History", href: "/agent/calls", icon: PhoneIcon, roles: ['agent'] },
                { name: "Settings", href: "/settings", icon: CogIcon, roles: ['agent'] }
            ];
        }

        const baseItems = [
            { name: "Dashboard", href: "/dashboard", icon: ChartBarIcon, roles: ['admin', 'manager'] },
            { name: "Campaigns", href: "/campaigns", icon: MegaphoneIcon, roles: ['admin', 'manager'] },
            { name: "Contacts", href: "/contacts", icon: UserGroupIcon, roles: ['admin', 'manager', 'data_uploader'] },
        ];

        // Manager-specific items
        if (['manager', 'admin'].includes(roleType)) {
            baseItems.push(
                { name: "Team Performance", href: "/team-performance", icon: ChartPieIcon, roles: ['manager', 'admin'] },
                { name: "Live Monitor", href: "/live-monitor", icon: SignalIcon, roles: ['manager', 'admin'] }
            );
        }

        // Admin-specific items
        if (['admin'].includes(roleType)) {
            baseItems.push(
                { name: "User Management", href: "/users", icon: UserGroupIcon, roles: ['admin'] },
                { name: "Lead Assignment", href: "/lead-assignment", icon: DocumentArrowUpIcon, roles: ['admin'] },
                { name: "Executive View", href: "/executive", icon: ChartPieIcon, roles: ['admin'] }
            );
        }

        // Data uploader specific items
        if (['data_uploader', 'admin'].includes(roleType)) {
            baseItems.push({ name: "Upload Contacts", href: "/upload-contacts", icon: DocumentArrowUpIcon, roles: ['data_uploader', 'admin'] });
        }

        // Common items for admin and manager
        if (['admin', 'manager'].includes(roleType)) {
            baseItems.push(
                { name: "Voice Studio", href: "/voice-studio", icon: SpeakerWaveIcon, roles: ['admin', 'manager'] },
                { name: "AI Intelligence", href: "/ai-intelligence", icon: CpuChipIcon, roles: ['admin', 'manager'] },
                { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpenIcon, roles: ['admin', 'manager'] },
                { name: "Compliance", href: "/compliance", icon: ShieldCheckIcon, roles: ['admin', 'manager'] }
            );
        }

        // Filter items based on user role
        return baseItems.filter(item => item.roles.includes(roleType));
    };

    const navigation = getNavigationItems();

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
