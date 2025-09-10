<?php
// ----------------------------------------------------
// KONFIGURATION
// ----------------------------------------------------
$TO_EMAIL   = 'office@huv-gmbh.de';   // получатель
$FROM_EMAIL = 'noreply@huv-gmbh.de';  // существующий ящик на вашем домене (Strato)

// Helper
function h($v) { return htmlspecialchars($v ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function wants_json(): bool {
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $xhr    = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
    return (stripos($accept, 'application/json') !== false) ||
            (stripos($xhr, 'fetch') !== false || stripos($xhr, 'xmlhttprequest') !== false);
}
function clean_header_value(string $s): string {
    // защита от header injection: убираем переводы строк
    $s = str_replace(["\r", "\n"], '', $s);
    return trim($s);
}

// ----------------------------------------------------
// METHOD CHECK
// ----------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo 'Method Not Allowed';
    exit;
}

// ----------------------------------------------------
// RATE LIMIT (простая защита: не чаще 1 запроса / 20 сек с одного IP)
// ----------------------------------------------------
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = sys_get_temp_dir() . '/contact_rl_' . preg_replace('/[^0-9a-f:\.]/i','', $ip);
$now = time();
$last = is_file($rlFile) ? (int)file_get_contents($rlFile) : 0;
if ($last && $now - $last < 20) {
    if (wants_json()) {
        http_response_code(429);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['ok' => false, 'error' => 'rate_limited']);
        exit;
    }
    http_response_code(429);
    echo '<!doctype html><meta charset="utf-8"><title>Zu viele Anfragen</title><p>Bitte versuchen Sie es später erneut.</p>';
    exit;
}
file_put_contents($rlFile, (string)$now, LOCK_EX);

// ----------------------------------------------------
// HONEYPOT
// ----------------------------------------------------
if (!empty($_POST['_gotcha'])) {
    // для ботов — делаем вид, что всё ок
    if (wants_json()) {
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['ok' => true]);
        exit;
    }
    http_response_code(200);
    echo 'OK';
    exit;
}

// ----------------------------------------------------
// VALIDATION + нормализация
// ----------------------------------------------------
$first = trim($_POST['first_name'] ?? '');
$last  = trim($_POST['last_name'] ?? '');
$email = trim($_POST['email'] ?? '');
$phone = trim($_POST['phone'] ?? '');
$msg   = trim($_POST['message'] ?? '');

// ограничения по длине (защита/аккуратность)
$first = mb_substr($first, 0, 100);
$last  = mb_substr($last,  0, 100);
$email = mb_substr($email, 0, 200);
$phone = mb_substr($phone, 0, 50);
$msg   = mb_substr($msg,   0, 5000);

$errors = [];
if ($first === '') $errors[] = 'Vorname ist erforderlich.';
if ($last  === '') $errors[] = 'Nachname ist erforderlich.';
if ($msg   === '') $errors[] = 'Nachricht ist erforderlich.';
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Gültige E-Mail ist erforderlich.';
}
// защита от header injection в Reply-To
if (preg_match('/[\r\n]/', $email)) {
    $errors[] = 'Ungültige E-Mail.';
} else {
    $email = clean_header_value($email);
}

if ($errors) {
    if (wants_json()) {
        http_response_code(400);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['ok' => false, 'error' => 'validation', 'messages' => $errors], JSON_UNESCAPED_UNICODE);
        exit;
    }
    http_response_code(400);
    echo '<!doctype html><meta charset="utf-8"><title>Fehler</title><p>'.h(implode(' ', $errors)).'</p><p><a href="/">Zurück</a></p>';
    exit;
}

// ----------------------------------------------------
// COMPOSE MAIL
// ----------------------------------------------------
$subject = 'Neue Kontaktanfrage — HUV GmbH';
$lines = [
    'Vorname: ' . $first,
    'Nachname: ' . $last,
    'E-Mail: ' . $email,
    'Telefon: ' . ($phone ?: '—'),
    '—',
    'Nachricht:',
    $msg,
    '—',
    'Zeit: ' . date('c'),
    'IP: ' . $ip,
];
$body = implode("\n", $lines);

$headers = [];
$headers[] = 'From: HUV GmbH <'.$FROM_EMAIL.'>';
$headers[] = 'Reply-To: '.$email;
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-Type: text/plain; charset=UTF-8';
$headersStr = implode("\r\n", $headers);

// Для Strato: envelope sender (улучшает доставляемость)
$params = '-f ' . escapeshellarg($FROM_EMAIL);

// ----------------------------------------------------
// SEND MAIL
// ----------------------------------------------------
$ok = @mail(
    $TO_EMAIL,
    '=?UTF-8?B?'.base64_encode($subject).'?=',
    $body,
    $headersStr,
    $params
);

// ----------------------------------------------------
// SAVE TO CSV (локальный бэкап заявок)
// ----------------------------------------------------
$csvFile = __DIR__ . '/contacts.csv';
if ($fh = @fopen($csvFile, 'a')) {
    if (@filesize($csvFile) === 0) {
        fputcsv($fh, ['Datum', 'Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Nachricht', 'IP'], ';');
    }
    fputcsv($fh, [date('c'), $first, $last, $email, $phone, $msg, $ip], ';');
    fclose($fh);
}

// ----------------------------------------------------
// RESPONSE
// ----------------------------------------------------
if (wants_json()) {
    header('Content-Type: application/json; charset=UTF-8');
    http_response_code($ok ? 200 : 500);
    echo json_encode(['ok' => (bool)$ok]);
    exit;
}

// HTML фолбэк (если отправка без JS)
if ($ok) {
    echo '<!doctype html><meta charset="utf-8"><title>Danke</title><p>Danke! Ihre Nachricht wurde gesendet.</p><p><a href="/">Zur Startseite</a></p>';
} else {
    http_response_code(500);
    echo '<!doctype html><meta charset="utf-8"><title>Fehler</title><p>Entschuldigung, die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.</p><p><a href="/">Zurück</a></p>';
}