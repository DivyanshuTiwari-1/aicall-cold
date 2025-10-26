import EventEmitter from 'events';

/**
 * WebSocket Service for Real-Time Updates
 * Provides event-based communication with backend WebSocket server
 */

class WebSocketService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000;
    this.heartbeatInterval = null;
    this.token = null;
    this.subscriptions = new Set();
  }

  /**
   * Connect to WebSocket server
   */
  connect(token) {
    if (this.ws && this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    this.token = token;
    const wsUrl = process.env.REACT_APP_WS_URL || this.getWebSocketUrl();

    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.startHeartbeat();

        // Re-subscribe to all previous subscriptions
        this.subscriptions.forEach((subscription) => {
          this.send(subscription.type, subscription.data);
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📩 WebSocket message:', data.type);

          // Emit the specific event type
          this.emit(data.type, data);

          // Also emit a general 'message' event
          this.emit('message', data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('🔴 WebSocket disconnected');
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected');
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Get WebSocket URL from current window location
   */
  getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.REACT_APP_API_PORT || '3000';

    // If running on localhost, use the port directly
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${protocol}//${host}:${port}`;
    }

    // For production, use the same host
    return `${protocol}//${window.location.host}`;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.ws) {
      this.stopHeartbeat();
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.subscriptions.clear();
    }
  }

  /**
   * Send message to WebSocket server
   */
  send(type, payload = {}) {
    if (this.ws && this.isConnected) {
      const message = { type, ...payload };
      this.ws.send(JSON.stringify(message));
      console.log('📤 Sent WebSocket message:', type);
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  /**
   * Subscribe to organization updates
   */
  subscribeToOrganizationUpdates(organizationId) {
    const subscription = {
      type: 'subscribe_organization',
      data: { organization_id: organizationId }
    };

    this.subscriptions.add(subscription);
    this.send('subscribe_organization', { organization_id: organizationId });
  }

  /**
   * Subscribe to call updates
   */
  subscribeToCallUpdates(callId) {
    const subscription = {
      type: 'subscribe_call',
      data: { call_id: callId }
    };

    this.subscriptions.add(subscription);
    this.send('subscribe_call', { call_id: callId });
  }

  /**
   * Subscribe to agent updates
   */
  subscribeToAgentUpdates(agentId, organizationId) {
    const subscription = {
      type: 'subscribe_agent',
      data: { agent_id: agentId, organization_id: organizationId }
    };

    this.subscriptions.add(subscription);
    this.send('subscribe_agent', { agent_id: agentId, organization_id: organizationId });
  }

  /**
   * Subscribe to user updates
   */
  subscribeToUserUpdates(userId, organizationId) {
    const subscription = {
      type: 'subscribe_user',
      data: { user_id: userId, organization_id: organizationId }
    };

    this.subscriptions.add(subscription);
    this.send('subscribe_user', { user_id: userId, organization_id: organizationId });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send('ping');
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (!this.isConnected && this.token) {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(this.token);
      }
    }, delay);
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: this.subscriptions.size
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
