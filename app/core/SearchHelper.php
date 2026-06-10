<?php
class SearchHelper {
    public static function normalize(string $value): string {
        $value = mb_strtolower(trim($value), 'UTF-8');
        $value = preg_replace('/\s+/u', ' ', $value);
        return $value ?? '';
    }

    public static function score(array $product, string $query): int {
        $query = self::normalize($query);
        if ($query === '') {
            return 50;
        }

        $name = self::normalize((string)($product['name'] ?? ''));
        $brand = self::normalize((string)($product['brand'] ?? ''));
        $category = self::normalize((string)($product['category_name'] ?? ''));
        $tokens = array_values(array_filter(explode(' ', $query)));

        if ($name === $query) return 0;
        if (str_starts_with($name, $query)) return 1;
        if ($brand === $query || str_starts_with($brand, $query)) return 2;
        if (preg_match('/(^|\s)' . preg_quote($query, '/') . '/u', $name)) return 3;

        $pos = -1;
        $allInOrder = true;
        foreach ($tokens as $token) {
            $next = mb_strpos($name, $token, max(0, $pos + 1), 'UTF-8');
            if ($next === false) {
                $allInOrder = false;
                break;
            }
            $pos = $next;
        }
        if ($allInOrder) return 4;
        if (mb_strpos($name, $query, 0, 'UTF-8') !== false) return 5;
        if (mb_strpos($brand, $query, 0, 'UTF-8') !== false) return 6;
        if (mb_strpos($category, $query, 0, 'UTF-8') !== false) return 7;

        $matches = 0;
        foreach ($tokens as $token) {
            if (mb_strpos($name . ' ' . $brand . ' ' . $category, $token, 0, 'UTF-8') !== false) {
                $matches++;
            }
        }
        return $matches > 0 ? 8 : 99;
    }

    public static function highlight(string $text, string $query): string {
        $safeText = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
        $query = trim($query);
        if ($query === '') {
            return $safeText;
        }

        $tokens = array_unique(array_filter(preg_split('/\s+/u', $query)));
        usort($tokens, fn($a, $b) => mb_strlen($b, 'UTF-8') <=> mb_strlen($a, 'UTF-8'));

        foreach ($tokens as $token) {
            $pattern = '/' . preg_quote(htmlspecialchars($token, ENT_QUOTES, 'UTF-8'), '/') . '/iu';
            $safeText = preg_replace($pattern, '<mark>$0</mark>', $safeText);
        }
        return $safeText ?? htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    }
}
