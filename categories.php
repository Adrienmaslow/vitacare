<?php
// backend/api/categories.php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';

setCorsHeaders();

$stmt = getDB()->prepare("SELECT * FROM categories ORDER BY nom");
$stmt->execute();
jsonResponse($stmt->fetchAll());
