<?php
/**
 * AI Dialer Hangup AGI Script - Call Cleanup
 *
 * This script handles call cleanup and final logging when a call ends.
 * It notifies the server about call completion and logs final statistics.
 */

// AGI Environment Variables
$call_id = $argv[1] ?? '';
$call_state = $argv[2] ?? 'unknown';

// Configuration
$api_base_url = getenv('AI_DIALER_URL') ?: 'http://localhost:3000/api/v1';

// Logging function
function agi_log($message) {
    error_log("[AI-DIALER-HANGUP-AGI] " . $message);
}

// Make API request to Node.js server
function make_api_request($endpoint, $data = []) {
    global $api_base_url;

    $url = $api_base_url . $endpoint;
    $ch = curl_init();

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        agi_log("CURL Error: " . $error);
        return false;
    }

    if ($http_code !== 200) {
        agi_log("API Error: HTTP $http_code - $response");
        return false;
    }

    return json_decode($response, true);
}

// Get call duration from Asterisk
function get_call_duration() {
    global $agi;

    try {
        $agi->exec('GetVariable', 'CDR(duration)');
        $duration = $agi->get_variable('CDR(duration)');
        return intval($duration) ?: 0;
    } catch (Exception $e) {
        agi_log("Could not get call duration: " . $e->getMessage());
        return 0;
    }
}

// Get call status from Asterisk
function get_call_status() {
    global $agi;

    try {
        $agi->exec('GetVariable', 'DIALSTATUS');
        $status = $agi->get_variable('DIALSTATUS');
        return $status ?: 'unknown';
    } catch (Exception $e) {
        agi_log("Could not get call status: " . $e->getMessage());
        return 'unknown';
    }
}

// Get hangup cause
function get_hangup_cause() {
    global $agi;

    try {
        $agi->exec('GetVariable', 'HANGUPCAUSE');
        $cause = $agi->get_variable('HANGUPCAUSE');
        return $cause ?: 'unknown';
    } catch (Exception $e) {
        agi_log("Could not get hangup cause: " . $e->getMessage());
        return 'unknown';
    }
}

// Main execution
try {
    // Initialize AGI
    $agi = new AGI();

    agi_log("Processing call hangup - Call ID: $call_id, State: $call_state");

    // Get call statistics
    $duration = get_call_duration();
    $dial_status = get_call_status();
    $hangup_cause = get_hangup_cause();

    // Determine final call outcome
    $outcome = 'unknown';
    $status = 'completed';

    switch ($dial_status) {
        case 'ANSWER':
            $outcome = 'answered';
            $status = 'completed';
            break;
        case 'NOANSWER':
            $outcome = 'no_answer';
            $status = 'failed';
            break;
        case 'BUSY':
            $outcome = 'busy';
            $status = 'failed';
            break;
        case 'CONGESTION':
            $outcome = 'congestion';
            $status = 'failed';
            break;
        case 'CHANUNAVAIL':
            $outcome = 'unavailable';
            $status = 'failed';
            break;
        default:
            $outcome = 'unknown';
            $status = 'failed';
    }

    // Map hangup causes to outcomes
    switch ($hangup_cause) {
        case '16': // Normal clearing
            $outcome = 'answered';
            $status = 'completed';
            break;
        case '17': // User busy
            $outcome = 'busy';
            $status = 'failed';
            break;
        case '19': // No answer
            $outcome = 'no_answer';
            $status = 'failed';
            break;
        case '21': // Call rejected
            $outcome = 'rejected';
            $status = 'failed';
            break;
    }

    agi_log("Call statistics - Duration: {$duration}s, Status: $dial_status, Cause: $hangup_cause, Outcome: $outcome");

    // Prepare call completion data
    $call_data = [
        'call_id' => $call_id,
        'status' => $status,
        'outcome' => $outcome,
        'duration' => $duration,
        'dial_status' => $dial_status,
        'hangup_cause' => $hangup_cause,
        'call_state' => $call_state,
        'timestamp' => date('c'),
        'end_reason' => 'hangup'
    ];

    // Notify server about call completion
    $response = make_api_request('/asterisk/call-completed', $call_data);

    if ($response && $response['success']) {
        agi_log("Call completion data sent successfully");
    } else {
        agi_log("Failed to send call completion data");
    }

    // Log final call event
    make_api_request('/asterisk/call-event', [
        'call_id' => $call_id,
        'event_type' => 'call_ended',
        'event_data' => $call_data,
        'timestamp' => date('c')
    ]);

    agi_log("Call hangup processing completed successfully");

} catch (Exception $e) {
    agi_log("Error in hangup AGI: " . $e->getMessage());

    // Try to notify server of error
    try {
        make_api_request('/asterisk/call-error', [
            'call_id' => $call_id,
            'error' => $e->getMessage(),
            'timestamp' => date('c')
        ]);
    } catch (Exception $notify_error) {
        agi_log("Failed to notify server of error: " . $notify_error->getMessage());
    }

    exit(1);
}
?>
