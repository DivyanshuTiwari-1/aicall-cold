import { MicrophoneIcon, PhoneIcon, PhoneXMarkIcon } from "@heroicons/react/24/solid";
import { useMutation } from "@tanstack/react-query";
import { TelnyxRTC } from '@telnyx/webrtc';
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { simpleCallsAPI } from "../services/simpleCalls";

/**
 * SimpleBrowserPhone - Direct calling without softphone
 * Click to call, talk through browser, auto-saved to history
 */
const SimpleBrowserPhone = ({ contact, onClose }) => {
    const [callState, setCallState] = useState('idle'); // idle, calling, connected, ended
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
  const [callId, setCallId] = useState(null);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('no_answer');
  const [phoneNumberInfo, setPhoneNumberInfo] = useState(null);
  const [fromNumber, setFromNumber] = useState(null);

    const audioRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const localStreamRef = useRef(null);
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const telnyxClientRef = useRef(null);
    const activeCallRef = useRef(null);

    // Start call mutation
    const startCallMutation = useMutation({
        mutationFn: (contactId) => simpleCallsAPI.startCall(contactId),
        onSuccess: (data) => {
            setCallId(data.call.id);
            setFromNumber(data.call.fromNumber);
            if (data.phoneNumberInfo) {
                setPhoneNumberInfo(data.phoneNumberInfo);
            }
            toast.success('Initiating call...');
        },
        onError: (error) => {
            const errorMsg = error?.response?.data?.message || 'Failed to start call';
            if (error?.response?.data?.limitReached) {
                toast.error(`${errorMsg}\nCalls today: ${error.response.data.callsMadeToday}/${error.response.data.dailyLimit}`, {
                    duration: 6000
                });
            } else {
                toast.error(errorMsg);
            }
            setCallState('idle');
        }
    });

    // Complete call mutation
    const completeCallMutation = useMutation({
        mutationFn: ({ callId, callData }) => simpleCallsAPI.completeCall(callId, callData),
        onSuccess: () => {
            toast.success('Call saved to history');
            if (onClose) {
                setTimeout(onClose, 1000);
            }
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Failed to save call');
        }
    });

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const startCall = async () => {
        try {
            setCallState('calling');
            toast('Initializing call...', { icon: '📞' });

            // Step 1: Create call record in database
            const result = await startCallMutation.mutateAsync(contact.id);

            // Step 2: Get Telnyx WebRTC credentials
            const tokenResponse = await simpleCallsAPI.getWebRTCToken();
            const credentials = tokenResponse.token;

            // Step 3: Initialize Telnyx WebRTC client
            console.log('Initializing Telnyx with username:', credentials.username);
            const telnyxClient = new TelnyxRTC({
                login_token: null, // We're using username/password auth
                login: credentials.username,
                password: credentials.password,
                ringtoneFile: null,
                ringbackFile: null,
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            });

            telnyxClientRef.current = telnyxClient;

            // Step 4: Setup event handlers
            telnyxClient.on('telnyx.ready', () => {
                console.log('Telnyx WebRTC ready');
                toast.success('Connected to phone system');
            });

            telnyxClient.on('telnyx.error', (error) => {
                console.error('Telnyx error:', error);
                toast.error(`Call error: ${error.message || 'Connection error'}`);
                setCallState('idle');
            });

            telnyxClient.on('telnyx.socket.error', (error) => {
                console.error('Telnyx socket error:', error);
                toast.error('Connection lost');
                setCallState('idle');
            });

            telnyxClient.on('telnyx.socket.close', () => {
                console.log('Telnyx socket closed');
                if (callState === 'calling' || callState === 'connected') {
                    handleCallEnded();
                }
            });

            // Step 5: Connect to Telnyx
            await telnyxClient.connect();

            // Step 6: Setup call event handlers on the client BEFORE making call
            telnyxClient.on('telnyx.notification', (notification) => {
                console.log('Telnyx notification:', notification);
                const method = notification.method;

                // Handle different call states
                if (method === 'telnyx_rtc.ringing') {
                    toast('Ringing...', { icon: '📞' });
                } else if (method === 'telnyx_rtc.answer' || method === 'telnyx_rtc.answered') {
                    setCallState('connected');
                    startTimeRef.current = Date.now();

                    // Start call timer
                    timerRef.current = setInterval(() => {
                        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
                    }, 1000);

                    toast.success(`Connected to ${contact.firstName}!`);
                } else if (method === 'telnyx_rtc.hangup' || method === 'telnyx_rtc.bye') {
                    handleCallEnded();
                }

                // Also check for callUpdate events
                if (notification.type === 'callUpdate') {
                    const state = notification.call?.state;
                    if (state === 'active' && callState !== 'connected') {
                        setCallState('connected');
                        startTimeRef.current = Date.now();
                        timerRef.current = setInterval(() => {
                            setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
                        }, 1000);
                        toast.success(`Connected to ${contact.firstName}!`);
                    }
                }
            });

            // Step 7: Get microphone access first
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                localStreamRef.current = stream;
                console.log('Microphone access granted');
            } catch (e) {
                console.error('Microphone access denied:', e);
                toast.error('Please allow microphone access to make calls');
                throw new Error('Microphone access required');
            }

            // Step 8: Make the actual call to customer
            const call = telnyxClient.newCall({
                destinationNumber: contact.phone,
                callerNumber: credentials.callerIdNumber || '+18058690081',
                audio: true,
                video: false,
                remoteElement: 'remoteAudio' // Bind to audio element
            });

            activeCallRef.current = call;
            console.log('Call initiated to:', contact.phone);

        } catch (error) {
            console.error('Failed to start call:', error);
            toast.error(error.message || 'Failed to initiate call');
            setCallState('idle');
        }
    };

    const handleCallEnded = () => {
        if (callState !== 'ended') {
            endCall();
        }
    };

    const endCall = async () => {
        if (!callId) {
            setCallState('idle');
            return;
        }

        setCallState('ended');

        // Hangup Telnyx call
        if (activeCallRef.current) {
            try {
                // Telnyx call object has a hangup method
                activeCallRef.current.hangup();
                console.log('Call hung up');
            } catch (e) {
                console.error('Error hanging up:', e);
            }
            activeCallRef.current = null;
        }

        // Disconnect Telnyx client
        if (telnyxClientRef.current) {
            try {
                telnyxClientRef.current.disconnect();
                console.log('Telnyx client disconnected');
            } catch (e) {
                console.error('Error disconnecting:', e);
            }
            telnyxClientRef.current = null;
        }

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }

        const finalDuration = duration;

        // Determine outcome based on call duration
        let finalOutcome = outcome;
        if (finalDuration < 5) {
            finalOutcome = 'no_answer';
        } else if (finalDuration >= 5 && outcome === 'no_answer') {
            // Call was answered if it lasted more than 5 seconds
            finalOutcome = 'answered';
        }

        // Save call to history
        try {
            await completeCallMutation.mutateAsync({
                callId,
                callData: {
                    outcome: finalOutcome,
                    duration: finalDuration,
                    notes,
                    answered: finalDuration > 5,
                    transcript: ''
                }
            });
        } catch (error) {
            console.error('Error saving call:', error);
            toast.error('Call ended but failed to save to history');
        }
    };

    const toggleMute = () => {
        if (activeCallRef.current) {
            try {
                if (isMuted) {
                    // Unmute
                    activeCallRef.current.unmute();
                    setIsMuted(false);
                    toast.success('Unmuted');
                } else {
                    // Mute
                    activeCallRef.current.mute();
                    setIsMuted(true);
                    toast.success('Muted');
                }
                console.log('Mute toggled:', !isMuted);
            } catch (e) {
                console.error('Error toggling mute:', e);
                toast.error('Failed to toggle mute');
            }
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg mx-auto">
            {/* Local audio (muted - for monitoring) */}
            <audio ref={audioRef} autoPlay muted />
            {/* Remote audio (customer voice) */}
            <audio id="remoteAudio" ref={remoteAudioRef} autoPlay />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Call Contact</h2>
                {onClose && callState === 'idle' && (
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Contact Info */}
            <div className="text-center mb-6 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-center mb-2">
                    <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-2xl font-bold text-blue-600">
                            {contact.firstName?.[0]}{contact.lastName?.[0]}
                        </span>
                    </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                    {contact.firstName} {contact.lastName}
                </h3>
                <p className="text-gray-600 font-mono">{contact.phone}</p>
                {contact.company && (
                    <p className="text-sm text-gray-500 mt-1">{contact.company}</p>
                )}
                {contact.title && (
                    <p className="text-xs text-gray-400">{contact.title}</p>
                )}
            </div>

            {/* Phone Number Info */}
            {phoneNumberInfo && (
                <div className="mb-4 bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center justify-between text-sm">
                        <div>
                            <p className="text-gray-600">
                                <span className="font-medium">Calling from:</span> {fromNumber}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500">
                                Calls today: <span className="font-semibold">{phoneNumberInfo.callsMadeToday}</span>/{phoneNumberInfo.dailyLimit}
                            </p>
                            <p className="text-xs text-green-600 font-medium">
                                {phoneNumberInfo.remaining} remaining
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Call Status */}
            <div className="text-center mb-6">
                {callState === 'idle' && (
                    <div className="py-4">
                        <p className="text-gray-500">Ready to call</p>
                        <p className="text-xs text-gray-400 mt-2">
                            🎧 Make sure your microphone is connected
                        </p>
                    </div>
                )}

                {callState === 'calling' && (
                    <div className="flex flex-col items-center py-4">
                        <div className="relative">
                            <div className="animate-ping absolute h-16 w-16 rounded-full bg-blue-400 opacity-75"></div>
                            <div className="relative h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center">
                                <PhoneIcon className="h-8 w-8 text-white animate-pulse" />
                            </div>
                        </div>
                        <p className="text-blue-600 font-medium mt-4">Calling...</p>
                        <p className="text-sm text-gray-500 mt-1">Connecting to customer</p>
                    </div>
                )}

                {callState === 'connected' && (
                    <div className="flex flex-col items-center py-4">
                        <div className="relative">
                            <div className={`h-16 w-16 rounded-full ${isMuted ? 'bg-yellow-500' : 'bg-green-600'} flex items-center justify-center`}>
                                {isMuted ? (
                                    <MicrophoneIcon className="h-8 w-8 text-white line-through" />
                                ) : (
                                    <PhoneIcon className="h-8 w-8 text-white" />
                                )}
                            </div>
                        </div>
                        <p className="text-green-600 font-medium mt-4">Connected</p>
                        <p className="text-3xl font-mono text-gray-900 mt-2 font-bold">
                            {formatDuration(duration)}
                        </p>
                        {localStreamRef.current && (
                            <p className="text-xs text-green-600 mt-2 flex items-center">
                                <span className="inline-block h-2 w-2 bg-green-600 rounded-full mr-2 animate-pulse"></span>
                                Microphone active
                            </p>
                        )}
                    </div>
                )}

                {callState === 'ended' && (
                    <div className="py-4">
                        <p className="text-gray-600 font-medium">Call ended</p>
                        <p className="text-sm text-gray-500 mt-1">Duration: {formatDuration(duration)}</p>
                    </div>
                )}
            </div>

            {/* Call Controls */}
            <div className="flex items-center justify-center space-x-4 mb-6">
                {callState === 'idle' && (
                    <button
                        onClick={startCall}
                        disabled={startCallMutation.isLoading}
                        className="flex items-center px-8 py-4 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors shadow-lg disabled:opacity-50"
                    >
                        <PhoneIcon className="h-6 w-6 mr-2" />
                        <span className="font-semibold">Call Now</span>
                    </button>
                )}

                {(callState === 'calling' || callState === 'connected') && (
                    <>
                        {callState === 'connected' && (
                            <button
                                onClick={toggleMute}
                                className={`px-6 py-3 rounded-full transition-colors shadow ${
                                    isMuted
                                        ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                {isMuted ? '🔇 Unmute' : '🎤 Mute'}
                            </button>
                        )}
                        <button
                            onClick={endCall}
                            disabled={completeCallMutation.isLoading}
                            className="flex items-center px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg disabled:opacity-50"
                        >
                            <PhoneXMarkIcon className="h-6 w-6 mr-2" />
                            End Call
                        </button>
                    </>
                )}
            </div>

            {/* Call Notes (only show when connected or ended) */}
            {(callState === 'connected' || callState === 'ended') && (
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Outcome
                        </label>
                        <select
                            value={outcome}
                            onChange={(e) => setOutcome(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            disabled={callState === 'ended'}
                        >
                            <option value="answered">Answered</option>
                            <option value="interested">Interested</option>
                            <option value="not_interested">Not Interested</option>
                            <option value="callback">Callback Later</option>
                            <option value="voicemail">Voicemail</option>
                            <option value="busy">Busy</option>
                            <option value="no_answer">No Answer</option>
                            <option value="wrong_number">Wrong Number</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 resize-none"
                            rows="3"
                            placeholder="Add notes about this call..."
                            disabled={callState === 'ended'}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default SimpleBrowserPhone;
