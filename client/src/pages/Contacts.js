import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { api } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const Contacts = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const queryClient = useQueryClient();

    const { data: contacts, isLoading, error } = useQuery(
        ['contacts', { search: searchTerm, status: statusFilter }],
        () => api.get('/contacts', {
            params: { search: searchTerm, status: statusFilter }
        }).then(res => res.data)
    );

    const deleteMutation = useMutation(
        (id) => api.delete(`/contacts/${id}`), {
            onSuccess: () => {
                queryClient.invalidateQueries('contacts');
                toast.success('Contact deleted successfully!');
            },
            onError: (error) => {
                toast.error(error.response ? .data ? .message || 'Failed to delete contact');
            }
        }
    );

    const handleDelete = (contact) => {
        if (window.confirm(`Are you sure you want to delete ${contact.firstName} ${contact.lastName}?`)) {
            deleteMutation.mutate(contact.id);
        }
    };

    if (isLoading) return <LoadingSpinner / > ;
    if (error) return <div className = "text-center py-12" > < p className = "text-red-600" > Failed to load contacts < /p></div > ;

    return ( <
        div className = "space-y-6" > { /* Header */ } <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        h1 className = "text-2xl font-bold text-gray-900" > Contacts < /h1> <
        p className = "text-gray-600" > Manage your contact database < /p> <
        /div> <
        button className = "btn-primary flex items-center" >
        <
        PlusIcon className = "h-5 w-5 mr-2" / >
        Add Contact <
        /button> <
        /div>

        { /* Filters */ } <
        div className = "card" >
        <
        div className = "flex flex-col sm:flex-row gap-4" >
        <
        div className = "flex-1" >
        <
        div className = "relative" >
        <
        MagnifyingGlassIcon className = "h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" / >
        <
        input type = "text"
        placeholder = "Search contacts..."
        value = { searchTerm }
        onChange = {
            (e) => setSearchTerm(e.target.value) }
        className = "input-field pl-10" /
        >
        <
        /div> <
        /div> <
        div className = "sm:w-48" >
        <
        select value = { statusFilter }
        onChange = {
            (e) => setStatusFilter(e.target.value) }
        className = "input-field" >
        <
        option value = "" > All Status < /option> <
        option value = "new" > New < /option> <
        option value = "contacted" > Contacted < /option> <
        option value = "interested" > Interested < /option> <
        option value = "not_interested" > Not Interested < /option> <
        option value = "do_not_call" > Do Not Call < /option> <
        /select> <
        /div> <
        /div> <
        /div>

        { /* Contacts Table */ } <
        div className = "card" >
        <
        div className = "overflow-x-auto" >
        <
        table className = "min-w-full divide-y divide-gray-200" >
        <
        thead className = "bg-gray-50" >
        <
        tr >
        <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Name < /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Company < /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Phone < /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Status < /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Calls < /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Actions < /th> <
        /tr> <
        /thead> <
        tbody className = "bg-white divide-y divide-gray-200" > {
            contacts ? .contacts ? .map((contact) => ( <
                tr key = { contact.id }
                className = "hover:bg-gray-50" >
                <
                td className = "px-6 py-4 whitespace-nowrap" >
                <
                div >
                <
                div className = "text-sm font-medium text-gray-900" > { contact.firstName } { contact.lastName } <
                /div> <
                div className = "text-sm text-gray-500" > { contact.email } < /div> <
                /div> <
                /td> <
                td className = "px-6 py-4 whitespace-nowrap" >
                <
                div className = "text-sm text-gray-900" > { contact.company } < /div> <
                div className = "text-sm text-gray-500" > { contact.title } < /div> <
                /td> <
                td className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900" > { contact.phone } <
                /td> <
                td className = "px-6 py-4 whitespace-nowrap" >
                <
                span className = { `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      contact.status === 'new' ? 'bg-gray-100 text-gray-800' :
                      contact.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                      contact.status === 'interested' ? 'bg-green-100 text-green-800' :
                      contact.status === 'not_interested' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }` } > { contact.status.replace('_', ' ') } <
                /span> <
                /td> <
                td className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900" > { contact.callCount } <
                /td> <
                td className = "px-6 py-4 whitespace-nowrap text-sm font-medium" >
                <
                button className = "text-blue-600 hover:text-blue-900 mr-3" > Edit < /button> <
                button onClick = {
                    () => handleDelete(contact) }
                className = "text-red-600 hover:text-red-900" >
                Delete <
                /button> <
                /td> <
                /tr>
            ))
        } <
        /tbody> <
        /table> <
        /div> <
        /div> <
        /div>
    );
};

export default Contacts;