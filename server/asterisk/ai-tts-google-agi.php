<?php
<?php
/**
 * Google TTS AGI Script for Asterisk
 * Generates high-quality TTS audio using Google Cloud Text-to-Speech
 */

// AGI variables
$text = $argv[1] ?? null;
$voice = $argv[2] ?? 'en-US-Wavenet-D';
$output_file = $argv[3] ?? null;

if (!$text || !$output_file) {
    error_log("Google TTS AGI: Missing text or output file");
    exit(1);
}

// Configuration
$api_key = getenv('GOOGLE_TTS_API_KEY');
if (!$api_key) {
    error_log("Google TTS AGI: GOOGLE_TTS_API_KEY not configured");
    exit(1);
}

$api_url = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' . $api_key;

// Voice configurations
$voices = [
    'en-US-Wavenet-A' => ['gender' => 'MALE', 'language' => 'en-US'],
    'en-US-Wavenet-B' => ['gender' => 'MALE', 'language' => 'en-US'],
    'en-US-Wavenet-C' => ['gender' => 'FEMALE', 'language' => 'en-US'],
    'en-US-Wavenet-D' => ['gender' => 'MALE', 'language' => 'en-US'],
    'en-US-Wavenet-E' => ['gender' => 'FEMALE', 'language' => 'en-US'],
    'en-US-Wavenet-F' => ['gender' => 'FEMALE', 'language' => 'en-US'],
    'en-US-Standard-A' => ['gender' => 'MALE', 'language' => 'en-US'],
    'en-US-Standard-B' => ['gender' => 'MALE', 'language' => 'en-US'],
    'en-US-Standard-C' => ['gender' => 'FEMALE', 'language' => 'en-US'],
    'en-US-Standard-D' => ['gender' => 'MALE', 'language' => 'en-US'],
    'en-US-Standard-E' => ['gender' => 'FEMALE', 'language' => 'en-US'],
    'en-US-Standard-F' => ['gender' => 'FEMALE', 'language' => 'en-US']
];

$voice_config = $voices[$voice] ?? $voices['en-US-Wavenet-D'];

try {
    // Prepare request data
    $request_data = [
        'input' => ['text' => $text],
        'voice' => [
            'languageCode' => $voice_config['language'],
            'name' => $voice,
            'ssmlGender' => $voice_config['gender']
        ],
        'audioConfig' => [
            'audioEncoding' => 'LINEAR16',
            'sampleRateHertz' => 16000,
            'speakingRate' => 1.0,
            'pitch' => 0.0,
            'volumeGainDb' => 0.0
        ]
    ];

    // Make API request
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $api_url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($request_data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen(json_encode($request_data))
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        error_log("Google TTS AGI: cURL error: $error");
        exit(1);
    }

    if ($http_code !== 200) {
        error_log("Google TTS AGI: HTTP error $http_code: $response");
        exit(1);
    }

    $data = json_decode($response, true);
    if (!isset($data['audioContent'])) {
        error_log("Google TTS AGI: No audio content in response");
        exit(1);
    }

    // Decode and save audio
    $audio_content = base64_decode($data['audioContent']);
    if (file_put_contents($output_file, $audio_content) === false) {
        error_log("Google TTS AGI: Failed to write audio file");
        exit(1);
    }

    // Copy to Asterisk sounds directory
    $asterisk_path = "/var/lib/asterisk/sounds/custom/" . basename($output_file);
    if (copy($output_file, $asterisk_path)) {
        agi_log("Google TTS AGI: Generated audio for voice $voice");
        echo "EXEC Set TTS_FILE=" . basename($output_file) . "\n";
        fflush(STDOUT);
    } else {
        error_log("Google TTS AGI: Failed to copy to Asterisk sounds directory");
        exit(1);
    }

} catch (Exception $e) {
    error_log("Google TTS AGI Error: " . $e->getMessage());
    exit(1);
}

/**
 * AGI logging function
 */
function agi_log($message) {
    error_log($message);
}

?>
