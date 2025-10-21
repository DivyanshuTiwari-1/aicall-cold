import {
    ClockIcon,
    MicrophoneIcon,
    PhoneIcon,
    PhoneXMarkIcon,
    SpeakerWaveIcon,
    SpeakerXMarkIcon
} from '@heroicons/react/24/outline';
import JsSIP from 'jssip';
import React, { useCallback, useEffect, useRef, useState } from 'react';

const Softphone = ({
    onCallStart,
    onCallEnd,
    onCallStatusChange,
    contactInfo = null,
    isVisible = true,
    onMakeCall = null
}) => {
    const [isRegistered, setIsRegistered] = useState(false);
    const [isCallActive, setIsCallActive] = useState(false);
    const [callStatus, setCallStatus] = useState('idle'); // idle, ringing, connected, ended
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [callDuration, setCallDuration] = useState(0);
    const [error, setError] = useState(null);

    const sipRef = useRef(null);
    const sessionRef = useRef(null);
    const audioRef = useRef(null);
    const durationIntervalRef = useRef(null);

    // Initialize SIP client
    useEffect(() => {
        const initializeSIP = async () => {
            // Skip SIP initialization for manual calls - we'll use the manual call API instead
            if (onMakeCall) {
                setIsRegistered(true); // Simulate registered state for manual calls
                setError(null);
                return;
            }

            try {
                // Fetch SIP credentials from API
                const response = await fetch('/api/v1/users/me/sip-credentials', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to get SIP credentials');
                }

                const { sipCredentials } = await response.json();

                const socket = new JsSIP.WebSocketInterface(`wss://${sipCredentials.server}:${sipCredentials.port}/ws`);
                const configuration = {
                    sockets: [socket],
                    uri: `sip:${sipCredentials.username}@${sipCredentials.domain}`,
                    password: sipCredentials.password,
                    register: true,
                    register_expires: 600,
                    no_answer_timeout: 30,
                    session_timers: false,
                };

                sipRef.current = new JsSIP.UA(configuration);

                // Event handlers
                sipRef.current.on('registered', () => {
                    setIsRegistered(true);
                    setError(null);
                    console.log('SIP registered successfully');
                });

                sipRef.current.on('unregistered', () => {
                    setIsRegistered(false);
                    console.log('SIP unregistered');
                });

                sipRef.current.on('registrationFailed', (e) => {
                    setError('SIP registration failed: ' + e.cause);
                    setIsRegistered(false);
                    console.error('SIP registration failed:', e);
                });

                sipRef.current.on('connected', () => {
                    console.log('SIP connected to server');
                });

                sipRef.current.on('disconnected', () => {
                    console.log('SIP disconnected from server');
                    setIsRegistered(false);
                });

                sipRef.current.on('newRTCSession', (e) => {
                    const session = e.session;
                    sessionRef.current = session;

                    // Handle incoming call
                    if (session.direction === 'incoming') {
                        setCallStatus('ringing');
                        setIsCallActive(true);
                        onCallStatusChange?.('ringing');
                    }

                    // Handle outgoing call
                    if (session.direction === 'outgoing') {
                        setCallStatus('ringing');
                        setIsCallActive(true);
                        onCallStatusChange?.('ringing');
                    }

                    // Session events
                    session.on('progress', () => {
                        setCallStatus('ringing');
                        onCallStatusChange?.('ringing');
                    });

                    session.on('accepted', () => {
                        setCallStatus('connected');
                        onCallStatusChange?.('connected');
                        startCallTimer();
                    });

                    session.on('confirmed', () => {
                        setCallStatus('connected');
                        onCallStatusChange?.('connected');
                        startCallTimer();
                    });

                    session.on('ended', () => {
                        setCallStatus('ended');
                        setIsCallActive(false);
                        onCallStatusChange?.('ended');
                        stopCallTimer();
                        sessionRef.current = null;
                    });

                    session.on('failed', (e) => {
                        setCallStatus('failed');
                        setIsCallActive(false);
                        onCallStatusChange?.('failed');
                        stopCallTimer();
                        sessionRef.current = null;
                    });

                    // Handle RTC peer connection for audio
                    session.connection.addEventListener('addstream', (e) => {
                        if (audioRef.current) {
                            audioRef.current.srcObject = e.stream;
                            audioRef.current.play();
                        }
                    });
                });

                sipRef.current.start();

            } catch (err) {
                setError('Failed to initialize SIP client');
            }
        };

        initializeSIP();

        return () => {
            if (sipRef.current) {
                sipRef.current.stop();
            }
            stopCallTimer();
        };
    }, [onMakeCall]);

    const startCallTimer = () => {
        setCallDuration(0);
        durationIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };

    const stopCallTimer = () => {
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const makeCall = useCallback((phoneNumber) => {
        if (isCallActive) {
            setError('Call already in progress');
            return;
        }

        // If onMakeCall is provided, use it instead of direct SIP call
        if (onMakeCall) {
            onMakeCall(phoneNumber);
            return;
        }

        if (!isRegistered) {
            setError('Not registered to SIP server');
            return;
        }

        try {
            const options = {
                eventHandlers: {
                    'progress': () => {
                        setCallStatus('ringing');
                        onCallStatusChange?.('ringing');
                    },
                    'accepted': () => {
                        setCallStatus('connected');
                        onCallStatusChange?.('connected');
                        startCallTimer();
                    },
                    'confirmed': () => {
                        setCallStatus('connected');
                        onCallStatusChange?.('connected');
                        startCallTimer();
                    },
                    'ended': () => {
                        setCallStatus('ended');
                        setIsCallActive(false);
                        onCallStatusChange?.('ended');
                        stopCallTimer();
                        sessionRef.current = null;
                    },
                    'failed': (e) => {
                        setCallStatus('failed');
                        setIsCallActive(false);
                        onCallStatusChange?.('failed');
                        stopCallTimer();
                        sessionRef.current = null;
                    }
                },
                mediaConstraints: { audio: true, video: false }
            };

            const session = sipRef.current.call(`sip:${phoneNumber}@your-asterisk-server`, options);
            sessionRef.current = session;
            setIsCallActive(true);
            onCallStart?.(phoneNumber);

        } catch (err) {
            setError('Failed to initiate call');
        }
    }, [isRegistered, isCallActive, onCallStart, onCallStatusChange, onMakeCall]);

    const answerCall = () => {
        if (sessionRef.current && sessionRef.current.direction === 'incoming') {
            sessionRef.current.answer();
        }
    };

    const hangupCall = () => {
        if (sessionRef.current) {
            sessionRef.current.terminate();
            sessionRef.current = null;
            setIsCallActive(false);
            setCallStatus('ended');
            onCallEnd?.();
            stopCallTimer();
        }
    };

    const toggleMute = () => {
        if (sessionRef.current) {
            if (isMuted) {
                sessionRef.current.unmute();
            } else {
                sessionRef.current.mute();
            }
            setIsMuted(!isMuted);
        }
    };

    const toggleSpeaker = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isSpeakerOn;
            setIsSpeakerOn(!isSpeakerOn);
        }
    };

    const handleKeyPress = (e) => {
        if (sessionRef.current && callStatus === 'connected') {
            // Send DTMF tones
            sessionRef.current.sendDTMF(e.key);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-80 z-50">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                        isRegistered ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium text-gray-700">
                        {isRegistered ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                {contactInfo && (
                    <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                            {contactInfo.firstName} {contactInfo.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                            {contactInfo.phone}
                        </div>
                    </div>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Call Status */}
            <div className="text-center mb-4">
                <div className="text-lg font-semibold text-gray-900 mb-1">
                    {callStatus === 'idle' && 'Ready to Call'}
                    {callStatus === 'ringing' && 'Ringing...'}
                    {callStatus === 'connected' && 'Connected'}
                    {callStatus === 'ended' && 'Call Ended'}
                    {callStatus === 'failed' && 'Call Failed'}
                </div>

                {isCallActive && (
                    <div className="flex items-center justify-center text-sm text-gray-600">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        {formatDuration(callDuration)}
                    </div>
                )}
            </div>

            {/* Call Controls */}
            <div className="space-y-3">
                {/* Main Call Button */}
                <div className="flex justify-center">
                    {!isCallActive ? (
                        <button
                            onClick={() => contactInfo && makeCall(contactInfo.phone)}
                            disabled={!isRegistered || !contactInfo}
                            className={`w-16 h-16 rounded-full flex items-center justify-center text-white ${
                                isRegistered && contactInfo
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-gray-400 cursor-not-allowed'
                            } transition-colors`}
                        >
                            <PhoneIcon className="h-8 w-8" />
                        </button>
                    ) : (
                        <div className="flex space-x-2">
                            {callStatus === 'ringing' && sessionRef.current?.direction === 'incoming' && (
                                <button
                                    onClick={answerCall}
                                    className="w-12 h-12 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center text-white"
                                >
                                    <PhoneIcon className="h-6 w-6" />
                                </button>
                            )}
                            <button
                                onClick={hangupCall}
                                className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white"
                            >
                                <PhoneXMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Secondary Controls */}
                {isCallActive && callStatus === 'connected' && (
                    <div className="flex justify-center space-x-4">
                        <button
                            onClick={toggleMute}
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isMuted
                                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            } transition-colors`}
                        >
            <MicrophoneIcon className="h-5 w-5" />
                        </button>

                        <button
                            onClick={toggleSpeaker}
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isSpeakerOn
                                    ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            } transition-colors`}
                        >
                            {isSpeakerOn ? (
                                <SpeakerWaveIcon className="h-5 w-5" />
                            ) : (
                                <SpeakerXMarkIcon className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                )}

                {/* DTMF Keypad */}
                {isCallActive && callStatus === 'connected' && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
                            <button
                                key={key}
                                onClick={() => handleKeyPress({ key })}
                                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700"
                            >
                                {key}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Hidden Audio Element */}
            <audio
                ref={audioRef}
                autoPlay
                playsInline
                muted={!isSpeakerOn}
            />
        </div>
    );
};

export default Softphone;
