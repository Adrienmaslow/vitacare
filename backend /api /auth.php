<?php
// backend/api/auth.php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../middleware/auth.php';

setCorsHeaders();
startSession();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        if ($method !== 'POST') jsonError('Méthode non autorisée', 405);
        handleLogin();
        break;
    case 'register':
        if ($method !== 'POST') jsonError('Méthode non autorisée', 405);
        handleRegister();
        break;
    case 'logout':
        handleLogout();
        break;
    case 'me':
        handleMe();
        break;
    default:
        jsonError('Action inconnue', 404);
}

function handleLogin() {
    $body = getJsonBody();
    $email = trim($body['email'] ?? '');
    $password = $body['password'] ?? '';

    if (!$email || !$password) {
        jsonError('Email et mot de passe requis');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('Email invalide');
    }

    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM utilisateurs WHERE email = ? AND est_actif = 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['mot_de_passe'])) {
        jsonError('Email ou mot de passe incorrect', 401);
    }

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['email'] = $user['email'];

    unset($user['mot_de_passe']);
    jsonResponse(['success' => true, 'user' => $user]);
}

function handleRegister() {
    $body = getJsonBody();
    $nom = trim($body['nom'] ?? '');
    $prenom = trim($body['prenom'] ?? '');
    $email = trim($body['email'] ?? '');
    $password = $body['password'] ?? '';
    $role = $body['role'] ?? 'patient';

    if (!$nom || !$prenom || !$email || !$password) {
        jsonError('Tous les champs sont requis');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('Email invalide');
    }
    if (strlen($password) < 6) {
        jsonError('Le mot de passe doit contenir au moins 6 caractères');
    }
    if (!in_array($role, ['patient', 'praticien'])) {
        jsonError('Rôle invalide');
    }

    $db = getDB();
    $stmt = $db->prepare("SELECT id FROM utilisateurs WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonError('Cet email est déjà utilisé', 409);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $db->prepare("INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$nom, $prenom, $email, $hash, $role]);
    $id = $db->lastInsertId();

    $_SESSION['user_id'] = $id;
    $_SESSION['role'] = $role;
    $_SESSION['email'] = $email;

    jsonResponse(['success' => true, 'user' => ['id' => $id, 'nom' => $nom, 'prenom' => $prenom, 'email' => $email, 'role' => $role]], 201);
}

function handleLogout() {
    session_destroy();
    jsonResponse(['success' => true]);
}

function handleMe() {
    startSession();
    if (empty($_SESSION['user_id'])) {
        jsonError('Non authentifié', 401);
    }
    $db = getDB();
    $stmt = $db->prepare("SELECT id, nom, prenom, email, role, telephone, bio, avatar, date_creation FROM utilisateurs WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user) jsonError('Utilisateur introuvable', 404);
    jsonResponse($user);
}
