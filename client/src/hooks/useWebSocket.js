import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import websocketService from '../services/websocket';

export const useWebSocket = () => {
  const { user } = useAuth();
  const listenersRef = useRef(new Map());

  useEffect(() => {
    if (user?.token) {
      websocketService.connect(user.token);
    }

    return () => {
      websocketService.disconnect();
    };
  }, [user?.token]);

  const addListener = useCallback((event, callback) => {
    websocketService.on(event, callback);
    listenersRef.current.set(event, callback);
  }, []);

  const removeListener = useCallback((event) => {
    const callback = listenersRef.current.get(event);
    if (callback) {
      websocketService.off(event, callback);
      listenersRef.current.delete(event);
    }
  }, []);

  const sendMessage = useCallback((type, payload) => {
    websocketService.send(type, payload);
  }, []);

  const subscribeToCall = useCallback((callId, callback) => {
    websocketService.subscribeToCallUpdates(callId, callback);
  }, []);

  const subscribeToAgent = useCallback((agentId, callback) => {
    websocketService.subscribeToAgentUpdates(agentId, callback);
  }, []);

  const subscribeToOrganization = useCallback((organizationId, callback) => {
    websocketService.subscribeToOrganizationUpdates(organizationId, callback);
  }, []);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      listenersRef.current.forEach((callback, event) => {
        websocketService.off(event, callback);
      });
      listenersRef.current.clear();
    };
  }, []);

  return {
    isConnected: websocketService.isConnected,
    addListener,
    removeListener,
    sendMessage,
    subscribeToCall,
    subscribeToAgent,
    subscribeToOrganization,
    connectionStatus: websocketService.getConnectionStatus(),
  };
};

export const useCallUpdates = (callId) => {
  const { addListener, removeListener } = useWebSocket();

  useEffect(() => {
    if (!callId) return;

    const handleCallUpdate = (data) => {
      if (data.callId === callId) {
        // Handle call update
        console.log('Call update received:', data);
      }
    };

    addListener('call_status_update', handleCallUpdate);

    return () => {
      removeListener('call_status_update');
    };
  }, [callId, addListener, removeListener]);
};

export const useAgentUpdates = (agentId) => {
  const { addListener, removeListener } = useWebSocket();

  useEffect(() => {
    if (!agentId) return;

    const handleAgentUpdate = (data) => {
      if (data.agentId === agentId) {
        // Handle agent update
        console.log('Agent update received:', data);
      }
    };

    addListener('agent_status_change', handleAgentUpdate);

    return () => {
      removeListener('agent_status_change');
    };
  }, [agentId, addListener, removeListener]);
};

export const useOrganizationUpdates = (organizationId) => {
  const { addListener, removeListener } = useWebSocket();

  useEffect(() => {
    if (!organizationId) return;

    const handleOrganizationUpdate = (data) => {
      if (data.organizationId === organizationId) {
        // Handle organization update
        console.log('Organization update received:', data);
      }
    };

    addListener('organization_update', handleOrganizationUpdate);

    return () => {
      removeListener('organization_update');
    };
  }, [organizationId, addListener, removeListener]);
};

export default useWebSocket;
