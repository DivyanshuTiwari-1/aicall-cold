class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000;
    this.listeners = new Map();
    this.isConnected = false;
    this.token = null;
  }

  connect(token) {
    this.token = token;
    // Use relative WebSocket URL for nginx proxy, or fallback to localhost
    let wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3000';

    // If using relative path (starts with /), convert to full WebSocket URL
    if (wsUrl.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}${wsUrl}`;
    }

    try {
      this.ws = new WebSocket(`${wsUrl}?token=${token}`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.emit('disconnected');

        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.emit('error', error);
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  handleMessage(data) {
    const { type, payload } = data;

    // Emit specific event types
    if (type) {
      this.emit(type, payload);
    }

    // Emit generic message event
    this.emit('message', data);
  }

  // Event listener management
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }

  // Send message to server
  send(type, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket is not connected. Cannot send message.');
    }
  }

  // Subscribe to specific events
  subscribeToCallUpdates(callId, callback) {
    this.send('subscribe_call', { callId });
    this.on('call_status_update', (data) => {
      if (data.callId === callId) {
        callback(data);
      }
    });
  }

  subscribeToAgentUpdates(agentId, callback) {
    this.send('subscribe_agent', { agentId });
    this.on('agent_status_change', (data) => {
      if (data.agentId === agentId) {
        callback(data);
      }
    });
  }

  subscribeToOrganizationUpdates(organizationId, callback) {
    this.send('subscribe_organization', { organizationId });
    this.on('organization_update', (data) => {
      if (data.organizationId === organizationId) {
        callback(data);
      }
    });
  }

  // Unsubscribe from events
  unsubscribeFromCallUpdates(callId) {
    this.send('unsubscribe_call', { callId });
  }

  unsubscribeFromAgentUpdates(agentId) {
    this.send('unsubscribe_agent', { agentId });
  }

  unsubscribeFromOrganizationUpdates(organizationId) {
    this.send('unsubscribe_organization', { organizationId });
  }

  // Disconnect
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.isConnected = false;
    this.listeners.clear();
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: this.ws ? this.ws.readyState : WebSocket.CLOSED,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
