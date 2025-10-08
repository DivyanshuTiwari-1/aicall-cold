<?php
<?php
/**
 * AI Conversation AGI Script for Asterisk
 * Handles conversation flow and user responses
 */

// AGI variables
$call_id = $argv[1] ?? null;
$user_input = $argv[2] ?? null;
$conversation_state = $argv[3] ?? 'greeting';
$script_index = $argv[4] ?? 0;

if (!$call_id) {
    error_log("AI Conversation AGI: Missing call_id");
    exit(1);
}

// Configuration
$api_url = getenv('API_URL') ?: 'http://localhost:3000/api/v1';
$api_token = getenv('API_TOKEN') ?: '';

// Log conversation start
agi_log("AI Conversation AGI: Processing conversation for call $call_id, state: $conversation_state");

try {
    // Get call details
    $call_details = getCallDetails($call_id, $api_url, $api_token);
    if (!$call_details) {
        agi_log("AI Conversation AGI: Call details not found for $call_id");
        exit(1);
    }

    // Process conversation based on state
    switch ($conversation_state) {
        case 'greeting':
            await handleGreeting($call_id, $call_details, $api_url, $api_token);
            break;

        case 'script':
            await handleScript($call_id, $call_details, $script_index, $api_url, $api_token);
            break;

        case 'response':
            await handleResponse($call_id, $user_input, $call_details, $api_url, $api_token);
            break;

        case 'followup':
            await handleFollowup($call_id, $user_input, $call_details, $api_url, $api_token);
            break;

        case 'transfer':
            await handleTransfer($call_id, $call_details, $api_url, $api_token);
            break;

        default:
            agi_log("AI Conversation AGI: Unknown conversation state: $conversation_state");
            exit(1);
    }

} catch (Exception $e) {
    agi_log("AI Conversation AGI Error: " . $e->getMessage());
    exit(1);
}

/**
 * Handle greeting phase
 */
function handleGreeting($call_id, $call_details, $api_url, $api_token) {
    agi_log("AI Conversation AGI: Handling greeting for call $call_id");

    // Get greeting script
    $script = getScript($call_details['campaign_id'], 'greeting', $api_url, $api_token);
    if (!$script) {
        // Use default greeting
        $greeting_text = "Hello, this is " . ($call_details['contact_name'] ?? 'there') .
                        " calling from " . ($call_details['company'] ?? 'our company') .
                        ". I hope I'm not catching you at a bad time.";
    } else {
        $greeting_text = processScript($script['content'], [
            'contact_name' => $call_details['contact_name'] ?? 'there',
            'company' => $call_details['company'] ?? 'our company'
        ]);
    }

    // Generate and play TTS
    $audio_file = generateTTS($greeting_text, $call_id, 'en-US-Wavenet-D');
    if ($audio_file) {
        agi_exec("Playback", "custom/$audio_file");
    }

    // Update call state
    updateCallState($call_id, 'script', $api_url, $api_token);
}

/**
 * Handle script execution
 */
function handleScript($call_id, $call_details, $script_index, $api_url, $api_token) {
    agi_log("AI Conversation AGI: Handling script for call $call_id, index: $script_index");

    // Get script segments
    $scripts = getScripts($call_details['campaign_id'], 'main_pitch', $api_url, $api_token);
    if (!$scripts || !isset($scripts[$script_index])) {
        agi_log("AI Conversation AGI: No script found for index $script_index");
        return;
    }

    $script = $scripts[$script_index];
    $processed_script = processScript($script['content'], [
        'contact_name' => $call_details['contact_name'] ?? 'there',
        'company' => $call_details['company'] ?? 'our company'
    ]);

    // Generate and play TTS
    $audio_file = generateTTS($processed_script, $call_id, 'en-US-Wavenet-D');
    if ($audio_file) {
        agi_exec("Playback", "custom/$audio_file");
    }

    // Ask for response
    $response_prompt = "I'd love to hear your thoughts on this. Please press 1 if you're interested, 2 if you're not interested, or 0 to speak with a human representative.";
    $response_audio = generateTTS($response_prompt, $call_id, 'en-US-Wavenet-D');
    if ($response_audio) {
        agi_exec("Playback", "custom/$response_audio");
    }

    // Start recording for voice input
    $record_file = "call_{$call_id}_response_" . time();
    agi_exec("Record", "custom/$record_file:wav,30,#");

    // Update call state
    updateCallState($call_id, 'response', $api_url, $api_token);
}

/**
 * Handle user response
 */
function handleResponse($call_id, $user_input, $call_details, $api_url, $api_token) {
    agi_log("AI Conversation AGI: Handling response for call $call_id: $user_input");

    // Process the response
    $response_data = processUserResponse($user_input, $call_id, $api_url, $api_token);

    if ($response_data['action'] === 'positive') {
        // Handle positive response
        $followup_text = "That's wonderful! I'm excited to tell you more about how this can benefit your business. Let me transfer you to one of our specialists who can answer all your questions.";
        $followup_audio = generateTTS($followup_text, $call_id, 'en-US-Wavenet-D');
        if ($followup_audio) {
            agi_exec("Playback", "custom/$followup_audio");
        }

        updateCallState($call_id, 'transfer', $api_url, $api_token);

    } elseif ($response_data['action'] === 'negative') {
        // Handle negative response
        $decline_text = "I completely understand. Thank you for your time today. Have a wonderful day!";
        $decline_audio = generateTTS($decline_text, $call_id, 'en-US-Wavenet-D');
        if ($decline_audio) {
            agi_exec("Playback", "custom/$decline_audio");
        }

        updateCallState($call_id, 'hangup', $api_url, $api_token);

    } elseif ($response_data['action'] === 'transfer') {
        // Handle transfer request
        $transfer_text = "Of course! I'll connect you with one of our human representatives right away. Please hold on for just a moment.";
        $transfer_audio = generateTTS($transfer_text, $call_id, 'en-US-Wavenet-D');
        if ($transfer_audio) {
            agi_exec("Playback", "custom/$transfer_audio");
        }

        updateCallState($call_id, 'transfer', $api_url, $api_token);

    } else {
        // Handle unclear response
        $clarify_text = "I'm sorry, I didn't quite catch that. Could you please press 1 for yes, 2 for no, or 0 to speak with a human representative?";
        $clarify_audio = generateTTS($clarify_text, $call_id, 'en-US-Wavenet-D');
        if ($clarify_audio) {
            agi_exec("Playback", "custom/$clarify_audio");
        }

        // Record again
        $record_file = "call_{$call_id}_clarify_" . time();
        agi_exec("Record", "custom/$record_file:wav,15,#");
    }
}

/**
 * Handle follow-up conversation
 */
function handleFollowup($call_id, $user_input, $call_details, $api_url, $api_token) {
    agi_log("AI Conversation AGI: Handling follow-up for call $call_id");

    // Get follow-up script based on user response
    $followup_script = getScript($call_details['campaign_id'], 'followup', $api_url, $api_token);
    if ($followup_script) {
        $processed_script = processScript($followup_script['content'], [
            'contact_name' => $call_details['contact_name'] ?? 'there',
            'company' => $call_details['company'] ?? 'our company',
            'user_response' => $user_input
        ]);

        $audio_file = generateTTS($processed_script, $call_id, 'en-US-Wavenet-D');
        if ($audio_file) {
            agi_exec("Playback", "custom/$audio_file");
        }
    }

    // Ask for final response
    $final_prompt = "Does this sound like something that could work for you?";
    $final_audio = generateTTS($final_prompt, $call_id, 'en-US-Wavenet-D');
    if ($final_audio) {
        agi_exec("Playback", "custom/$final_audio");
    }
}

/**
 * Handle transfer
 */
function handleTransfer($call_id, $call_details, $api_url, $api_token) {
    agi_log("AI Conversation AGI: Handling transfer for call $call_id");

    // Get transfer number from campaign settings
    $transfer_number = getTransferNumber($call_details['campaign_id'], $api_url, $api_token);
    if ($transfer_number) {
        agi_exec("Dial", "PJSIP/$transfer_number@telnyx_endpoint,30");
    } else {
        // Fallback to voicemail
        $voicemail_text = "I'm sorry, but I'm unable to connect you with a representative at this time. Please leave a message and someone will get back to you shortly.";
        $voicemail_audio = generateTTS($voicemail_text, $call_id, 'en-US-Wavenet-D');
        if ($voicemail_audio) {
            agi_exec("Playback", "custom/$voicemail_audio");
        }

        $record_file = "voicemail_{$call_id}_" . time();
        agi_exec("Record", "custom/$record_file:wav,60,beep");
    }
}

/**
 * Process user response
 */
function processUserResponse($user_input, $call_id, $api_url, $api_token) {
    // Simple DTMF processing
    if (is_numeric($user_input)) {
        switch ($user_input) {
            case '1':
                return ['action' => 'positive', 'confidence' => 1.0];
            case '2':
                return ['action' => 'negative', 'confidence' => 1.0];
            case '0':
                return ['action' => 'transfer', 'confidence' => 1.0];
            default:
                return ['action' => 'unclear', 'confidence' => 0.0];
        }
    }

    // For voice input, we would typically send to STT service
    // For now, return unclear
    return ['action' => 'unclear', 'confidence' => 0.0];
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
 * Get multiple scripts
 */
function getScripts($campaign_id, $type, $api_url, $api_token) {
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
        return $data['scripts'] ?? [];
    }

    return [];
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
 * Generate TTS audio
 */
function generateTTS($text, $call_id, $voice = 'en-US-Wavenet-D') {
    $audio_file = "tts_{$call_id}_" . time() . ".wav";
    $audio_path = "/tmp/$audio_file";

    // Use espeak as fallback
    $command = "espeak -s 150 -v en-us \"$text\" -w \"$audio_path\" 2>/dev/null";
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
 * Update call state
 */
function updateCallState($call_id, $state, $api_url, $api_token) {
    $url = "$api_url/calls/$call_id/state";
    $data = ['state' => $state];
    $headers = [
        "Authorization: Bearer $api_token",
        "Content-Type: application/json"
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    curl_exec($ch);
    curl_close($ch);
}

/**
 * Get transfer number
 */
function getTransferNumber($campaign_id, $api_url, $api_token) {
    $url = "$api_url/campaigns/$campaign_id/transfer";
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
        return $data['transfer_number'] ?? null;
    }

    return null;
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
