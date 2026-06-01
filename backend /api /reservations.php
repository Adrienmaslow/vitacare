<?php
// backend/api/reservations.php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../middleware/auth.php';

setCorsHeaders();
$session = requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($action) {
    case 'list': handleList($session); break;
    case 'create': handleCreate($session); break;
    case 'cancel': handleCancel($session, $id); break;
    case 'confirm': requireRole(['praticien', 'admin']); handleConfirm($session, $id); break;
    default: jsonError('Action inconnue', 404);
}

function handleList($session) {
    $db = getDB();
    if ($session['role'] === 'patient') {
        $stmt = $db->prepare("SELECT r.*, c.date_heure_debut, c.date_heure_fin,
                                      s.titre as service_titre, s.prix as service_prix,
                                      u.nom as praticien_nom, u.prenom as praticien_prenom
                               FROM reservations r
                               JOIN creneaux c ON r.creneau_id = c.id
                               JOIN services s ON c.service_id = s.id
                               JOIN utilisateurs u ON s.praticien_id = u.id
                               WHERE r.patient_id = ?
                               ORDER BY c.date_heure_debut DESC");
        $stmt->execute([$session['user_id']]);
    } elseif ($session['role'] === 'praticien') {
        $stmt = $db->prepare("SELECT r.*, c.date_heure_debut, c.date_heure_fin,
                                      s.titre as service_titre,
                                      u.nom as patient_nom, u.prenom as patient_prenom, u.email as patient_email
                               FROM reservations r
                               JOIN creneaux c ON r.creneau_id = c.id
                               JOIN services s ON c.service_id = s.id
                               JOIN utilisateurs u ON r.patient_id = u.id
                               WHERE s.praticien_id = ?
                               ORDER BY c.date_heure_debut DESC");
        $stmt->execute([$session['user_id']]);
    } else {
        $stmt = $db->prepare("SELECT r.*, c.date_heure_debut, c.date_heure_fin,
                                      s.titre as service_titre,
                                      pat.nom as patient_nom, pat.prenom as patient_prenom,
                                      pra.nom as praticien_nom, pra.prenom as praticien_prenom
                               FROM reservations r
                               JOIN creneaux c ON r.creneau_id = c.id
                               JOIN services s ON c.service_id = s.id
                               JOIN utilisateurs pat ON r.patient_id = pat.id
                               JOIN utilisateurs pra ON s.praticien_id = pra.id
                               ORDER BY c.date_heure_debut DESC LIMIT 100");
        $stmt->execute([]);
    }
    jsonResponse($stmt->fetchAll());
}

function handleCreate($session) {
    if ($session['role'] !== 'patient') jsonError('Seuls les patients peuvent réserver');
    $body = getJsonBody();
    $creneauId = (int)($body['creneau_id'] ?? 0);
    if (!$creneauId) jsonError('Créneau requis');

    $db = getDB();
    $db->beginTransaction();
    try {
        // Vérifier disponibilité (SELECT FOR UPDATE pour éviter double réservation)
        $stmt = $db->prepare("SELECT c.*, s.prix 
                               FROM creneaux c JOIN services s ON c.service_id = s.id
                               WHERE c.id = ? AND c.est_annule = 0 FOR UPDATE");
        $stmt->execute([$creneauId]);
        $creneau = $stmt->fetch();
        if (!$creneau) { $db->rollBack(); jsonError('Créneau introuvable'); }

        // Compter réservations actives
        $stmt = $db->prepare("SELECT COUNT(*) as nb FROM reservations WHERE creneau_id = ? AND statut IN ('en_attente','confirme')");
        $stmt->execute([$creneauId]);
        $count = $stmt->fetch()['nb'];
        if ($count >= $creneau['places_disponibles']) { $db->rollBack(); jsonError('Plus de places disponibles'); }

        // Vérifier double réservation
        $stmt = $db->prepare("SELECT id FROM reservations WHERE patient_id = ? AND creneau_id = ? AND statut != 'annule'");
        $stmt->execute([$session['user_id'], $creneauId]);
        if ($stmt->fetch()) { $db->rollBack(); jsonError('Vous avez déjà réservé ce créneau'); }

        $stmt = $db->prepare("INSERT INTO reservations (patient_id, creneau_id, statut, montant_paye, notes_patient) VALUES (?, ?, 'confirme', ?, ?)");
        $stmt->execute([$session['user_id'], $creneauId, $creneau['prix'], $body['notes'] ?? '']);
        $reservationId = $db->lastInsertId();

        // Notification
        $stmt = $db->prepare("INSERT INTO notifications (utilisateur_id, titre, message, type) VALUES (?, 'Réservation confirmée', ?, 'reservation')");
        $stmt->execute([$session['user_id'], "Votre réservation a bien été enregistrée."]);

        $db->commit();
        jsonResponse(['success' => true, 'reservation_id' => $reservationId], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Erreur lors de la réservation : ' . $e->getMessage(), 500);
    }
}

function handleCancel($session, $id) {
    if (!$id) jsonError('ID requis');
    $db = getDB();
    $stmt = $db->prepare("SELECT r.*, c.date_heure_debut FROM reservations r JOIN creneaux c ON r.creneau_id = c.id WHERE r.id = ?");
    $stmt->execute([$id]);
    $resa = $stmt->fetch();
    if (!$resa) jsonError('Réservation introuvable', 404);
    if ($resa['patient_id'] != $session['user_id'] && $session['role'] !== 'admin') jsonError('Accès refusé', 403);
    if ($resa['statut'] === 'annule') jsonError('Déjà annulée');

    $db->prepare("UPDATE reservations SET statut = 'annule' WHERE id = ?")->execute([$id]);
    $db->prepare("INSERT INTO notifications (utilisateur_id, titre, message, type) VALUES (?, 'Réservation annulée', 'Votre réservation a été annulée.', 'annulation')")->execute([$session['user_id']]);
    jsonResponse(['success' => true]);
}

function handleConfirm($session, $id) {
    if (!$id) jsonError('ID requis');
    $db = getDB();
    $db->prepare("UPDATE reservations SET statut = 'confirme' WHERE id = ?")->execute([$id]);
    jsonResponse(['success' => true]);
}
