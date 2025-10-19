const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Emotional Alerts Service
 * Monitors emotional state during calls and triggers alerts for sustained negative emotions
 */

/**
 * Monitor emotional state and trigger alerts if needed
 * @param {string} callId - The call ID
 * @param {Array} emotionTimeline - Array of emotion data points
 * @param {Object} currentEmotion - Current emotion analysis
 * @returns {Promise<Object|null>} Alert data if triggered
 */
async function monitorEmotionalState(callId, emotionTimeline, currentEmotion) {
  try {
    const alertThresholds = {
      sustainedFrustration: 20, // seconds
      highIntensity: 0.8,
      negativeEmotions: ['anger', 'frustration', 'sadness', 'disgust']
    };

    // Check for sustained negative emotions
    const sustainedAlert = await checkSustainedNegativeEmotion(
      callId,
      emotionTimeline,
      alertThresholds
    );

    if (sustainedAlert) {
      return await createEmotionalAlert(callId, 'sustained_frustration', sustainedAlert);
    }

    // Check for high-intensity negative emotions
    if (currentEmotion &&
        alertThresholds.negativeEmotions.includes(currentEmotion.dominant) &&
        currentEmotion.intensity >= alertThresholds.highIntensity) {

      return await createEmotionalAlert(callId, 'high_negative', {
        emotion: currentEmotion.dominant,
        intensity: currentEmotion.intensity,
        duration: 0
      });
    }

    return null;
  } catch (error) {
    logger.error('Error monitoring emotional state:', error);
    throw error;
  }
}

/**
 * Check for sustained negative emotions over time threshold
 * @param {string} callId - The call ID
 * @param {Array} emotionTimeline - Array of emotion data points
 * @param {Object} thresholds - Alert thresholds
 * @returns {Promise<Object|null>} Sustained emotion data if found
 */
async function checkSustainedNegativeEmotion(callId, emotionTimeline, thresholds) {
  try {
    if (!emotionTimeline || emotionTimeline.length < 2) {
      return null;
    }

    // Sort timeline by timestamp
    const sortedTimeline = emotionTimeline.sort((a, b) => a.timestamp - b.timestamp);

    let sustainedStart = null;
    let sustainedDuration = 0;
    let currentEmotion = null;

    for (const emotion of sortedTimeline) {
      const isNegative = thresholds.negativeEmotions.includes(emotion.emotion);

      if (isNegative && emotion.intensity >= 0.6) {
        if (currentEmotion === emotion.emotion) {
          // Same negative emotion continuing
          sustainedDuration += 5; // Assuming 5-second intervals
        } else {
          // New negative emotion starting
          sustainedStart = emotion.timestamp;
          sustainedDuration = 5;
          currentEmotion = emotion.emotion;
        }
      } else {
        // Emotion changed or intensity dropped
        if (sustainedDuration >= thresholds.sustainedFrustration) {
          return {
            emotion: currentEmotion,
            intensity: emotion.intensity,
            duration: sustainedDuration,
            startTime: sustainedStart
          };
        }
        sustainedStart = null;
        sustainedDuration = 0;
        currentEmotion = null;
      }
    }

    // Check if we ended with sustained emotion
    if (sustainedDuration >= thresholds.sustainedFrustration) {
      return {
        emotion: currentEmotion,
        intensity: sortedTimeline[sortedTimeline.length - 1].intensity,
        duration: sustainedDuration,
        startTime: sustainedStart
      };
    }

    return null;
  } catch (error) {
    logger.error('Error checking sustained negative emotion:', error);
    throw error;
  }
}

/**
 * Create an emotional alert
 * @param {string} callId - The call ID
 * @param {string} alertType - Type of alert
 * @param {Object} emotionData - Emotion data
 * @returns {Promise<Object>} Created alert
 */
async function createEmotionalAlert(callId, alertType, emotionData) {
  try {
    // Check if alert already exists for this call and type
    const existingAlert = await query(`
      SELECT id FROM emotional_alerts
      WHERE call_id = $1 AND alert_type = $2 AND resolved = false
    `, [callId, alertType]);

    if (existingAlert.rows.length > 0) {
      logger.info(`Alert already exists for call ${callId}, type ${alertType}`);
      return existingAlert.rows[0];
    }

    // Create new alert
    const result = await query(`
      INSERT INTO emotional_alerts (
        call_id, alert_type, emotion, intensity, duration_seconds
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      callId,
      alertType,
      emotionData.emotion,
      emotionData.intensity,
      emotionData.duration
    ]);

    const alert = result.rows[0];

    // Create supervisor task
    await createSupervisorTask(alert.id, callId, alertType, emotionData);

    // Trigger webhooks
    await triggerWebhooks('call.emotion.alert', {
      callId,
      alertType,
      emotion: emotionData.emotion,
      intensity: emotionData.intensity,
      duration: emotionData.duration,
      alertId: alert.id
    });

    logger.info(`Emotional alert created: ${alert.id}`, {
      callId,
      alertType,
      emotion: emotionData.emotion
    });

    return alert;
  } catch (error) {
    logger.error('Error creating emotional alert:', error);
    throw error;
  }
}

/**
 * Create a supervisor task for intervention
 * @param {string} alertId - The alert ID
 * @param {string} callId - The call ID
 * @param {string} alertType - Type of alert
 * @param {Object} emotionData - Emotion data
 * @returns {Promise<Object>} Created task
 */
async function createSupervisorTask(alertId, callId, alertType, emotionData) {
  try {
    // Get available supervisors
    const supervisors = await query(`
      SELECT u.id, u.first_name, u.last_name
      FROM users u
      WHERE u.organization_id = (
        SELECT organization_id FROM calls WHERE id = $1
      ) AND u.role IN ('manager', 'admin')
      ORDER BY u.last_seen_at DESC
      LIMIT 1
    `, [callId]);

    if (supervisors.rows.length === 0) {
      logger.warn(`No supervisors available for call ${callId}`);
      return null;
    }

    const supervisor = supervisors.rows[0];
    const taskType = alertType === 'sustained_frustration' ? 'intervention_needed' : 'emotion_monitor';
    const priority = alertType === 'sustained_frustration' ? 'high' : 'medium';

    const result = await query(`
      INSERT INTO supervisor_tasks (
        alert_id, call_id, assigned_to, task_type, priority, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      alertId,
      callId,
      supervisor.id,
      taskType,
      priority,
      `Customer showing ${emotionData.emotion} for ${emotionData.duration}s (intensity: ${emotionData.intensity})`
    ]);

    const task = result.rows[0];

    logger.info(`Supervisor task created: ${task.id}`, {
      alertId,
      callId,
      supervisorId: supervisor.id,
      taskType
    });

    return task;
  } catch (error) {
    logger.error('Error creating supervisor task:', error);
    throw error;
  }
}

/**
 * Trigger webhooks for emotional alerts
 * @param {string} eventType - Type of event
 * @param {Object} payload - Event payload
 * @returns {Promise<void>}
 */
async function triggerWebhooks(eventType, payload) {
  try {
    // Get webhook configurations for this event type
    const webhooks = await query(`
      SELECT * FROM webhook_configs
      WHERE event_type = $1 AND is_active = true
    `, [eventType]);

    for (const webhook of webhooks.rows) {
      try {
        await sendWebhook(webhook, payload);
      } catch (error) {
        logger.error(`Webhook delivery failed for ${webhook.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error triggering webhooks:', error);
    throw error;
  }
}

/**
 * Send webhook with retry logic
 * @param {Object} webhook - Webhook configuration
 * @param {Object} payload - Event payload
 * @returns {Promise<void>}
 */
async function sendWebhook(webhook, payload) {
  const maxRetries = webhook.retry_count || 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhook.secret_key || '',
          'User-Agent': 'Outiq-Webhook/1.0'
        },
        body: JSON.stringify({
          event: webhook.event_type,
          timestamp: new Date().toISOString(),
          data: payload
        })
      });

      // Log successful delivery
      await query(`
        INSERT INTO webhook_logs (
          webhook_config_id, event_type, payload, status_code, response_body, attempt_count, delivered_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        webhook.id,
        webhook.event_type,
        JSON.stringify(payload),
        response.status,
        await response.text(),
        attempt + 1,
        new Date()
      ]);

      if (response.ok) {
        logger.info(`Webhook delivered successfully: ${webhook.id}`);
        return;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      attempt++;

      // Log failed attempt
      await query(`
        INSERT INTO webhook_logs (
          webhook_config_id, event_type, payload, status_code, response_body, attempt_count
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        webhook.id,
        webhook.event_type,
        JSON.stringify(payload),
        0,
        error.message,
        attempt
      ]);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        logger.warn(`Webhook attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error(`Webhook delivery failed after ${maxRetries} attempts:`, error);
        throw error;
      }
    }
  }
}

/**
 * Get emotional alerts for a call
 * @param {string} callId - The call ID
 * @returns {Promise<Array>} List of alerts
 */
async function getEmotionalAlerts(callId) {
  try {
    const result = await query(`
      SELECT ea.*, st.id as task_id, st.status as task_status, st.assigned_to
      FROM emotional_alerts ea
      LEFT JOIN supervisor_tasks st ON ea.id = st.alert_id
      WHERE ea.call_id = $1
      ORDER BY ea.created_at DESC
    `, [callId]);

    return result.rows;
  } catch (error) {
    logger.error('Error getting emotional alerts:', error);
    throw error;
  }
}

/**
 * Resolve an emotional alert
 * @param {string} alertId - The alert ID
 * @param {string} resolvedBy - User ID who resolved it
 * @param {string} notes - Resolution notes
 * @returns {Promise<Object>} Updated alert
 */
async function resolveEmotionalAlert(alertId, resolvedBy, notes = null) {
  try {
    const result = await query(`
      UPDATE emotional_alerts
      SET resolved = true, resolved_at = CURRENT_TIMESTAMP, resolved_by = $2, resolution_notes = $3
      WHERE id = $1
      RETURNING *
    `, [alertId, resolvedBy, notes]);

    const alert = result.rows[0];

    // Update related supervisor task
    await query(`
      UPDATE supervisor_tasks
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE alert_id = $1
    `, [alertId]);

    logger.info(`Emotional alert resolved: ${alertId}`, {
      resolvedBy,
      notes
    });

    return alert;
  } catch (error) {
    logger.error('Error resolving emotional alert:', error);
    throw error;
  }
}

module.exports = {
  monitorEmotionalState,
  createEmotionalAlert,
  createSupervisorTask,
  triggerWebhooks,
  getEmotionalAlerts,
  resolveEmotionalAlert
};
