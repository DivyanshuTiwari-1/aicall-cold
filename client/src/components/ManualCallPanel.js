import React, { useState, useEffect } from 'react';
import {
    PhoneIcon,
    PhoneXMarkIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    PauseIcon,
    PlayIcon
} from '@heroicons/react/24/outline';

const ManualCallPanel = ({ call, contact, onComplete, onCancel }) => {
    const [callStatus, setCallStatus] = useState('dialing');
    const [duration, setDuration] = useState(0);
    const [notes, setNotes] = useState('');
    const [selectedOutcome, setSelectedOutcome] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [isOnHold, setIsOnHold] = useState(false);

    // Timer effect
    useEffect(() => {
        let interval;
        if (callStatus === 'connected') {
            interval = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [callStatus]);

    // Simulate call progression
    useEffect(() => {
        const timer = setTimeout(() => {
            if (callStatus === 'dialing') {
                setCallStatus('ringing');
            } else if (callStatus === 'ringing') {
                setCallStatus('connected');
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [callStatus]);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleOutcomeSelect = (outcome) => {
        setSelectedOutcome(outcome);
    };

    const handleCompleteCall = () => {
        if (!selectedOutcome) {
            alert('Please select a call outcome');
            return;
        }

        onComplete({
            outcome: selectedOutcome,
            duration: duration,
            notes: notes,
            answered: selectedOutcome !== 'no_answer' && selectedOutcome !== 'busy',
            rejected: selectedOutcome === 'not_interested'
        });
    };

    const callOutcomes = [
        { value: 'scheduled', label: 'Meeting Scheduled', icon: CheckCircleIcon, color: 'green' },
        { value: 'interested', label: 'Interested', icon: CheckCircleIcon, color: 'blue' },
        { value: 'callback', label: 'Callback Requested', icon: ClockIcon, color: 'yellow' },
        { value: 'not_interested', label: 'Not Interested', icon: XCircleIcon, color: 'red' },
        { value: 'voicemail', label: 'Voicemail Left', icon: PhoneIcon, color: 'gray' },
        { value: 'busy', label: 'Busy', icon: PhoneIcon, color: 'orange' },
        { value: 'no_answer', label: 'No Answer', icon: PhoneIcon, color: 'gray' },
        { value: 'wrong_number', label: 'Wrong Number', icon: XCircleIcon, color: 'red' },
        { value: 'dnc_request', label: 'Do Not Call', icon: XCircleIcon, color: 'red' }
    ];

    const getStatusColor = (status) => {
        const colors = {
            'dialing': 'text-blue-600',
            'ringing': 'text-yellow-600',
            'connected': 'text-green-600',
            'ended': 'text-gray-600'
        };
        return colors[status] || 'text-gray-600';
    };

    const getStatusText = (status) => {
        const texts = {
            'dialing': 'Dialing...',
            'ringing': 'Ringing...',
            'connected': 'Connected',
            'ended': 'Call Ended'
        };
        return texts[status] || status;
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" />

                {/* Modal panel */}
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">Manual Call</h3>
                                <p className="text-sm text-gray-500">{contact.contact.firstName} {contact.contact.lastName}</p>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className={`flex items-center px-3 py-1 rounded-full text-sm ${getStatusColor(callStatus)}`}>
                                    <PhoneIcon className="h-4 w-4 mr-1" />
                                    {getStatusText(callStatus)}
                                </div>
                                {callStatus === 'connected' && (
                                    <div className="flex items-center text-lg font-mono">
                                        <ClockIcon className="h-5 w-5 mr-1 text-gray-400" />
                                        {formatDuration(duration)}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-sm font-medium text-gray-500">Phone</div>
                                    <div className="text-lg text-gray-900">{contact.contact.phone}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-500">Company</div>
                                    <div className="text-lg text-gray-900">{contact.contact.company || 'N/A'}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-500">Title</div>
                                    <div className="text-lg text-gray-900">{contact.contact.title || 'N/A'}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-500">Campaign</div>
                                    <div className="text-lg text-gray-900">{contact.campaign?.name || 'N/A'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Call Controls (when connected) */}
                        {callStatus === 'connected' && (
                            <div className="flex items-center justify-center space-x-4 mb-6">
                                <button
                                    onClick={() => setIsMuted(!isMuted)}
                                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                                        isMuted
                                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {isMuted ? <PauseIcon className="h-4 w-4 mr-1" /> : <PlayIcon className="h-4 w-4 mr-1" />}
                                    {isMuted ? 'Unmute' : 'Mute'}
                                </button>
                                <button
                                    onClick={() => setIsOnHold(!isOnHold)}
                                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                                        isOnHold
                                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <PauseIcon className="h-4 w-4 mr-1" />
                                    {isOnHold ? 'Resume' : 'Hold'}
                                </button>
                            </div>
                        )}

                        {/* Call Outcomes */}
                        <div className="mb-6">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Call Outcome</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {callOutcomes.map((outcome) => {
                                    const Icon = outcome.icon;
                                    return (
                                        <button
                                            key={outcome.value}
                                            onClick={() => handleOutcomeSelect(outcome.value)}
                                            className={`flex items-center p-3 rounded-md border text-sm font-medium transition-colors ${
                                                selectedOutcome === outcome.value
                                                    ? `border-${outcome.color}-500 bg-${outcome.color}-50 text-${outcome.color}-700`
                                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            <Icon className="h-4 w-4 mr-2" />
                                            {outcome.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Call Notes
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Add notes about the call..."
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end space-x-3">
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCompleteCall}
                                disabled={!selectedOutcome}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                                <CheckCircleIcon className="h-4 w-4 mr-1" />
                                Complete Call
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManualCallPanel;
