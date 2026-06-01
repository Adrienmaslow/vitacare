<?php
// backend/api/notifications.php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../middleware/auth.php';

setCorsHeaders();
$session = requireAuth();
$action = $_GET['action'] ?? 'list';
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($action) {
    case 'list':
        $stmt = getDB()->prepare("SELECT * FROM notifications WHERE utilisateur_id = ? ORDER BY date_creation DESC LIMIT 50");
        $stmt->execute([$session['user_id']]);
        jsonResponse($stmt->fetchAll());
        break;
    case 'count_unread':
        $stmt = getDB()->prepare("SELECT COUNT(*) as count FROM notifications WHERE utilisateur_id = ? AND est_lu = 0");
        $stmt->execute([$session['user_id']]);
        jsonResponse($stmt->fetch());
        break;
    case 'mark_read':
        if ($id) {
            getDB()->prepare("UPDATE notifications SET est_lu = 1 WHERE id = ? AND utilisateur_id = ?")->execute([$id, $session['user_id']]);
        } else {
            getDB()->prepare("UPDATE notifications SET est_lu = 1 WHERE utilisateur_id = ?")->execute([$session['user_id']]);
        }
        jsonResponse(['success' => true]);
        break;
    case 'delete':
        if ($id) getDB()->prepare("DELETE FROM notifications WHERE id = ? AND utilisateur_id = ?")->execute([$id, $session['user_id']]);
        jsonResponse(['success' => true]);
        break;
    default: jsonError('Action inconnue', 404);
}
