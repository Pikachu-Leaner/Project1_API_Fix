<?php
class Response {
    public static function json(array $payload, int $status = 200): void {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function ok(array $data = [], int $status = 200): void {
        self::json(['success' => true, 'data' => $data], $status);
    }

    public static function error(string $message, int $status = 400, array $details = []): void {
        self::json([
            'success' => false,
            'message' => $message,
            'details' => $details,
        ], $status);
    }
}
