<?php
/*
 |--------------------------------------------------------------------------
 | Small .env loader
 |--------------------------------------------------------------------------
 | The project does not use Composer, so we load .env manually.
 | Local Laragon: copy .env.example to .env and fill DB values.
 | Render: add the same keys in Render Environment Variables.
 */
if (!function_exists('project_env_load')) {
    function project_env_load(string $file): void {
        if (!is_file($file) || !is_readable($file)) {
            return;
        }
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || str_starts_with($line, ';')) {
                continue;
            }
            $pos = strpos($line, '=');
            if ($pos === false) {
                continue;
            }
            $key = trim(substr($line, 0, $pos));
            $value = trim(substr($line, $pos + 1));
            if ($key === '') {
                continue;
            }
            if ((str_starts_with($value, '"') && str_ends_with($value, '"')) || (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                $value = substr($value, 1, -1);
            }
            if (getenv($key) === false) {
                putenv($key . '=' . $value);
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }
}

project_env_load((defined('APP_ROOT') ? APP_ROOT : dirname(__DIR__, 2)) . '/.env');

class Database {
    private string $host;
    private string $db_name;
    private string $username;
    private string $password;
    private string $port;
    public ?PDO $conn = null;

    private function env(string $key, string $default = ''): string {
        $value = getenv($key);
        return $value === false ? $default : (string)$value;
    }

    public function getConnection(): PDO {
        if ($this->conn instanceof PDO) {
            return $this->conn;
        }

        $this->host = $this->env('DB_HOST', '127.0.0.1');
        $this->db_name = $this->env('DB_NAME', 'electronic_store');
        $this->username = $this->env('DB_USER', 'root');
        $this->password = $this->env('DB_PASS', '');
        $this->port = $this->env('DB_PORT', '3306');

        $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->db_name};charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4',
        ];

        // Aiven MySQL normally uses SSL. For Laragon local MySQL, leave these blank.
        $sslCa = $this->env('DB_SSL_CA', '');
        $sslCaContent = $this->env('DB_SSL_CA_CONTENT', '');
        if ($sslCaContent !== '') {
            $sslCa = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'aiven-ca.pem';
            file_put_contents($sslCa, str_replace('\\n', "\n", $sslCaContent));
        }
        if ($sslCa !== '') {
            if (!defined('PDO::MYSQL_ATTR_SSL_CA')) {
                throw new RuntimeException('Your PHP pdo_mysql extension does not support MYSQL_ATTR_SSL_CA. Use Laragon Full PHP/MySQL build or install pdo_mysql with SSL support.');
            }
            if (!is_file($sslCa)) {
                throw new RuntimeException('DB_SSL_CA file not found: ' . $sslCa);
            }
            $options[PDO::MYSQL_ATTR_SSL_CA] = $sslCa;
            if (defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
                $verify = strtolower($this->env('DB_SSL_VERIFY', 'true')) !== 'false';
                $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = $verify;
            }
        }

        try {
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
            return $this->conn;
        } catch (PDOException $exception) {
            $target = $this->host . ':' . $this->port . '/' . $this->db_name;
            throw new RuntimeException('Database connection failed for ' . $target . ': ' . $exception->getMessage());
        }
    }
}
