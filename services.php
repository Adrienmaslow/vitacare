<?php
// backend/api/services.php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../middleware/auth.php';

setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($action) {
    case 'list': handleList(); break;
    case 'detail': handleDetail($id); break;
    case 'create': requireRole(['praticien', 'admin']); handleCreate(); break;
    case 'update': requireRole(['praticien', 'admin']); handleUpdate($id); break;
    case 'delete': requireRole(['praticien', 'admin']); handleDelete($id); break;
    case 'creneaux': handleCreneaux($id); break;
    default: jsonError('Action inconnue', 404);
}

function handleList() {
    $db = getDB();
    $where = ['s.est_actif = 1'];
    $params = [];

    if (!empty($_GET['categorie'])) {
        $where[] = 's.categorie_id = ?';
        $params[] = (int)$_GET['categorie'];
    }
    if (!empty($_GET['type'])) {
        $where[] = 's.type = ?';
        $params[] = $_GET['type'];
    }
    if (!empty($_GET['search'])) {
        $where[] = '(s.titre LIKE ? OR s.description LIKE ? OR u.nom LIKE ? OR u.prenom LIKE ?)';
        $search = '%' . $_GET['search'] . '%';
        $params = array_merge($params, [$search, $search, $search, $search]);
    }
    if (!empty($_GET['prix_max'])) {
        $where[] = 's.prix <= ?';
        $params[] = (float)$_GET['prix_max'];
    }

    $orderBy = 'ORDER BY s.note_moyenne DESC';
    if (!empty($_GET['sort'])) {
        match($_GET['sort']) {
            'prix_asc' => $orderBy = 'ORDER BY s.prix ASC',
            'prix_desc' => $orderBy = 'ORDER BY s.prix DESC',
            'note' => $orderBy = 'ORDER BY s.note_moyenne DESC',
            default => $orderBy = 'ORDER BY s.note_moyenne DESC'
        };
    }

    $whereStr = implode(' AND ', $where);
    $sql = "SELECT s.*, c.nom as categorie_nom, c.couleur as categorie_couleur,
                   u.nom as praticien_nom, u.prenom as praticien_prenom, u.avatar as praticien_avatar
            FROM services s
            JOIN categories c ON s.categorie_id = c.id
            JOIN utilisateurs u ON s.praticien_id = u.id
            WHERE $whereStr $orderBy";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function handleDetail($id) {
    if (!$id) jsonError('ID requis');
    $db = getDB();
    $stmt = $db->prepare("SELECT s.*, c.nom as categorie_nom, c.couleur as categorie_couleur,
                                  u.nom as praticien_nom, u.prenom as praticien_prenom, u.bio as praticien_bio, u.avatar as praticien_avatar
                           FROM services s
                           JOIN categories c ON s.categorie_id = c.id
                           JOIN utilisateurs u ON s.praticien_id = u.id
                           WHERE s.id = ? AND s.est_actif = 1");
    $stmt->execute([$id]);
    $service = $stmt->fetch();
    if (!$service) jsonError('Service introuvable', 404);
    jsonResponse($service);
}

function handleCreneaux($serviceId) {
    if (!$serviceId) jsonError('ID service requis');
    $db = getDB();
    $stmt = $db->prepare("SELECT c.*, 
                                  (c.places_disponibles - COALESCE(
                                    (SELECT COUNT(*) FROM reservations r WHERE r.creneau_id = c.id AND r.statut IN ('en_attente','confirme')), 0
                                  )) as places_restantes
                           FROM creneaux c
                           WHERE c.service_id = ? AND c.date_heure_debut > NOW() AND c.est_annule = 0
                           ORDER BY c.date_heure_debut ASC");
    $stmt->execute([$serviceId]);
    jsonResponse($stmt->fetchAll());
}

function handleCreate() {
    $body = getJsonBody();
    $session = requireAuth();
    $db = getDB();

    $required = ['categorie_id', 'titre', 'duree_minutes', 'prix'];
    foreach ($required as $field) {
        if (empty($body[$field])) jsonError("Champ requis : $field");
    }

    $stmt = $db->prepare("INSERT INTO services (praticien_id, categorie_id, titre, description, duree_minutes, prix, type, places_max)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $session['user_id'],
        (int)$body['categorie_id'],
        trim($body['titre']),
        trim($body['description'] ?? ''),
        (int)$body['duree_minutes'],
        (float)$body['prix'],
        $body['type'] ?? 'individuel',
        (int)($body['places_max'] ?? 1)
    ]);
    jsonResponse(['success' => true, 'id' => $db->lastInsertId()], 201);
}

function handleUpdate($id) {
    if (!$id) jsonError('ID requis');
    $session = requireAuth();
    $body = getJsonBody();
    $db = getDB();

    $stmt = $db->prepare("SELECT praticien_id FROM services WHERE id = ?");
    $stmt->execute([$id]);
    $service = $stmt->fetch();
    if (!$service) jsonError('Service introuvable', 404);
    if ($service['praticien_id'] != $session['user_id'] && $session['role'] !== 'admin') {
        jsonError('Accès refusé', 403);
    }

    $fields = [];
    $params = [];
    $allowed = ['titre', 'description', 'duree_minutes', 'prix', 'type', 'places_max', 'est_actif'];
    foreach ($allowed as $f) {
        if (isset($body[$f])) { $fields[] = "$f = ?"; $params[] = $body[$f]; }
    }
    if (empty($fields)) jsonError('Aucune modification');
    $params[] = $id;
    $db->prepare("UPDATE services SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
    jsonResponse(['success' => true]);
}

function handleDelete($id) {
    if (!$id) jsonError('ID requis');
    $session = requireAuth();
    $db = getDB();
    $stmt = $db->prepare("SELECT praticien_id FROM services WHERE id = ?");
    $stmt->execute([$id]);
    $service = $stmt->fetch();
    if (!$service) jsonError('Service introuvable', 404);
    if ($service['praticien_id'] != $session['user_id'] && $session['role'] !== 'admin') {
        jsonError('Accès refusé', 403);
    }
    $db->prepare("UPDATE services SET est_actif = 0 WHERE id = ?")->execute([$id]);
    jsonResponse(['success' => true]);
}
