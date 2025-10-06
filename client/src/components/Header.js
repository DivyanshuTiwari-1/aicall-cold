import React from "react";
import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";

const Header = ({ onMenuClick }) => {
    return (
        <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="flex items-center justify-between h-16 px-4">
                <div className="flex items-center">
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    >
                        <Bars3Icon className="h-6 w-6" />
                    </button>{" "}
                    <div className="hidden lg:block">
                        <h2 className="text-xl font-semibold text-gray-900">AI Dialer Pro </h2>{" "}
                    </div>{" "}
                </div>
                <div className="flex items-center space-x-4">
                    {" "}
                    {/* Notifications */}{" "}
                    <button className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 relative">
                        <BellIcon className="h-6 w-6" />
                        <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white">
                            {" "}
                        </span>{" "}
                    </button>
                    {/* User menu */}{" "}
                    <div className="flex items-center space-x-3">
                        <div className="text-right">
                            <p className="text-sm font-medium text-gray-900"> John Doe </p>{" "}
                            <p className="text-xs text-gray-500"> Admin </p>{" "}
                        </div>{" "}
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium text-sm"> JD </span>{" "}
                        </div>{" "}
                    </div>{" "}
                </div>{" "}
            </div>{" "}
        </header>
    );
};

export default Header;
