<?php
// backend/api/panier.php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../middleware/auth.php';

setCorsHeaders();
$session = requireAuth();
if ($session['role'] !== 'patient') jsonError('Seuls les patients utilisent le panier');

$action = $_GET['action'] ?? 'list';
$db = getDB();

switch ($action) {
    case 'list':
        $stmt = $db->prepare("SELECT p.*,
            CASE WHEN p.type = 'reservation' THEN c.date_heure_debut ELSE a.date_debut END as date_debut,
            CASE WHEN p.type = 'reservation' THEN s.titre ELSE act.titre END as titre,
            CASE WHEN p.type = 'reservation' THEN s.prix ELSE act.prix END as prix,
            CASE WHEN p.type = 'reservation' THEN CONCAT(u.prenom,' ',u.nom) ELSE CONCAT(u2.prenom,' ',u2.nom) END as praticien
            FROM panier p
            LEFT JOIN creneaux c ON p.creneau_id = c.id
            LEFT JOIN services s ON c.service_id = s.id
            LEFT JOIN utilisateurs u ON s.praticien_id = u.id
            LEFT JOIN activites act ON p.activite_id = act.id
            LEFT JOIN utilisateurs u2 ON act.praticien_id = u2.id
            LEFT JOIN activites a ON p.activite_id = a.id
            WHERE p.patient_id = ?");
        $stmt->execute([$session['user_id']]);
        $items = $stmt->fetchAll();
        $total = array_sum(array_column($items, 'prix'));
        jsonResponse(['items' => $items, 'total' => $total]);
        break;

    case 'add':
        $body = getJsonBody();
        $type = $body['type'] ?? '';
        if (!in_array($type, ['reservation', 'activite'])) jsonError('Type invalide');
        $refId = (int)($body['ref_id'] ?? 0);
        if (!$refId) jsonError('ID requis');
        $stmt = $db->prepare("INSERT INTO panier (patient_id, type, creneau_id, activite_id) VALUES (?, ?, ?, ?)");
        $stmt->execute([$session['user_id'], $type, $type === 'reservation' ? $refId : null, $type === 'activite' ? $refId : null]);
        jsonResponse(['success' => true]);
        break;

    case 'remove':
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) jsonError('ID requis');
        $db->prepare("DELETE FROM panier WHERE id = ? AND patient_id = ?")->execute([$id, $session['user_id']]);
        jsonResponse(['success' => true]);
        break;

    case 'checkout':
        // Valider toutes les réservations du panier
        $stmt = $db->prepare("SELECT * FROM panier WHERE patient_id = ?");
        $stmt->execute([$session['user_id']]);
        $items = $stmt->fetchAll();
        if (empty($items)) jsonError('Panier vide');

        $db->beginTransaction();
        try {
            foreach ($items as $item) {
                if ($item['type'] === 'reservation' && $item['creneau_id']) {
                    // Vérifier dispo
                    $stmt2 = $db->prepare("SELECT c.*, s.prix FROM creneaux c JOIN services s ON c.service_id = s.id WHERE c.id = ? AND c.est_annule = 0 FOR UPDATE");
                    $stmt2->execute([$item['creneau_id']]);
                    $creneau = $stmt2->fetch();
                    if (!$creneau) continue;
                    $stmt3 = $db->prepare("SELECT COUNT(*) as nb FROM reservations WHERE creneau_id = ? AND statut IN ('en_attente','confirme')");
                    $stmt3->execute([$item['creneau_id']]);
                    if ($stmt3->fetch()['nb'] >= $creneau['places_disponibles']) {
                        $db->rollBack();
                        jsonError('Un créneau n\'est plus disponible');
                    }
                    $db->prepare("INSERT IGNORE INTO reservations (patient_id, creneau_id, statut, montant_paye) VALUES (?, ?, 'confirme', ?)")
                       ->execute([$session['user_id'], $item['creneau_id'], $creneau['prix']]);
                } elseif ($item['type'] === 'activite' && $item['activite_id']) {
                    $stmt2 = $db->prepare("SELECT * FROM activites WHERE id = ? FOR UPDATE");
                    $stmt2->execute([$item['activite_id']]);
                    $act = $stmt2->fetch();
                    if (!$act || $act['places_reservees'] >= $act['places_max']) continue;
                    $db->prepare("INSERT IGNORE INTO inscriptions_activites (patient_id, activite_id) VALUES (?, ?)")
                       ->execute([$session['user_id'], $item['activite_id']]);
                    $db->prepare("UPDATE activites SET places_reservees = places_reservees + 1 WHERE id = ?")
                       ->execute([$item['activite_id']]);
                }
            }
            $db->prepare("DELETE FROM panier WHERE patient_id = ?")->execute([$session['user_id']]);
            $db->prepare("INSERT INTO notifications (utilisateur_id, titre, message, type) VALUES (?, 'Paiement simulé confirmé', 'Vos réservations ont été validées avec succès.', 'reservation')")
               ->execute([$session['user_id']]);
            $db->commit();
            jsonResponse(['success' => true, 'message' => 'Commande validée']);
        } catch (Exception $e) {
            $db->rollBack();
            jsonError('Erreur : ' . $e->getMessage(), 500);
        }
        break;

    default: jsonError('Action inconnue', 404);
}
