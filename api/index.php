<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

function header_value(string $name): string
{
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return isset($_SERVER[$serverKey]) ? trim((string) $_SERVER[$serverKey]) : '';
}

function authorization_header(): string
{
    foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION'] as $serverKey) {
        if (!empty($_SERVER[$serverKey])) return trim((string) $_SERVER[$serverKey]);
    }
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp((string) $name, 'Authorization') === 0) return trim((string) $value);
        }
    }
    return '';
}

function normalize_text(string $value): string
{
    $value = trim($value);
    if (function_exists('mb_strtolower')) {
        $value = mb_strtolower($value, 'UTF-8');
    } else {
        $value = strtr($value, [
            'Α'=>'α','Β'=>'β','Γ'=>'γ','Δ'=>'δ','Ε'=>'ε','Ζ'=>'ζ','Η'=>'η','Θ'=>'θ','Ι'=>'ι','Κ'=>'κ','Λ'=>'λ','Μ'=>'μ',
            'Ν'=>'ν','Ξ'=>'ξ','Ο'=>'ο','Π'=>'π','Ρ'=>'ρ','Σ'=>'σ','Τ'=>'τ','Υ'=>'υ','Φ'=>'φ','Χ'=>'χ','Ψ'=>'ψ','Ω'=>'ω'
        ]);
        $value = strtolower($value);
    }

    $value = strtr($value, [
        'ά'=>'α','έ'=>'ε','ή'=>'η','ί'=>'ι','ϊ'=>'ι','ΐ'=>'ι','ό'=>'ο','ύ'=>'υ','ϋ'=>'υ','ΰ'=>'υ','ώ'=>'ω','ς'=>'σ',
        'τₒ'=>'το','τ₀'=>'τ0','₀'=>'0','₁'=>'1','₂'=>'2','₃'=>'3','₄'=>'4','₅'=>'5','₆'=>'6','₇'=>'7','₈'=>'8','₉'=>'9'
    ]);
    $value = str_replace(['×', '·', '–', '—'], ['x', ' ', '-', '-'], $value);
    $value = preg_replace('/[^\p{L}\p{N}=<>+\-\/\.]+/u', ' ', $value) ?? $value;
    return trim(preg_replace('/\s+/u', ' ', $value) ?? $value);
}

function tokens(string $value): array
{
    $parts = preg_split('/\s+/u', normalize_text($value), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $stop = ['σε','με','και','τη','την','της','το','τον','του','τα','των','ως','που','για','στο','στη','στην','ένα','μια','τι'];
    return array_values(array_unique(array_filter($parts, static fn(string $p): bool => strlen($p) >= 2 && !in_array($p, $stop, true))));
}

function load_video_links(string $path): array
{
    if (!is_file($path)) return [];
    $handle = fopen($path, 'rb');
    if ($handle === false) return [];
    $header = fgetcsv($handle);
    if (!is_array($header)) {
        fclose($handle);
        return [];
    }
    $header = array_map(static fn($value): string => ltrim((string) $value, "\xEF\xBB\xBF"), $header);
    $lessonIndex = array_search('lesson_id', $header, true);
    $urlIndex = array_search('video_base_url', $header, true);
    if ($lessonIndex === false || $urlIndex === false) {
        fclose($handle);
        return [];
    }
    $mapping = [];
    while (($row = fgetcsv($handle)) !== false) {
        $lessonId = trim((string) ($row[$lessonIndex] ?? ''));
        $url = trim((string) ($row[$urlIndex] ?? ''));
        if ($lessonId !== '' && $url !== '') $mapping[$lessonId] = preg_split('/[?&]t=/', $url, 2)[0];
    }
    fclose($handle);
    return $mapping;
}

function timestamp_url(string $baseUrl, int $seconds): string
{
    $separator = str_contains($baseUrl, '?') ? '&' : '?';
    return rtrim($baseUrl, '?&') . $separator . 't=' . $seconds;
}

function concept_lesson_boosts(string $query, array $conceptData): array
{
    $q = normalize_text($query);
    $queryTokens = tokens($q);
    $boosts = [];
    foreach ($conceptData['concepts'] ?? [] as $concept) {
        $conceptText = normalize_text(implode(' ', [
            (string) ($concept['concept'] ?? ''),
            (string) ($concept['description'] ?? ''),
            implode(' ', $concept['keywords'] ?? []),
        ]));
        $score = ($q !== '' && str_contains($conceptText, $q)) ? 30 : 0;
        foreach ($queryTokens as $token) {
            if (str_contains($conceptText, $token)) $score += 4;
        }
        if ($score < 8) continue;
        $score = min($score, 45);
        foreach ($concept['lesson_ids'] ?? [] as $lessonId) {
            $boosts[(string) $lessonId] = max($boosts[(string) $lessonId] ?? 0, $score);
        }
    }
    return $boosts;
}

function match_score(string $query, array $entry, string $lessonTitle, string $lessonId, int $lessonBoost): int
{
    $q = normalize_text($query);
    $fields = [
        normalize_text((string) ($entry['topic'] ?? '')),
        normalize_text((string) ($entry['description'] ?? '')),
        normalize_text($lessonTitle),
        normalize_text(implode(' ', $entry['keywords'] ?? [])),
    ];
    $haystack = implode(' ', $fields);
    $score = $lessonBoost;

    if ($q !== '' && str_contains($haystack, $q)) {
        $score += 120;
    }

    $queryTokens = tokens($q);
    foreach ($queryTokens as $token) {
        if (str_contains($fields[0], $token)) $score += 12;
        if (str_contains($fields[1], $token)) $score += 7;
        if (str_contains($fields[2], $token)) $score += 3;
        if (str_contains($fields[3], $token)) $score += 15;
    }

    if ((str_contains($q, 'k=f') || str_contains($q, 'κινητικ')) && str_contains($q, 'χρονο')) {
        if ($lessonId === '024' && (int) ($entry['seconds'] ?? -1) === 360) $score += 90;
    }
    if (str_contains($q, 'dk/dt') || (str_contains($q, 'ρυθμο') && str_contains($q, 'κινητικ'))) {
        if ($lessonId === '024' && (int) ($entry['seconds'] ?? -1) === 1215) $score += 80;
    }

    return $score;
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    respond(503, ['error' => 'not_configured', 'message' => 'The technician must create config.php from config.example.php.']);
}

$config = require $configPath;
if (!is_array($config) || empty($config['api_key']) || $config['api_key'] === 'REPLACE_WITH_A_LONG_RANDOM_SECRET') {
    respond(503, ['error' => 'not_configured', 'message' => 'A private API key has not been configured.']);
}

if (isset($_GET['health'])) {
    respond(200, ['status' => 'ok', 'service' => 'Malakasiotis course index', 'course_code' => $config['course_code']]);
}

$authorization = authorization_header();
$providedKey = '';
if (preg_match('/^Bearer\s+(.+)$/i', $authorization, $bearerMatch)) {
    $providedKey = trim((string) $bearerMatch[1]);
} elseif (isset($_GET['key'])) {
    $providedKey = trim((string) $_GET['key']);
}

if ($providedKey === '' || !hash_equals((string) $config['api_key'], $providedKey)) {
    header('WWW-Authenticate: Bearer error="invalid_token"');
    respond(401, ['error' => 'unauthorized', 'message' => 'A valid Bearer token or key parameter is required.']);
}

$dataPath = __DIR__ . '/data/lessons.json';
$raw = is_file($dataPath) ? file_get_contents($dataPath) : false;
$data = $raw !== false ? json_decode($raw, true) : null;
if (!is_array($data) || ($data['course_code'] ?? null) !== ($config['course_code'] ?? null)) {
    respond(500, ['error' => 'data_error', 'message' => 'Course index is missing or invalid.']);
}

$videoLinks = load_video_links(__DIR__ . '/data/video_links.csv');

// Action 1: List all available lessons with summary
if (isset($_GET['lessons']) || (isset($_GET['action']) && $_GET['action'] === 'lessons')) {
    $list = [];
    foreach ($data['lessons'] ?? [] as $l) {
        $lid = (string) ($l['lesson_id'] ?? '');
        $vurl = trim((string) ($videoLinks[$lid] ?? ($l['video_base_url'] ?? '')));
        $list[] = [
            'lesson_id' => $lid,
            'lesson_number' => $l['lesson_number'] ?? 0,
            'lesson' => $l['lesson'] ?? '',
            'title' => $l['title'] ?? '',
            'video_base_url' => $vurl,
            'total_entries' => count($l['entries'] ?? []),
        ];
    }
    respond(200, [
        'course_code' => $config['course_code'],
        'total_lessons' => count($list),
        'lessons' => $list
    ]);
}

// Action 2: Get specific lesson with all timestamps / entries
$targetLesson = isset($_GET['lesson']) ? trim((string) $_GET['lesson']) : (isset($_GET['lesson_id']) ? trim((string) $_GET['lesson_id']) : '');
if ($targetLesson === '' && isset($_GET['action']) && $_GET['action'] === 'lesson' && isset($_GET['id'])) {
    $targetLesson = trim((string) $_GET['id']);
}

if ($targetLesson !== '') {
    $targetNorm = ltrim($targetLesson, '0');
    $matchedLesson = null;
    foreach ($data['lessons'] ?? [] as $l) {
        $lid = (string) ($l['lesson_id'] ?? '');
        $lnum = (string) ($l['lesson_number'] ?? '');
        if ($lid === $targetLesson || str_pad($targetLesson, 3, '0', STR_PAD_LEFT) === $lid || $lnum === $targetLesson || $lnum === $targetNorm) {
            $matchedLesson = $l;
            break;
        }
    }
    if (!$matchedLesson) {
        respond(404, ['error' => 'not_found', 'message' => "Lesson '$targetLesson' not found."]);
    }
    $lid = (string) ($matchedLesson['lesson_id'] ?? '');
    $vurl = trim((string) ($videoLinks[$lid] ?? ($matchedLesson['video_base_url'] ?? '')));
    
    $entriesWithUrls = [];
    foreach ($matchedLesson['entries'] ?? [] as $entry) {
        $sec = (int) ($entry['seconds'] ?? 0);
        $entry['video_url'] = $vurl !== '' ? timestamp_url($vurl, $sec) : null;
        $entriesWithUrls[] = $entry;
    }

    respond(200, [
        'course_code' => $config['course_code'],
        'lesson_id' => $lid,
        'lesson_number' => $matchedLesson['lesson_number'] ?? 0,
        'lesson' => $matchedLesson['lesson'] ?? '',
        'title' => $matchedLesson['title'] ?? '',
        'video_base_url' => $vurl,
        'total_entries' => count($entriesWithUrls),
        'entries' => $entriesWithUrls
    ]);
}

$query = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
if ($query === '' || strlen($query) > 300) {
    respond(400, ['error' => 'invalid_query', 'message' => 'Parameter q is required (or specify ?lesson=ID or ?lessons) and must be at most 300 characters.']);
}

$conceptsPath = __DIR__ . '/data/concepts.json';
$conceptsRaw = is_file($conceptsPath) ? file_get_contents($conceptsPath) : false;
$conceptData = $conceptsRaw !== false ? json_decode($conceptsRaw, true) : [];
$lessonBoosts = is_array($conceptData) ? concept_lesson_boosts($query, $conceptData) : [];

$matches = [];
foreach ($data['lessons'] ?? [] as $lesson) {
    $lessonId = (string) ($lesson['lesson_id'] ?? '');
    $lessonBoost = (int) ($lessonBoosts[$lessonId] ?? 0);
    foreach ($lesson['entries'] ?? [] as $entry) {
        $score = match_score($query, $entry, (string) ($lesson['title'] ?? ''), $lessonId, $lessonBoost);
        if ($score <= 0) continue;
        $seconds = (int) ($entry['seconds'] ?? 0);
        $videoBaseUrl = trim((string) ($videoLinks[$lessonId] ?? ($lesson['video_base_url'] ?? '')));
        $videoUrl = $videoBaseUrl !== '' ? timestamp_url($videoBaseUrl, $seconds) : null;
        $matches[] = [
            'score' => $score,
            'course_code' => $config['course_code'],
            'lesson' => $lesson['lesson'],
            'lesson_number' => $lesson['lesson_number'],
            'lesson_title' => $lesson['title'],
            'topic' => $entry['topic'],
            'timestamp' => $entry['timestamp'],
            'seconds' => $seconds,
            'video_available' => $videoUrl !== null,
            'video_url' => $videoUrl,
            'course_url' => 'https://eclass.nimalakasiotis.gr/courses/COURSES113/',
            'description' => $entry['description'],
        ];
    }
}

usort($matches, static function (array $a, array $b): int {
    return $b['score'] <=> $a['score'] ?: $a['seconds'] <=> $b['seconds'];
});

// Επιστρέφουμε έως 6 χρήσιμες παραπομπές. Πρώτα κρατάμε το ισχυρότερο
// αποτέλεσμα από κάθε διαφορετικό μάθημα και έπειτα, αν περισσεύουν θέσεις,
// συμπληρώνουμε με επιπλέον χρονοετικέτες από την αρχική κατάταξη.
$rankedMatches = $matches;
$selectedMatches = [];
$selectedIndexes = [];
$seenLessons = [];

foreach ($rankedMatches as $index => $match) {
    $lessonKey = (string) ($match['lesson'] ?? '');
    if ($lessonKey === '' || isset($seenLessons[$lessonKey])) continue;
    $selectedMatches[] = $match;
    $selectedIndexes[$index] = true;
    $seenLessons[$lessonKey] = true;
    if (count($selectedMatches) >= 6) break;
}

if (count($selectedMatches) < 6) {
    foreach ($rankedMatches as $index => $match) {
        if (isset($selectedIndexes[$index])) continue;
        $selectedMatches[] = $match;
        if (count($selectedMatches) >= 6) break;
    }
}

$matches = $selectedMatches;

respond(200, [
    'query' => $query,
    'course_code' => $config['course_code'],
    'found' => count($matches) > 0,
    'confidence' => count($matches) === 0 ? 'none' : (($matches[0]['score'] >= 80) ? 'high' : 'candidate'),
    'results' => $matches,
]);
