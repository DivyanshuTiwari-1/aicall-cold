import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserIcon, CogIcon, BellIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const Settings = () => {
    const { user, updateUser } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [formData, setFormData] = useState({
        firstName: user ? .firstName || '',
        lastName: user ? .lastName || '',
        email: user ? .email || '',
        organizationName: user ? .organizationName || ''
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        updateUser(formData);
        toast.success('Profile updated successfully!');
    };

    const tabs = [
        { id: 'profile', name: 'Profile', icon: UserIcon },
        { id: 'notifications', name: 'Notifications', icon: BellIcon },
        { id: 'security', name: 'Security', icon: ShieldCheckIcon },
        { id: 'preferences', name: 'Preferences', icon: CogIcon }
    ];

    return ( <
        div className = "space-y-6" > { /* Header */ } <
        div >
        <
        h1 className = "text-2xl font-bold text-gray-900" > Settings < /h1> <
        p className = "text-gray-600" > Manage your account settings and preferences < /p> < /
        div >

        <
        div className = "grid grid-cols-1 lg:grid-cols-4 gap-6" > { /* Sidebar */ } <
        div className = "lg:col-span-1" >
        <
        nav className = "space-y-1" > {
            tabs.map((tab) => ( <
                button key = { tab.id }
                onClick = {
                    () => setActiveTab(tab.id)
                }
                className = { `w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }` } >
                <
                tab.icon className = "mr-3 h-5 w-5" / > { tab.name } <
                /button>
            ))
        } <
        /nav> < /
        div >

        { /* Content */ } <
        div className = "lg:col-span-3" > {
            activeTab === 'profile' && ( <
                div className = "card" >
                <
                h3 className = "text-lg font-semibold text-gray-900 mb-6" > Profile Information < /h3> <
                form onSubmit = { handleSubmit }
                className = "space-y-6" >
                <
                div className = "grid grid-cols-1 md:grid-cols-2 gap-6" >
                <
                div >
                <
                label className = "label" > First Name < /label> <
                input type = "text"
                name = "firstName"
                value = { formData.firstName }
                onChange = { handleChange }
                className = "input-field"
                required /
                >
                <
                /div> <
                div >
                <
                label className = "label" > Last Name < /label> <
                input type = "text"
                name = "lastName"
                value = { formData.lastName }
                onChange = { handleChange }
                className = "input-field"
                required /
                >
                <
                /div> < /
                div >

                <
                div >
                <
                label className = "label" > Email Address < /label> <
                input type = "email"
                name = "email"
                value = { formData.email }
                onChange = { handleChange }
                className = "input-field"
                required /
                >
                <
                /div>

                <
                div >
                <
                label className = "label" > Organization Name < /label> <
                input type = "text"
                name = "organizationName"
                value = { formData.organizationName }
                onChange = { handleChange }
                className = "input-field"
                required /
                >
                <
                /div>

                <
                div className = "flex justify-end" >
                <
                button type = "submit"
                className = "btn-primary" >
                Save Changes <
                /button> < /
                div > <
                /form> < /
                div >
            )
        }

        {
            activeTab === 'notifications' && ( <
                div className = "card" >
                <
                h3 className = "text-lg font-semibold text-gray-900 mb-6" > Notification Preferences < /h3> <
                div className = "space-y-4" >
                <
                div className = "flex items-center justify-between" >
                <
                div >
                <
                h4 className = "text-sm font-medium text-gray-900" > Email Notifications < /h4> <
                p className = "text-sm text-gray-500" > Receive email updates about your campaigns < /p> < /
                div > <
                label className = "relative inline-flex items-center cursor-pointer" >
                <
                input type = "checkbox"
                className = "sr-only peer"
                defaultChecked / >
                <
                div className = "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" > < /div> < /
                label > <
                /div>

                <
                div className = "flex items-center justify-between" >
                <
                div >
                <
                h4 className = "text-sm font-medium text-gray-900" > Call Alerts < /h4> <
                p className = "text-sm text-gray-500" > Get notified when calls are completed < /p> < /
                div > <
                label className = "relative inline-flex items-center cursor-pointer" >
                <
                input type = "checkbox"
                className = "sr-only peer"
                defaultChecked / >
                <
                div className = "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" > < /div> < /
                label > <
                /div>

                <
                div className = "flex items-center justify-between" >
                <
                div >
                <
                h4 className = "text-sm font-medium text-gray-900" > Campaign Updates < /h4> <
                p className = "text-sm text-gray-500" > Notifications about campaign performance < /p> < /
                div > <
                label className = "relative inline-flex items-center cursor-pointer" >
                <
                input type = "checkbox"
                className = "sr-only peer" / >
                <
                div className = "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" > < /div> < /
                label > <
                /div> < /
                div > <
                /div>
            )
        }

        {
            activeTab === 'security' && ( <
                div className = "card" >
                <
                h3 className = "text-lg font-semibold text-gray-900 mb-6" > Security Settings < /h3> <
                div className = "space-y-6" >
                <
                div >
                <
                h4 className = "text-sm font-medium text-gray-900 mb-2" > Change Password < /h4> <
                div className = "space-y-4" >
                <
                div >
                <
                label className = "label" > Current Password < /label> <
                input type = "password"
                className = "input-field" / >
                <
                /div> <
                div >
                <
                label className = "label" > New Password < /label> <
                input type = "password"
                className = "input-field" / >
                <
                /div> <
                div >
                <
                label className = "label" > Confirm New Password < /label> <
                input type = "password"
                className = "input-field" / >
                <
                /div> <
                button className = "btn-primary" > Update Password < /button> < /
                div > <
                /div>

                <
                div className = "border-t pt-6" >
                <
                h4 className = "text-sm font-medium text-gray-900 mb-2" > Two - Factor Authentication < /h4> <
                p className = "text-sm text-gray-500 mb-4" > Add an extra layer of security to your account < /p> <
                button className = "btn-secondary" > Enable 2 FA < /button> < /
                div > <
                /div> < /
                div >
            )
        }

        {
            activeTab === 'preferences' && ( <
                div className = "card" >
                <
                h3 className = "text-lg font-semibold text-gray-900 mb-6" > Preferences < /h3> <
                div className = "space-y-6" >
                <
                div >
                <
                label className = "label" > Default Voice Persona < /label> <
                select className = "input-field" >
                <
                option value = "professional" > Professional < /option> <
                option value = "friendly" > Friendly < /option> <
                option value = "authoritative" > Authoritative < /option> < /
                select > <
                /div>

                <
                div >
                <
                label className = "label" > Time Zone < /label> <
                select className = "input-field" >
                <
                option value = "UTC" > UTC < /option> <
                option value = "America/New_York" > Eastern Time < /option> <
                option value = "America/Chicago" > Central Time < /option> <
                option value = "America/Denver" > Mountain Time < /option> <
                option value = "America/Los_Angeles" > Pacific Time < /option> < /
                select > <
                /div>

                <
                div >
                <
                label className = "label" > Calling Hours < /label> <
                div className = "grid grid-cols-2 gap-4" >
                <
                div >
                <
                label className = "text-sm text-gray-500" > Start Time < /label> <
                input type = "time"
                className = "input-field"
                defaultValue = "09:00" / >
                <
                /div> <
                div >
                <
                label className = "text-sm text-gray-500" > End Time < /label> <
                input type = "time"
                className = "input-field"
                defaultValue = "17:00" / >
                <
                /div> < /
                div > <
                /div>

                <
                div className = "flex justify-end" >
                <
                button className = "btn-primary" > Save Preferences < /button> < /
                div > <
                /div> < /
                div >
            )
        } <
        /div> < /
        div > <
        /div>
    );
};

export default Settings;