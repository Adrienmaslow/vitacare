<?php
// backend/middleware/auth.php
require_once __DIR__ . '/../config/cors.php';

function startSession() {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 86400,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
        session_start();
    }
}

function requireAuth() {
    startSession();
    if (empty($_SESSION['user_id'])) {
        jsonError('Non authentifié', 401);
    }
    return $_SESSION;
}

function requireRole($role) {
    $session = requireAuth();
    $roles = is_array($role) ? $role : [$role];
    if (!in_array($session['role'], $roles)) {
        jsonError('Accès refusé', 403);
    }
    return $session;
}

function getCurrentUser() {
    startSession();
    return $_SESSION['user_id'] ?? null;
}
