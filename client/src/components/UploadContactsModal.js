import React, { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useMutation, useQueryClient } from "react-query";
import { campaignsAPI } from "../services/campaigns";
import toast from "react-hot-toast";
import LoadingSpinner from "./LoadingSpinner";

const CreateCampaignModal = ({ isOpen, onClose }) => {
    const [formData, setFormData] = useState({
        name: "",
        type: "sales",
        voice_persona: "professional",
        auto_retry: true,
        best_time_enabled: true,
        emotion_detection: true,
    });

    const queryClient = useQueryClient();

    const createMutation = useMutation(
        (data) => campaignsAPI.createCampaign(data), {
            onSuccess: () => {
                toast.success("Campaign created successfully!");
                queryClient.invalidateQueries("campaigns");
                onClose();
                resetForm();
            },
            onError: (error) => {
                toast.error(
                    error ? .response ? .data ? .message || "Failed to create campaign"
                );
            },
        }
    );

    const resetForm = () => {
        setFormData({
            name: "",
            type: "sales",
            voice_persona: "professional",
            auto_retry: true,
            best_time_enabled: true,
            emotion_detection: true,
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error("Campaign name is required");
            return;
        }

        createMutation.mutate(formData);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    if (!isOpen) return null;

    return ( <
        div className = "fixed inset-0 z-50 overflow-y-auto" >
        <
        div className = "flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0" > { /* Background overlay */ } <
        div className = "fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
        onClick = { onClose }
        />

        { /* Modal panel */ } <
        div className = "inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full" > { /* Header */ } <
        div className = "flex items-center justify-between px-6 py-4 border-b border-gray-200" >
        <
        h3 className = "text-lg font-semibold text-gray-900" >
        Create New Campaign <
        /h3> <
        button onClick = { onClose }
        className = "text-gray-400 hover:text-gray-500 transition-colors" >
        <
        XMarkIcon className = "h-6 w-6" / >
        <
        /button> < /
        div >

        { /* Form */ } <
        form onSubmit = { handleSubmit } >
        <
        div className = "px-6 py-4 space-y-4" > { /* Campaign Name */ } <
        div >
        <
        label className = "block text-sm font-medium text-gray-700 mb-1" >
        Campaign Name < span className = "text-red-500" > * < /span> < /
        label > <
        input type = "text"
        name = "name"
        value = { formData.name }
        onChange = { handleChange }
        className = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder = "e.g., Q4 Sales Outreach"
        required /
        >
        <
        /div>

        { /* Campaign Type */ } <
        div >
        <
        label className = "block text-sm font-medium text-gray-700 mb-1" >
        Campaign Type < span className = "text-red-500" > * < /span> < /
        label > <
        select name = "type"
        value = { formData.type }
        onChange = { handleChange }
        className = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" >
        <
        option value = "sales" > Sales Outreach < /option> <
        option value = "recruitment" > Recruitment Screening < /option> < /
        select > <
        /div>

        { /* Voice Persona */ } <
        div >
        <
        label className = "block text-sm font-medium text-gray-700 mb-1" >
        Voice Persona <
        /label> <
        select name = "voice_persona"
        value = { formData.voice_persona }
        onChange = { handleChange }
        className = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" >
        <
        option value = "professional" > Professional < /option> <
        option value = "casual" > Casual < /option> <
        option value = "empathetic" > Empathetic < /option> <
        option value = "enthusiastic" > Enthusiastic < /option> < /
        select > <
        /div>

        { /* Feature Toggles */ } <
        div className = "space-y-3 pt-2" >
        <
        div className = "flex items-center" >
        <
        input type = "checkbox"
        name = "auto_retry"
        checked = { formData.auto_retry }
        onChange = { handleChange }
        className = "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" /
        >
        <
        label className = "ml-2 block text-sm text-gray-700" >
        Enable Auto - Retry
        for failed calls <
        /label> < /
        div >

        <
        div className = "flex items-center" >
        <
        input type = "checkbox"
        name = "best_time_enabled"
        checked = { formData.best_time_enabled }
        onChange = { handleChange }
        className = "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" /
        >
        <
        label className = "ml-2 block text-sm text-gray-700" >
        Enable Smart Timing(call at best times) <
        /label> < /
        div >

        <
        div className = "flex items-center" >
        <
        input type = "checkbox"
        name = "emotion_detection"
        checked = { formData.emotion_detection }
        onChange = { handleChange }
        className = "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" /
        >
        <
        label className = "ml-2 block text-sm text-gray-700" >
        Enable Emotion Detection <
        /label> < /
        div > <
        /div> < /
        div >

        { /* Footer */ } <
        div className = "px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3" >
        <
        button type = "button"
        onClick = { onClose }
        className = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        disabled = { createMutation.isLoading } >
        Cancel <
        /button> <
        button type = "submit"
        className = "px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        disabled = { createMutation.isLoading } > {
            createMutation.isLoading ? ( <
                >
                <
                LoadingSpinner size = "sm" / >
                <
                span className = "ml-2" > Creating... < /span> < / >
            ) : (
                "Create Campaign"
            )
        } <
        /button> < /
        div > <
        /form> < /
        div > <
        /div> < /
        div >
    );
};

export default CreateCampaignModal; <
button
onClick = { onClose }
className = "text-gray-400 hover:text-gray-500 transition-colors" >
    <
    XMarkIcon className = "h-6 w-6" / >
    <
    /button> <
    /div>

{ /* Campaign Selector */ } <
div className = "px-6 py-4 bg-gray-50 border-b border-gray-200" >
    <
    label className = "block text-sm font-medium text-gray-700 mb-2" >
    Select Campaign < span className = "text-red-500" > * < /span> <
    /label> <
    select
value = { campaignId }
onChange = {
    (e) => setCampaignId(e.target.value) }
className = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" >
    <
    option value = "" > Choose a campaign... < /option> {
        campaigns.map((campaign) => ( <
            option key = { campaign.id }
            value = { campaign.id } > { campaign.name } <
            /option>
        ))
    } <
    /select> <
    /div>

{ /* Tabs */ } <
div className = "border-b border-gray-200" >
    <
    nav className = "flex -mb-px" >
    <
    button
onClick = {
    () => setActiveTab("csv") }
className = { `px-6 py-3 text-sm font-medium ${
                  activeTab === "csv"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }` } >
    <
    CloudArrowUpIcon className = "inline h-5 w-5 mr-2" / >
    CSV Upload <
    /button> <
    button
onClick = {
    () => setActiveTab("manual") }
className = { `px-6 py-3 text-sm font-medium ${
                  activeTab === "manual"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }` } >
    <
    UserPlusIcon className = "inline h-5 w-5 mr-2" / >
    Manual Entry <
    /button> <
    /nav> <
    /div>

{ /* Tab Content */ } <
div className = "px-6 py-4" > {
        activeTab === "csv" ? ( <
            div className = "space-y-4" > { /* File Upload */ } <
            div >
            <
            label className = "block text-sm font-medium text-gray-700 mb-2" >
            CSV File <
            /label> <
            input type = "file"
            accept = ".csv"
            onChange = { handleFileSelect }
            className = "block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /
            >
            <
            p className = "mt-1 text-xs text-gray-500" >
            CSV should have columns: first_name, last_name, phone, email, company, title <
            /p> <
            /div>

            { /* Preview */ } {
                csvPreview.length > 0 && ( <
                    div >
                    <
                    h4 className = "text-sm font-medium text-gray-700 mb-2" >
                    Preview(first 5 rows) <
                    /h4> <
                    div className = "overflow-x-auto border border-gray-200 rounded-md" >
                    <
                    table className = "min-w-full divide-y divide-gray-200" >
                    <
                    thead className = "bg-gray-50" >
                    <
                    tr >
                    <
                    th className = "px-3 py-2 text-left text-xs font-medium text-gray-500" > Name < /th> <
                    th className = "px-3 py-2 text-left text-xs font-medium text-gray-500" > Phone < /th> <
                    th className = "px-3 py-2 text-left text-xs font-medium text-gray-500" > Email < /th> <
                    th className = "px-3 py-2 text-left text-xs font-medium text-gray-500" > Company < /th> <
                    /tr> <
                    /thead> <
                    tbody className = "bg-white divide-y divide-gray-200" > {
                        csvPreview.map((contact, index) => ( <
                            tr key = { index } >
                            <
                            td className = "px-3 py-2 text-sm text-gray-900" > { contact.first_name } { contact.last_name } <
                            /td> <
                            td className = "px-3 py-2 text-sm text-gray-900" > { contact.phone } < /td> <
                            td className = "px-3 py-2 text-sm text-gray-900" > { contact.email } < /td> <
                            td className = "px-3 py-2 text-sm text-gray-900" > { contact.company } < /td> <
                            /tr>
                        ))
                    } <
                    /tbody> <
                    /table> <
                    /div> <
                    /div>
                )
            }

            { /* Upload Results */ } {
                uploadResults && ( <
                    div className = "p-4 bg-green-50 border border-green-200 rounded-md" >
                    <
                    h4 className = "text-sm font-medium text-green-800 mb-2" > Upload Complete < /h4> <
                    div className = "text-sm text-green-700" >
                    <
                    p > ✓Created: { uploadResults.created } < /p> <
                    p > ⊘Skipped: { uploadResults.skipped } < /p> <
                    p > ✗Errors: { uploadResults.errors ? .length || 0 } < /p> <
                    /div> <
                    /div>
                )
            } <
            /div>
        ) : ( <
            form onSubmit = { handleManualSubmit }
            className = "space-y-4" >
            <
            div className = "grid grid-cols-2 gap-4" >
            <
            div >
            <
            label className = "block text-sm font-medium text-gray-700 mb-1" >
            First Name < span className = "text-red-500" > * < /span> <
            /label> <
            input type = "text"
            name = "first_name"
            value = { manualContact.first_name }
            onChange = { handleManualChange }
            className = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required /
            >
            <
            /div> <
            div >
            <
            label className = "block text-sm font-medium text-gray-700 mb-1" >
            Last Name <
            /label> <
            input type = "text"
            name = "last_name"
            value = { manualContact.last_name }
            onChange = { handleManualChange }
            className = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" /
            >
            <
            /div> <
            /div>

            <
            div >
            <
            label className = "block text-sm font-medium text-gray-700 mb-1" >
            Phone < span className = "text-red-500" > * < /span> <
            /label> <
            input type = "tel"
            name = "phone"
            value = { manualContact.phone }
            onChange = { handleManualChange }
            className = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder = "+1234567890"
            required /
            >
            <
            /div>

            <
            div >
            <
            label className = "block text-sm font-medium text-gray-700 mb-1" >
            Email <
            /label> <
            input type = "email"
            name = "email"
            value = { manualContact.email }
            onChange = { handleManualChange }
            className = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" /
            >
            <
            /div>

            <
            div className = "grid grid-cols-2 gap-4" >
            <
            div >
            <
            label className = "block text-sm font-medium text-gray-700 mb-1" >
            Company <
            /label> <
            input type = "text"
            name = "company"
            value = { manualContact.company }
            onChange = { handleManualChange }
            className = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" /
            >
            <
            /div> <
            div >
            <
            label className = "block text-sm font-medium text-gray-700 mb-1" >
            Title <
            /label> <
            input type = "text"
            name = "title"
            value = { manualContact.title }
            onChange = { handleManualChange }
            className = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" /
            >
            <
            /div> <
            /div>

            <
            button type = "submit"
            className = "w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center"
            disabled = { createContactMutation.isLoading } >
            {
                createContactMutation.isLoading ? ( <
                    >
                    <
                    LoadingSpinner size = "sm" / >
                    <
                    span className = "ml-2" > Creating... < /span> <
                    />
                ) : (
                    "Add Contact"
                )
            } <
            /button> <
            /form>
        )
    } <
    /div>

{ /* Footer */ } {
    activeTab === "csv" && ( <
        div className = "px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3" >
        <
        button type = "button"
        onClick = { onClose }
        className = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        disabled = { importMutation.isLoading } >
        Cancel <
        /button> <
        button onClick = { handleCSVUpload }
        className = "px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
        disabled = { importMutation.isLoading || !csvFile || !campaignId } >
        {
            importMutation.isLoading ? ( <
                >
                <
                LoadingSpinner size = "sm" / >
                <
                span className = "ml-2" > Uploading... < /span> <
                />
            ) : (
                "Upload Contacts"
            )
        } <
        /button> <
        /div>
    )
} <
/div> <
/div> <
/div>
);
};

export default UploadContactsModal;