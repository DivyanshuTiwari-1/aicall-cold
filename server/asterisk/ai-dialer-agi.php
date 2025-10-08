<?php
<?php
/**
 * AI Dialer AGI Script for Asterisk
 * Handles call flow and TTS integration
 */

// AGI variables
$call_id = $argv[1] ?? null;
$contact_phone = $argv[2] ?? null;

if (!$call_id || !$contact_phone) {
    error_log("AI Dialer AGI: Missing call_id or contact_phone");
    exit(1);
}

// Configuration
$api_url = getenv('API_URL') ?: 'http://localhost:3000/api/v1';
$api_token = getenv('API_TOKEN') ?: '';

// Log call start
agi_log("AI Dialer AGI: Starting call $call_id to $contact_phone");

try {
    // Get call details from API
    $call_details = getCallDetails($call_id, $api_url, $api_token);
    if (!$call_details) {
        agi_log("AI Dialer AGI: Call details not found for $call_id");
        exit(1);
    }

    // Get script for the campaign
    $script = getScript($call_details['campaign_id'], 'main_pitch', $api_url, $api_token);
    if (!$script) {
        agi_log("AI Dialer AGI: No script found for campaign {$call_details['campaign_id']}");
        // Play fallback message
        agi_exec("Playback", "ai-dialer/no-script");
        exit(0);
    }

    // Process script with variables
    $processed_script = processScript($script['content'], [
        'contact_name' => $call_details['contact_name'] ?? 'there',
        'company' => $call_details['company'] ?? 'our company'
    ]);

    // Generate TTS audio
    $audio_file = generateTTS($processed_script, $call_id);
    if (!$audio_file) {
        agi_log("AI Dialer AGI: Failed to generate TTS audio");
        exit(1);
    }

    // Play the script
    agi_exec("Playback", "custom/$audio_file");

    // Ask for response
    agi_exec("Playback", "ai-dialer/response-prompt");

    // Start recording for voice input
    $record_file = "call_{$call_id}_" . time();
    agi_exec("Record", "custom/$record_file:wav,30,#");

    // Process the response
    processResponse($call_id, $record_file, $api_url, $api_token);

    // Clean up
    unlink("/tmp/$audio_file");
    unlink("/tmp/$record_file.wav");

} catch (Exception $e) {
    agi_log("AI Dialer AGI Error: " . $e->getMessage());
    exit(1);
}

/**
 * Get call details from API
 */
function getCallDetails($call_id, $api_url, $api_token) {
    $url = "$api_url/calls/$call_id";
    $headers = [
        "Authorization: Bearer $api_token",
        "Content-Type: application/json"
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code === 200) {
        $data = json_decode($response, true);
        return $data['call'] ?? null;
    }

    return null;
}

/**
 * Get script from API
 */
function getScript($campaign_id, $type, $api_url, $api_token) {
    $url = "$api_url/scripts?campaign_id=$campaign_id&type=$type";
    $headers = [
        "Authorization: Bearer $api_token",
        "Content-Type: application/json"
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code === 200) {
        $data = json_decode($response, true);
        return $data['scripts'][0] ?? null;
    }

    return null;
}

/**
 * Process script with variables
 */
function processScript($script, $variables) {
    foreach ($variables as $key => $value) {
        $script = str_replace("{" . $key . "}", $value, $script);
    }
    return $script;
}

/**
 * Generate TTS audio using espeak
 */
function generateTTS($text, $call_id) {
    $audio_file = "tts_{$call_id}_" . time() . ".wav";
    $audio_path = "/tmp/$audio_file";

    // Use espeak for TTS
    $command = "espeak -s 150 -v en-us -a 90 \"$text\" -w \"$audio_path\" 2>/dev/null";
    exec($command, $output, $return_code);

    if ($return_code === 0 && file_exists($audio_path)) {
        // Copy to Asterisk sounds directory
        $asterisk_path = "/var/lib/asterisk/sounds/custom/$audio_file";
        copy($audio_path, $asterisk_path);
        return $audio_file;
    }

    return null;
}

/**
 * Process user response
 */
function processResponse($call_id, $record_file, $api_url, $api_token) {
    // For now, just log the response
    agi_log("AI Dialer AGI: User response recorded in $record_file");

    // In a real implementation, you would:
    // 1. Send the audio to a speech-to-text service
    // 2. Process the text with AI
    // 3. Generate appropriate response
    // 4. Update call status in database
}

/**
 * AGI logging function
 */
function agi_log($message) {
    error_log($message);
}

/**
 * AGI exec function
 */
function agi_exec($application, $data) {
    echo "EXEC $application $data\n";
    fflush(STDOUT);
}

?>
