<?php
/**
 * AI Inbound AGI Script - Inbound Call Handler
 *
 * This script handles incoming calls to the AI dialer system.
 * It can route calls to appropriate handlers or provide basic responses.
 */

// AGI Environment Variables
$caller_id = $argv[1] ?? '';
$caller_name = $argv[2] ?? '';

// Configuration
$api_base_url = getenv('AI_DIALER_URL') ?: 'http://localhost:3000/api/v1';

// Logging function
function agi_log($message) {
    error_log("[AI-INBOUND-AGI] " . $message);
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

// Get TTS audio for text
function get_tts_audio($text, $voice = 'en-us') {
    global $api_base_url;

    $data = [
        'text' => $text,
        'voice' => $voice,
        'speed' => 1.0
    ];

    $response = make_api_request('/tts/generate', $data);

    if ($response && isset($response['audio_url'])) {
        return $response['audio_url'];
    }

    return false;
}

// Play TTS audio
function play_tts($text, $voice = 'en-us') {
    global $agi;

    $audio_url = get_tts_audio($text, $voice);

    if ($audio_url) {
        // Download and play the audio file
        $temp_file = '/tmp/inbound_tts_' . uniqid() . '.wav';
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $audio_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $audio_data = curl_exec($ch);
        curl_close($ch);

        if ($audio_data) {
            file_put_contents($temp_file, $audio_data);
            $agi->exec('Playback', $temp_file);
            unlink($temp_file);
            return true;
        }
    }

    // Fallback to espeak
    $agi->exec('System', "espeak -s 150 -v $voice \"$text\" -w /tmp/inbound_fallback.wav");
    $agi->exec('Playback', '/tmp/inbound_fallback');
    return true;
}

// Record caller response
function record_response($max_duration = 10) {
    global $agi;

    $filename = '/tmp/inbound_response_' . uniqid() . '.wav';
    $agi->exec('Record', "$filename wav # $max_duration");

    return $filename;
}

// Convert speech to text
function speech_to_text($audio_file) {
    global $api_base_url;

    if (!file_exists($audio_file)) {
        return false;
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $api_base_url . '/speech/transcribe');
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
    // Initialize AGI
    $agi = new AGI();

    agi_log("Incoming call - Caller ID: $caller_id, Name: $caller_name");

    // Notify server about incoming call
    $inbound_data = [
        'caller_id' => $caller_id,
        'caller_name' => $caller_name,
        'timestamp' => date('c'),
        'call_type' => 'inbound'
    ];

    make_api_request('/asterisk/inbound-call', $inbound_data);

    // Play welcome message
    $welcome_message = "Thank you for calling. This is an AI assistant. How can I help you today?";
    agi_log("Playing welcome message");
    play_tts($welcome_message);

    // Simple conversation loop for inbound calls
    $max_turns = 10;
    $conversation_turn = 0;

    while ($conversation_turn < $max_turns) {
        $conversation_turn++;
        agi_log("Inbound conversation turn: $conversation_turn");

        // Wait for caller response
        $agi->exec('WaitForSilence', "1000 2000");

        // Record caller response
        $response_file = record_response(15);

        if (file_exists($response_file) && filesize($response_file) > 1000) {
            // Convert speech to text
            $caller_text = speech_to_text($response_file);
            unlink($response_file);

            if ($caller_text) {
                agi_log("Caller said: " . substr($caller_text, 0, 100) . "...");

                // Process with general knowledge base
                $response = make_api_request('/knowledge/query', [
                    'question' => $caller_text,
                    'context' => [
                        'caller_id' => $caller_id,
                        'caller_name' => $caller_name,
                        'call_type' => 'inbound'
                    ]
                ]);

                if ($response && $response['success']) {
                    $ai_response = $response['answer'];
                    $confidence = $response['confidence'] ?? 0;

                    agi_log("AI Response (confidence: $confidence): " . substr($ai_response, 0, 100) . "...");

                    // Play AI response
                    play_tts($ai_response);

                    // Check if caller wants to end the call
                    $end_phrases = ['thank you', 'goodbye', 'bye', 'that\'s all', 'nothing else'];
                    $caller_lower = strtolower($caller_text);

                    if (in_array($caller_lower, $end_phrases) || strpos($caller_lower, 'thank you') !== false) {
                        agi_log("Caller indicated end of conversation");
                        break;
                    }
                } else {
                    agi_log("Failed to process caller question");
                    play_tts("I'm sorry, I didn't understand that. Could you please rephrase your question?");
                }
            } else {
                agi_log("No speech detected or transcription failed");
                play_tts("I'm sorry, I didn't hear anything. Could you please speak up?");
            }
        } else {
            agi_log("No response recorded or file too small");
            play_tts("I'm sorry, I didn't hear anything. Could you please speak up?");
        }

        // Small delay between turns
        usleep(500000); // 0.5 seconds
    }

    // End of conversation
    if ($conversation_turn >= $max_turns) {
        agi_log("Maximum conversation turns reached for inbound call");
    }

    // Play closing message
    play_tts("Thank you for calling. Have a great day!");

    // Notify server that inbound call is ending
    make_api_request('/asterisk/inbound-call-ended', [
        'caller_id' => $caller_id,
        'caller_name' => $caller_name,
        'turns' => $conversation_turn,
        'timestamp' => date('c')
    ]);

    agi_log("Inbound call completed successfully");

} catch (Exception $e) {
    agi_log("Error in inbound AGI: " . $e->getMessage());

    // Notify server of error
    make_api_request('/asterisk/inbound-call-error', [
        'caller_id' => $caller_id,
        'caller_name' => $caller_name,
        'error' => $e->getMessage(),
        'timestamp' => date('c')
    ]);

    $agi->exec('Playback', 'ai-dialer/error');
    exit(1);
}
?>
