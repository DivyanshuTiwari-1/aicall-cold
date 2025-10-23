import { PhoneIcon, PhoneXMarkIcon } from "@heroicons/react/24/solid";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

/**
 * BrowserPhone - WebRTC-based phone for direct browser calling
 * No softphone needed!
 */
const BrowserPhone = ({ contact, onCallEnd, onCallStart }) => {
    const [callState, setCallState] = useState('idle'); // idle, calling, connected, ended
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [callId, setCallId] = useState(null);

    const audioRef = useRef(null);
    const localStreamRef = useRef(null);
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);

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

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            if (audioRef.current) {
                audioRef.current.srcObject = stream;
            }

            // Notify parent component
            if (onCallStart) {
                const callData = await onCallStart(contact.id);
                setCallId(callData.call.id);
            }

            // Simulate call connection (replace with actual WebRTC signaling)
            setTimeout(() => {
                setCallState('connected');
                startTimeRef.current = Date.now();

                // Start call timer
                timerRef.current = setInterval(() => {
                    setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
                }, 1000);

                toast.success('Call connected!');
            }, 2000);

        } catch (error) {
            console.error('Failed to start call:', error);
            toast.error('Failed to access microphone. Please allow microphone access.');
            setCallState('idle');
        }
    };

    const endCall = async () => {
        setCallState('ended');

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }

        const finalDuration = duration;

        // Notify parent component
        if (onCallEnd) {
            await onCallEnd(callId, finalDuration);
        }

        // Reset state
        setTimeout(() => {
            setCallState('idle');
            setDuration(0);
            setCallId(null);
        }, 1000);
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = isMuted;
            });
            setIsMuted(!isMuted);
            toast.success(isMuted ? 'Unmuted' : 'Muted');
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
            <audio ref={audioRef} autoPlay />

            {/* Contact Info */}
            <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                    {contact.firstName} {contact.lastName}
                </h3>
                <p className="text-gray-600">{contact.phone}</p>
                {contact.company && (
                    <p className="text-sm text-gray-500">{contact.company}</p>
                )}
            </div>

            {/* Call Status */}
            <div className="text-center mb-6">
                {callState === 'idle' && (
                    <p className="text-gray-500">Ready to call</p>
                )}
                {callState === 'calling' && (
                    <div className="flex flex-col items-center">
                        <div className="animate-pulse text-blue-600 mb-2">
                            <PhoneIcon className="h-12 w-12" />
                        </div>
                        <p className="text-blue-600 font-medium">Calling...</p>
                    </div>
                )}
                {callState === 'connected' && (
                    <div className="flex flex-col items-center">
                        <div className="text-green-600 mb-2">
                            <PhoneIcon className="h-12 w-12" />
                        </div>
                        <p className="text-green-600 font-medium">Connected</p>
                        <p className="text-2xl font-mono text-gray-900 mt-2">
                            {formatDuration(duration)}
                        </p>
                    </div>
                )}
                {callState === 'ended' && (
                    <p className="text-gray-500">Call ended</p>
                )}
            </div>

            {/* Call Controls */}
            <div className="flex items-center justify-center space-x-4">
                {callState === 'idle' && (
                    <button
                        onClick={startCall}
                        className="flex items-center px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
                    >
                        <PhoneIcon className="h-6 w-6 mr-2" />
                        Call
                    </button>
                )}

                {(callState === 'calling' || callState === 'connected') && (
                    <>
                        {callState === 'connected' && (
                            <button
                                onClick={toggleMute}
                                className={`px-4 py-2 rounded-full transition-colors ${
                                    isMuted
                                        ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                {isMuted ? 'Unmute' : 'Mute'}
                            </button>
                        )}
                        <button
                            onClick={endCall}
                            className="flex items-center px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                        >
                            <PhoneXMarkIcon className="h-6 w-6 mr-2" />
                            End Call
                        </button>
                    </>
                )}
            </div>

            {/* Microphone Status */}
            <div className="mt-4 text-center">
                {localStreamRef.current && (
                    <p className="text-xs text-green-600">
                        🎤 Microphone active
                    </p>
                )}
            </div>
        </div>
    );
};

export default BrowserPhone;
