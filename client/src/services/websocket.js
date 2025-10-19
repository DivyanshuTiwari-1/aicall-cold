import io from 'socket.io-client';

class WebSocketService {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
    }

    connect() {
        if (this.socket && this.isConnected) {
            return this.socket;
        }

        const wsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:3000';

        this.socket = io(wsUrl, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: this.reconnectDelay,
        });

        this.socket.on('connect', () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
        });

        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.isConnected = false;
            this.reconnectAttempts++;
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`WebSocket reconnected after ${attemptNumber} attempts`);
            this.isConnected = true;
            this.reconnectAttempts = 0;
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('WebSocket reconnection error:', error);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('WebSocket reconnection failed');
            this.isConnected = false;
        });

        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    emit(event, data) {
        if (this.socket && this.isConnected) {
            this.socket.emit(event, data);
        } else {
            console.warn('WebSocket not connected, cannot emit event:', event);
        }
    }

    on(event, callback) {
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    off(event, callback) {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    // Specific methods for AI Dialer events
    joinCallRoom(callId) {
        this.emit('join_call_room', { callId });
    }

    leaveCallRoom(callId) {
        this.emit('leave_call_room', { callId });
    }

    sendIntervention(callId, message) {
        this.emit('send_intervention', { callId, message });
    }

    updateCallStatus(callId, status) {
        this.emit('update_call_status', { callId, status });
    }

    // Listen for specific AI Dialer events
    onCallUpdate(callback) {
        this.on('call_update', callback);
    }

    onConversationUpdate(callback) {
        this.on('conversation_update', callback);
    }

    onObjectionDetected(callback) {
        this.on('objection_detected', callback);
    }

    onEmotionChange(callback) {
        this.on('emotion_change', callback);
    }

    onCallEnded(callback) {
        this.on('call_ended', callback);
    }

    onInterventionRequested(callback) {
        this.on('intervention_requested', callback);
    }

    // Utility methods
    isConnected() {
        return this.isConnected;
    }

    getConnectionState() {
        return this.socket ? this.socket.connected : false;
    }
}

// Create singleton instance
const websocketAPI = new WebSocketService();

export default websocketAPI;