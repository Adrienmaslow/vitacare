<?php
// backend/api/dashboard.php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../middleware/auth.php';

setCorsHeaders();
$session = requireAuth();
$db = getDB();

if ($session['role'] === 'admin') {
    // Stats globales
    $stats = [];
    $stmt = $db->query("SELECT COUNT(*) as total FROM reservations WHERE statut != 'annule'");
    $stats['reservations_total'] = $stmt->fetch()['total'];
    $stmt = $db->query("SELECT COUNT(*) as total FROM utilisateurs WHERE role = 'patient'");
    $stats['patients_total'] = $stmt->fetch()['total'];
    $stmt = $db->query("SELECT COUNT(*) as total FROM activites WHERE statut != 'annule'");
    $stats['activites_total'] = $stmt->fetch()['total'];
    $stmt = $db->query("SELECT COUNT(*) as total FROM reservations WHERE statut = 'en_attente'");
    $stats['en_attente'] = $stmt->fetch()['total'];

    // Activités à venir
    $stmt = $db->prepare("SELECT a.*, u.nom as praticien_nom, u.prenom as praticien_prenom FROM activites a JOIN utilisateurs u ON a.praticien_id = u.id WHERE a.date_debut > NOW() AND a.statut = 'planifie' ORDER BY a.date_debut ASC LIMIT 5");
    $stmt->execute();
    $stats['activites_a_venir'] = $stmt->fetchAll();

    // Dernières réservations
    $stmt = $db->prepare("SELECT r.*, c.date_heure_debut, s.titre as service_titre, u.nom as patient_nom, u.prenom as patient_prenom FROM reservations r JOIN creneaux c ON r.creneau_id = c.id JOIN services s ON c.service_id = s.id JOIN utilisateurs u ON r.patient_id = u.id ORDER BY r.date_reservation DESC LIMIT 5");
    $stmt->execute();
    $stats['dernieres_reservations'] = $stmt->fetchAll();

    jsonResponse($stats);

} elseif ($session['role'] === 'praticien') {
    $stats = [];
    $stmt = $db->prepare("SELECT COUNT(*) as total FROM reservations r JOIN creneaux c ON r.creneau_id = c.id JOIN services s ON c.service_id = s.id WHERE s.praticien_id = ? AND r.statut != 'annule'");
    $stmt->execute([$session['user_id']]);
    $stats['mes_reservations'] = $stmt->fetch()['total'];

    $stmt = $db->prepare("SELECT r.*, c.date_heure_debut, c.date_heure_fin, s.titre as service_titre, u.nom as patient_nom, u.prenom as patient_prenom FROM reservations r JOIN creneaux c ON r.creneau_id = c.id JOIN services s ON c.service_id = s.id JOIN utilisateurs u ON r.patient_id = u.id WHERE s.praticien_id = ? AND c.date_heure_debut > NOW() AND r.statut = 'confirme' ORDER BY c.date_heure_debut ASC LIMIT 5");
    $stmt->execute([$session['user_id']]);
    $stats['prochains_rdv'] = $stmt->fetchAll();

    jsonResponse($stats);

} else {
    // Patient
    $stats = [];
    $stmt = $db->prepare("SELECT r.*, c.date_heure_debut, c.date_heure_fin, s.titre as service_titre, u.nom as praticien_nom, u.prenom as praticien_prenom FROM reservations r JOIN creneaux c ON r.creneau_id = c.id JOIN services s ON c.service_id = s.id JOIN utilisateurs u ON s.praticien_id = u.id WHERE r.patient_id = ? AND c.date_heure_debut > NOW() AND r.statut = 'confirme' ORDER BY c.date_heure_debut ASC LIMIT 3");
    $stmt->execute([$session['user_id']]);
    $stats['prochains_rdv'] = $stmt->fetchAll();

    $stmt = $db->prepare("SELECT ia.*, a.titre, a.date_debut, a.lieu FROM inscriptions_activites ia JOIN activites a ON ia.activite_id = a.id WHERE ia.patient_id = ? AND a.date_debut > NOW() AND ia.statut = 'inscrit' ORDER BY a.date_debut ASC LIMIT 3");
    $stmt->execute([$session['user_id']]);
    $stats['mes_activites'] = $stmt->fetchAll();

    $stmt = $db->prepare("SELECT COUNT(*) as total FROM reservations WHERE patient_id = ?");
    $stmt->execute([$session['user_id']]);
    $stats['total_reservations'] = $stmt->fetch()['total'];

    jsonResponse($stats);
}
