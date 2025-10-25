<?php
/**
 * AI Dialer AGI Script - Simple Version (No PHP-AGI dependency)
 *
 * This script handles the main conversation flow during AI dialer calls.
 * It communicates with the Node.js server to get scripts, process responses,
 * and manage the conversation state.
 */

// AGI Environment Variables
$call_id = $argv[1] ?? '';
$contact_phone = $argv[2] ?? '';
$campaign_id = $argv[3] ?? '';

// Configuration
$api_base_url = getenv('AI_DIALER_URL') ?: 'http://ai_dialer:3000/api/v1';
$max_conversation_turns = 20;

// Logging function
function agi_log($message) {
    error_log("[AI-DIALER-AGI] " . $message);
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
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);

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

// Make GET API request to Node.js server
function make_api_get($endpoint) {
    global $api_base_url;

    $url = $api_base_url . $endpoint;
    $ch = curl_init();

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPGET, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);

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

// Get TTS audio for text
function get_tts_audio($text, $voice = 'en-us') {
    global $api_base_url;

    $data = [
        'text' => $text,
        'voice' => $voice,
        'speed' => 1.0
    ];

    $response = make_api_request('/asterisk/tts/generate', $data);

    if ($response && isset($response['audio_url'])) {
        return $response['audio_url'];
    }

    return false;
}

// Play TTS audio using API service
function play_tts($text, $voice = 'female') {
    global $api_base_url;

    agi_log("Requesting TTS for: " . substr($text, 0, 50) . "...");

    // Call the TTS API
    $tts_response = make_api_request('/asterisk/tts/generate', [
        'text' => $text,
        'voice' => $voice,
        'speed' => 1.0
    ]);

    if ($tts_response && isset($tts_response['audio_url'])) {
        $audio_url = $tts_response['audio_url'];
        agi_log("Got TTS audio URL: " . $audio_url);

        // Download audio file
        $temp_file = '/tmp/tts_' . uniqid() . '.wav';
        $audio_content = file_get_contents($audio_url);

        if ($audio_content) {
            file_put_contents($temp_file, $audio_content);

            // Play via Asterisk AGI
            echo "STREAM FILE " . $temp_file . " \"\"\n";
            $result = fgets(STDIN);

            // Clean up
            unlink($temp_file);
            return true;
        }
    }

    // Fallback to local espeak if API fails
    agi_log("TTS API failed, using local espeak fallback");
    $temp_file = '/var/lib/asterisk/sounds/custom/tts_' . uniqid() . '.wav';
    $command = "espeak -s 150 -v en-us \"$text\" -w $temp_file 2>&1";
    exec($command, $output, $return_code);

    if (file_exists($temp_file) && filesize($temp_file) > 0) {
        echo "STREAM FILE custom/" . basename($temp_file, '.wav') . " \"\"\n";
        $result = fgets(STDIN);
        unlink($temp_file);
        return true;
    }

    agi_log("ERROR: TTS completely failed");
    return false;
}

// Record caller response
function record_response($max_duration = 10) {
    $filename = '/tmp/response_' . uniqid() . '.wav';

    // Use AGI command to record
    echo "RECORD FILE $filename wav \"\" $max_duration\n";
    echo "WAIT FOR DIGIT 0\n";

    return $filename;
}

// Convert speech to text
function speech_to_text($audio_file) {
    global $api_base_url;

    if (!file_exists($audio_file)) {
        return false;
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $api_base_url . '/asterisk/speech/transcribe');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, [
        'audio' => new CURLFile($audio_file, 'audio/wav', 'audio.wav')
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code === 200) {
        $result = json_decode($response, true);
        return $result['text'] ?? false;
    }

    return false;
}

// Main execution
try {
    agi_log("Starting AI call - Call ID: $call_id, Phone: $contact_phone, Campaign: $campaign_id");

    // Notify server that call has started
    make_api_request('/asterisk/call-started', [
        'call_id' => $call_id,
        'contact_phone' => $contact_phone,
        'campaign_id' => $campaign_id,
        'timestamp' => date('c')
    ]);

    // Get initial script for the campaign
    agi_log("Fetching script for call_id: $call_id, campaign_id: $campaign_id");
    $script_response = make_api_get('/scripts/conversation?call_id=' . urlencode($call_id) . '&conversation_type=main_pitch');

    if (!$script_response || !isset($script_response['success']) || !$script_response['success']) {
        agi_log("Failed to get initial script - using fallback");
        $initial_text = 'Hello, this is an AI assistant calling on behalf of our company. How are you today?';
    } else {
        // Extract the script content from the response
        $initial_text = $script_response['main_script'] ?? $script_response['script_content'] ?? 'Hello, this is an AI assistant calling on behalf of our company.';
        agi_log("Successfully retrieved script from API");

        // Log contact info if available
        if (isset($script_response['contact'])) {
            $contact = $script_response['contact'];
            agi_log("Contact: " . ($contact['first_name'] ?? '') . " " . ($contact['last_name'] ?? '') . " from " . ($contact['company'] ?? 'Unknown'));
        }
    }

    // Play initial greeting/script
    agi_log("Playing initial script: " . substr($initial_text, 0, 100) . "...");
    agi_log("Script length: " . strlen($initial_text) . " characters");

    // Log the conversation start
    make_api_request('/asterisk/call-event', [
        'call_id' => $call_id,
        'event_type' => 'ai_conversation',
        'event_data' => [
            'ai_response' => $initial_text,
            'type' => 'greeting',
            'timestamp' => date('c')
        ],
        'timestamp' => date('c')
    ]);

    play_tts($initial_text);

    // Main conversation loop
    $conversation_turn = 0;
    $call_active = true;
    $consecutive_failures = 0;
    $max_consecutive_failures = 3;

    while ($call_active && $conversation_turn < $max_conversation_turns) {
        $conversation_turn++;
        agi_log("Conversation turn: $conversation_turn");

        // Wait for caller response
        sleep(2);

        // Record caller response
        $response_file = record_response(10);

        if (file_exists($response_file) && filesize($response_file) > 1000) {
            // Convert speech to text
            $caller_text = speech_to_text($response_file);
            unlink($response_file);

            if ($caller_text) {
                agi_log("Caller said: " . substr($caller_text, 0, 100) . "...");

                // Log the user input first
                make_api_request('/asterisk/call-event', [
                    'call_id' => $call_id,
                    'event_type' => 'ai_conversation',
                    'event_data' => [
                        'user_input' => $caller_text,
                        'turn' => $conversation_turn,
                        'timestamp' => date('c')
                    ],
                    'timestamp' => date('c')
                ]);

                // Process conversation with AI
                $conversation_response = make_api_request('/conversation/process', [
                    'call_id' => $call_id,
                    'user_input' => $caller_text,
                    'context' => [
                        'turn' => $conversation_turn,
                        'campaign_id' => $campaign_id
                    ]
                ]);

                if ($conversation_response && $conversation_response['success']) {
                    $ai_response = $conversation_response['answer'] ?? $conversation_response['ai_response'] ?? '';
                    $confidence = $conversation_response['confidence'] ?? 0;
                    $should_fallback = $conversation_response['should_fallback'] ?? false;

                    agi_log("AI Response (confidence: $confidence): " . substr($ai_response, 0, 100) . "...");

                    // Reset failure counter on successful response
                    $consecutive_failures = 0;

                    // Play AI response
                    if (!empty($ai_response)) {
                        play_tts($ai_response);
                    }

                    // Check if we should end the call
                    if ($should_fallback || $confidence < 0.3) {
                        agi_log("Low confidence or fallback requested, ending call");
                        $call_active = false;
                    }

                    // Check for closing indicators
                    if (isset($conversation_response['suggested_actions'])) {
                        $actions = $conversation_response['suggested_actions'];
                        if (in_array('schedule_meeting', $actions) || in_array('end_call', $actions) || in_array('added_to_dnc', $actions)) {
                            agi_log("Call completion suggested by AI - actions: " . implode(', ', $actions));
                            $call_active = false;
                        }
                    }
                } else {
                    agi_log("Failed to process conversation - response: " . json_encode($conversation_response));
                    $consecutive_failures++;

                    // Check if we've hit max consecutive failures
                    if ($consecutive_failures >= $max_consecutive_failures) {
                        agi_log("ERROR: Max consecutive failures ($max_consecutive_failures) reached, ending call");
                        play_tts("I apologize, but I'm experiencing technical difficulties. Please try calling back later.");
                        $call_active = false;
                    } else {
                        $fallback_response = "I'm sorry, I didn't catch that. Could you please repeat?";
                        play_tts($fallback_response);

                        // Log the fallback response
                        make_api_request('/asterisk/call-event', [
                            'call_id' => $call_id,
                            'event_type' => 'ai_conversation',
                            'event_data' => [
                                'ai_response' => $fallback_response,
                                'type' => 'fallback',
                                'turn' => $conversation_turn,
                                'consecutive_failures' => $consecutive_failures,
                                'timestamp' => date('c')
                            ],
                            'timestamp' => date('c')
                        ]);
                    }
                }
            } else {
                agi_log("No speech detected or transcription failed");
                $no_input_response = "I'm sorry, I didn't hear anything. Could you please speak up?";
                play_tts($no_input_response);

                // Log no input event
                make_api_request('/asterisk/call-event', [
                    'call_id' => $call_id,
                    'event_type' => 'ai_conversation',
                    'event_data' => [
                        'ai_response' => $no_input_response,
                        'type' => 'no_input',
                        'turn' => $conversation_turn,
                        'timestamp' => date('c')
                    ],
                    'timestamp' => date('c')
                ]);
            }
        } else {
            agi_log("No response recorded or file too small");
            play_tts("I'm sorry, I didn't hear anything. Could you please speak up?");
        }

        // Small delay between turns
        usleep(500000); // 0.5 seconds
    }

    // End of conversation
    if ($conversation_turn >= $max_conversation_turns) {
        agi_log("Maximum conversation turns reached");
        play_tts("Thank you for your time. Have a great day!");
    }

    // Notify server that call is ending
    make_api_request('/asterisk/call-ended', [
        'call_id' => $call_id,
        'reason' => 'conversation_complete',
        'turns' => $conversation_turn,
        'timestamp' => date('c')
    ]);

    agi_log("AI call completed successfully");

} catch (Exception $e) {
    agi_log("Error in AI dialer AGI: " . $e->getMessage());

    // Notify server of error
    make_api_request('/asterisk/call-error', [
        'call_id' => $call_id,
        'error' => $e->getMessage(),
        'timestamp' => date('c')
    ]);

    exit(1);
}
?>
