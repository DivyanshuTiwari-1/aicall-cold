<?php
/**
 * SIMPLIFIED AI Dialer AGI Script
 * 
 * Features:
 * - Script-based conversation flow
 * - Human-like voice (Piper TTS)
 * - Speech recognition (Vosk STT)
 * - Intelligent conversation management
 * - NO complex AI analysis, emotion tracking, warm transfers
 * 
 * Cost: ~$0.0045/minute (Telnyx SIP only)
 */

// AGI Environment Variables
$call_id = $argv[1] ?? '';
$contact_phone = $argv[2] ?? '';
$campaign_id = $argv[3] ?? '';

// Configuration
$api_base_url = getenv('AI_DIALER_URL') ?: 'http://ai_dialer:3000/api/v1';
$max_conversation_turns = 15;
$max_silence_attempts = 2;

// Logging
function agi_log($message) {
    error_log("[SIMPLIFIED-AGI] " . $message);
}

// Make API request
function make_api_request($endpoint, $data = []) {
    global $api_base_url;
    
    $ch = curl_init($api_base_url . $endpoint);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return ($http_code === 200) ? json_decode($response, true) : false;
}

// Get API request
function make_api_get($endpoint) {
    global $api_base_url;
    
    $ch = curl_init($api_base_url . $endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return ($http_code === 200) ? json_decode($response, true) : false;
}

// Play TTS using Piper (human-like voice)
function play_tts($text) {
    global $api_base_url;
    
    agi_log("TTS: " . substr($text, 0, 60) . "...");
    
    // Get audio from Piper TTS service
    $response = make_api_request('/asterisk/tts/generate', [
        'text' => $text,
        'voice' => 'amy',  // Human-like female voice
        'speed' => 1.0
    ]);
    
    if ($response && isset($response['audio_url'])) {
        $audio_url = $response['audio_url'];
        
        // Download and play
        $temp_file = '/tmp/tts_' . uniqid() . '.wav';
        file_put_contents($temp_file, file_get_contents($api_base_url . $audio_url));
        
        echo "STREAM FILE " . $temp_file . " \"\"\n";
        fgets(STDIN);
        
        unlink($temp_file);
        return true;
    }
    
    agi_log("ERROR: TTS failed");
    return false;
}

// Record customer response
function record_response($max_duration = 8) {
    $filename = '/tmp/response_' . uniqid() . '.wav';
    
    // Record with silence detection (3 seconds of silence ends recording)
    echo "RECORD FILE $filename wav \"\" $max_duration s=3\n";
    fgets(STDIN);
    
    return $filename;
}

// Transcribe speech using Vosk
function speech_to_text($audio_file) {
    global $api_base_url;
    
    if (!file_exists($audio_file) || filesize($audio_file) < 1000) {
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

// Intelligent conversation manager (simple but smart)
function process_conversation($call_id, $user_input, $turn) {
    $response = make_api_request('/conversation/simple-process', [
        'call_id' => $call_id,
        'user_input' => $user_input,
        'turn' => $turn
    ]);
    
    if ($response && $response['success']) {
        return [
            'ai_response' => $response['ai_response'] ?? '',
            'should_continue' => $response['should_continue'] ?? true,
            'action' => $response['action'] ?? 'continue'  // continue, end_call, schedule_callback
        ];
    }
    
    return [
        'ai_response' => "I'm sorry, could you repeat that?",
        'should_continue' => true,
        'action' => 'continue'
    ];
}

// Main execution
try {
    agi_log("=== STARTING SIMPLIFIED AUTOMATED CALL ===");
    agi_log("Call ID: $call_id | Phone: $contact_phone | Campaign: $campaign_id");
    
    // Notify server that call started
    make_api_request('/asterisk/call-started', [
        'call_id' => $call_id,
        'contact_phone' => $contact_phone,
        'campaign_id' => $campaign_id
    ]);
    
    // Get initial script from campaign
    $script = make_api_get("/scripts/conversation?call_id=$call_id&conversation_type=main_pitch");
    
    if (!$script || !$script['success']) {
        agi_log("ERROR: Failed to get script");
        play_tts("Hello, this is a call from our company. How are you today?");
    } else {
        $greeting = $script['main_script'] ?? $script['script_content'] ?? '';
        play_tts($greeting);
    }
    
    // Conversation loop
    $turn = 0;
    $silence_count = 0;
    $call_active = true;
    
    while ($call_active && $turn < $max_conversation_turns) {
        $turn++;
        agi_log("--- Turn $turn ---");
        
        // Wait a moment
        usleep(500000); // 0.5 seconds
        
        // Record customer response
        $audio_file = record_response(8);
        
        // Check if we got audio
        if (file_exists($audio_file) && filesize($audio_file) > 1000) {
            // Transcribe
            $customer_text = speech_to_text($audio_file);
            unlink($audio_file);
            
            if ($customer_text && strlen($customer_text) > 2) {
                $silence_count = 0; // Reset silence counter
                agi_log("Customer: " . substr($customer_text, 0, 100));
                
                // Process with intelligent conversation manager
                $response = process_conversation($call_id, $customer_text, $turn);
                
                // Play AI response
                if (!empty($response['ai_response'])) {
                    play_tts($response['ai_response']);
                }
                
                // Handle actions
                if (!$response['should_continue'] || $response['action'] === 'end_call') {
                    agi_log("Ending call - action: " . $response['action']);
                    play_tts("Thank you for your time. Have a great day!");
                    $call_active = false;
                } elseif ($response['action'] === 'schedule_callback') {
                    play_tts("Great! Someone from our team will call you back. Thank you!");
                    $call_active = false;
                }
                
            } else {
                // No speech detected
                $silence_count++;
                agi_log("No speech detected (attempt $silence_count/$max_silence_attempts)");
                
                if ($silence_count >= $max_silence_attempts) {
                    play_tts("I'm having trouble hearing you. We'll call back later. Goodbye!");
                    $call_active = false;
                } else {
                    play_tts("I didn't catch that. Could you please repeat?");
                }
            }
        } else {
            // No audio file or too small
            $silence_count++;
            agi_log("No audio recorded (attempt $silence_count/$max_silence_attempts)");
            
            if ($silence_count >= $max_silence_attempts) {
                play_tts("Thank you for your time. Goodbye!");
                $call_active = false;
            } else {
                play_tts("Hello? Are you still there?");
            }
            
            if (file_exists($audio_file)) unlink($audio_file);
        }
        
        // Small delay
        usleep(300000); // 0.3 seconds
    }
    
    // End of conversation
    if ($turn >= $max_conversation_turns) {
        agi_log("Maximum turns reached");
        play_tts("Thank you for your time. Someone will follow up with you. Goodbye!");
    }
    
    // Notify server
    make_api_request('/asterisk/call-ended', [
        'call_id' => $call_id,
        'reason' => 'conversation_complete',
        'turns' => $turn
    ]);
    
    agi_log("=== CALL COMPLETED ===");
    
} catch (Exception $e) {
    agi_log("ERROR: " . $e->getMessage());
    
    make_api_request('/asterisk/call-error', [
        'call_id' => $call_id,
        'error' => $e->getMessage()
    ]);
    
    exit(1);
}
?>




