<?php
// backend/api/activites.php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../middleware/auth.php';

setCorsHeaders();

$action = $_GET['action'] ?? 'list';
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($action) {
    case 'list': handleList(); break;
    case 'detail': handleDetail($id); break;
    case 'inscrire': requireAuth(); handleInscrire($id); break;
    case 'desinscrire': requireAuth(); handleDesinscrire($id); break;
    case 'create': requireRole(['praticien', 'admin']); handleCreate(); break;
    default: jsonError('Action inconnue', 404);
}

function handleList() {
    $db = getDB();
    $where = ["a.statut != 'annule'", 'a.date_debut > NOW()'];
    $params = [];
    if (!empty($_GET['categorie'])) { $where[] = 'a.categorie_id = ?'; $params[] = (int)$_GET['categorie']; }
    if (!empty($_GET['search'])) {
        $where[] = '(a.titre LIKE ? OR a.description LIKE ?)';
        $s = '%' . $_GET['search'] . '%';
        $params = array_merge($params, [$s, $s]);
    }
    $sql = "SELECT a.*, c.nom as categorie_nom, c.couleur,
                   u.nom as praticien_nom, u.prenom as praticien_prenom,
                   (a.places_max - a.places_reservees) as places_restantes
            FROM activites a
            JOIN categories c ON a.categorie_id = c.id
            JOIN utilisateurs u ON a.praticien_id = u.id
            WHERE " . implode(' AND ', $where) . " ORDER BY a.date_debut ASC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

function handleDetail($id) {
    if (!$id) jsonError('ID requis');
    $db = getDB();
    $stmt = $db->prepare("SELECT a.*, c.nom as categorie_nom, u.nom as praticien_nom, u.prenom as praticien_prenom, u.bio as praticien_bio
                           FROM activites a JOIN categories c ON a.categorie_id = c.id JOIN utilisateurs u ON a.praticien_id = u.id
                           WHERE a.id = ?");
    $stmt->execute([$id]);
    $act = $stmt->fetch();
    if (!$act) jsonError('Activité introuvable', 404);
    jsonResponse($act);
}

function handleInscrire($id) {
    if (!$id) jsonError('ID requis');
    $session = requireAuth();
    $db = getDB();
    $db->beginTransaction();
    try {
        $stmt = $db->prepare("SELECT * FROM activites WHERE id = ? FOR UPDATE");
        $stmt->execute([$id]);
        $act = $stmt->fetch();
        if (!$act) { $db->rollBack(); jsonError('Activité introuvable', 404); }
        if ($act['places_reservees'] >= $act['places_max']) { $db->rollBack(); jsonError('Plus de places disponibles'); }

        $stmt = $db->prepare("SELECT id FROM inscriptions_activites WHERE patient_id = ? AND activite_id = ? AND statut = 'inscrit'");
        $stmt->execute([$session['user_id'], $id]);
        if ($stmt->fetch()) { $db->rollBack(); jsonError('Déjà inscrit'); }

        $db->prepare("INSERT INTO inscriptions_activites (patient_id, activite_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE statut = 'inscrit'")->execute([$session['user_id'], $id]);
        $db->prepare("UPDATE activites SET places_reservees = places_reservees + 1 WHERE id = ?")->execute([$id]);
        $db->prepare("INSERT INTO notifications (utilisateur_id, titre, message, type) VALUES (?, 'Inscription confirmée', ?, 'reservation')")->execute([$session['user_id'], "Vous êtes inscrit(e) à : " . $act['titre']]);
        $db->commit();
        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Erreur : ' . $e->getMessage(), 500);
    }
}

function handleDesinscrire($id) {
    if (!$id) jsonError('ID requis');
    $session = requireAuth();
    $db = getDB();
    $stmt = $db->prepare("SELECT id FROM inscriptions_activites WHERE patient_id = ? AND activite_id = ? AND statut = 'inscrit'");
    $stmt->execute([$session['user_id'], $id]);
    if (!$stmt->fetch()) jsonError('Non inscrit');
    $db->prepare("UPDATE inscriptions_activites SET statut = 'annule' WHERE patient_id = ? AND activite_id = ?")->execute([$session['user_id'], $id]);
    $db->prepare("UPDATE activites SET places_reservees = GREATEST(places_reservees - 1, 0) WHERE id = ?")->execute([$id]);
    jsonResponse(['success' => true]);
}

function handleCreate() {
    $session = requireAuth();
    $body = getJsonBody();
    $db = getDB();
    $stmt = $db->prepare("INSERT INTO activites (praticien_id, categorie_id, titre, description, date_debut, date_fin, lieu, places_max, prix)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $session['user_id'],
        (int)$body['categorie_id'],
        trim($body['titre']),
        trim($body['description'] ?? ''),
        $body['date_debut'],
        $body['date_fin'],
        trim($body['lieu'] ?? ''),
        (int)($body['places_max'] ?? 10),
        (float)($body['prix'] ?? 0)
    ]);
    jsonResponse(['success' => true, 'id' => $db->lastInsertId()], 201);
}
