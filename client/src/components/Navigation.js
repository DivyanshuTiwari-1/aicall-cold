import {
    ChartBarIcon,
    ClipboardDocumentListIcon,
    CogIcon,
    MegaphoneIcon,
    PhoneIcon,
    UserGroupIcon
} from "@heroicons/react/24/outline";
import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Navigation = () => {
    const { user } = useAuth();
    const roleType = user?.roleType || 'agent';

    // Simplified navigation items
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

        // Simplified navigation for admin/manager/data_uploader
        return [
            { name: "Dashboard", href: "/dashboard", icon: ChartBarIcon, roles: ['admin', 'manager', 'data_uploader'] },
            { name: "Contacts & Leads", href: "/contacts", icon: UserGroupIcon, roles: ['admin', 'manager', 'data_uploader'] },
            { name: "Campaigns", href: "/campaigns", icon: MegaphoneIcon, roles: ['admin', 'manager'] },
        ];
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
