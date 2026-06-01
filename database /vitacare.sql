-- ============================================================
-- VitaCare - Base de données
-- Plateforme de santé mentale et coaching
-- Équipe : Adrien, Raphaël, Axel
-- ============================================================

CREATE DATABASE IF NOT EXISTS vitacare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vitacare;

-- ============================================================
-- UTILISATEURS
-- ============================================================
CREATE TABLE utilisateurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe VARCHAR(255) NOT NULL,
    role ENUM('patient', 'praticien', 'admin') NOT NULL DEFAULT 'patient',
    telephone VARCHAR(20),
    date_naissance DATE,
    avatar VARCHAR(255),
    bio TEXT,
    est_actif TINYINT(1) DEFAULT 1,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_modification DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- CATEGORIES DE SERVICES
-- ============================================================
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    icone VARCHAR(50),
    couleur VARCHAR(7) DEFAULT '#6B7280'
) ENGINE=InnoDB;

INSERT INTO categories (nom, description, icone, couleur) VALUES
('Psychologie', 'Consultations avec un psychologue clinicien', 'brain', '#7C3AED'),
('Coaching de vie', 'Accompagnement personnel et professionnel', 'target', '#2563EB'),
('Méditation & Mindfulness', 'Séances guidées de méditation et pleine conscience', 'leaf', '#059669'),
('Gestion du stress', 'Techniques et programmes anti-stress', 'wind', '#D97706'),
('Thérapie cognitive', 'TCC et approches cognitivo-comportementales', 'lightbulb', '#DC2626'),
('Bien-être holisitique', 'Approche globale du bien-être mental et physique', 'heart', '#EC4899');

-- ============================================================
-- SERVICES / OFFRES
-- ============================================================
CREATE TABLE services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    praticien_id INT NOT NULL,
    categorie_id INT NOT NULL,
    titre VARCHAR(200) NOT NULL,
    description TEXT,
    duree_minutes INT NOT NULL DEFAULT 60,
    prix DECIMAL(10,2) NOT NULL,
    type ENUM('individuel', 'groupe', 'programme') DEFAULT 'individuel',
    places_max INT DEFAULT 1,
    est_actif TINYINT(1) DEFAULT 1,
    note_moyenne DECIMAL(3,2) DEFAULT 0,
    nb_avis INT DEFAULT 0,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (praticien_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (categorie_id) REFERENCES categories(id)
) ENGINE=InnoDB;

-- ============================================================
-- DISPONIBILITES DES PRATICIENS
-- ============================================================
CREATE TABLE disponibilites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    praticien_id INT NOT NULL,
    jour_semaine TINYINT NOT NULL COMMENT '0=Lundi, 6=Dimanche',
    heure_debut TIME NOT NULL,
    heure_fin TIME NOT NULL,
    est_actif TINYINT(1) DEFAULT 1,
    FOREIGN KEY (praticien_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- CRÉNEAUX HORAIRES
-- ============================================================
CREATE TABLE creneaux (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_id INT NOT NULL,
    praticien_id INT NOT NULL,
    date_heure_debut DATETIME NOT NULL,
    date_heure_fin DATETIME NOT NULL,
    places_disponibles INT NOT NULL DEFAULT 1,
    est_annule TINYINT(1) DEFAULT 0,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (praticien_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- RESERVATIONS
-- ============================================================
CREATE TABLE reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    creneau_id INT NOT NULL,
    statut ENUM('en_attente', 'confirme', 'annule', 'termine') DEFAULT 'en_attente',
    montant_paye DECIMAL(10,2),
    notes_patient TEXT,
    date_reservation DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_modification DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (creneau_id) REFERENCES creneaux(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- ACTIVITES / PROGRAMMES DE GROUPE
-- ============================================================
CREATE TABLE activites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    praticien_id INT NOT NULL,
    categorie_id INT NOT NULL,
    titre VARCHAR(200) NOT NULL,
    description TEXT,
    date_debut DATETIME NOT NULL,
    date_fin DATETIME NOT NULL,
    lieu VARCHAR(200),
    places_max INT NOT NULL DEFAULT 10,
    places_reservees INT DEFAULT 0,
    prix DECIMAL(10,2) DEFAULT 0,
    statut ENUM('planifie', 'en_cours', 'termine', 'annule') DEFAULT 'planifie',
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (praticien_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (categorie_id) REFERENCES categories(id)
) ENGINE=InnoDB;

-- ============================================================
-- INSCRIPTIONS AUX ACTIVITES
-- ============================================================
CREATE TABLE inscriptions_activites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    activite_id INT NOT NULL,
    statut ENUM('inscrit', 'annule', 'present') DEFAULT 'inscrit',
    date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_inscription (patient_id, activite_id),
    FOREIGN KEY (patient_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (activite_id) REFERENCES activites(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- PANIER
-- ============================================================
CREATE TABLE panier (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    creneau_id INT,
    activite_id INT,
    type ENUM('reservation', 'activite') NOT NULL,
    date_ajout DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (creneau_id) REFERENCES creneaux(id) ON DELETE CASCADE,
    FOREIGN KEY (activite_id) REFERENCES activites(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    titre VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('reservation', 'annulation', 'rappel', 'systeme', 'message') DEFAULT 'systeme',
    est_lu TINYINT(1) DEFAULT 0,
    lien VARCHAR(255),
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- MESSAGES (entre patients et praticiens)
-- ============================================================
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expediteur_id INT NOT NULL,
    destinataire_id INT NOT NULL,
    contenu TEXT NOT NULL,
    est_lu TINYINT(1) DEFAULT 0,
    date_envoi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expediteur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (destinataire_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- AVIS / NOTES
-- ============================================================
CREATE TABLE avis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    service_id INT NOT NULL,
    reservation_id INT,
    note TINYINT NOT NULL CHECK (note BETWEEN 1 AND 5),
    commentaire TEXT,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_avis (patient_id, service_id),
    FOREIGN KEY (patient_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- DONNÉES DE DÉMONSTRATION
-- ============================================================

-- Utilisateurs (mdp = "password123" hashé en bcrypt)
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role, telephone, bio) VALUES
('Admin', 'VitaCare', 'admin@vitacare.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', NULL, 'Administrateur de la plateforme'),
('Martin', 'Sophie', 'sophie.martin@vitacare.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'praticien', '0612345678', 'Psychologue clinicienne spécialisée en TCC. 10 ans d\'expérience dans la gestion de l\'anxiété et de la dépression.'),
('Lefevre', 'Thomas', 'thomas.lefevre@vitacare.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'praticien', '0623456789', 'Coach de vie certifié. Accompagnement dans la transition professionnelle et le développement personnel.'),
('Bernard', 'Claire', 'claire.bernard@vitacare.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'praticien', '0634567890', 'Instructrice de méditation et mindfulness. Certifiée MBSR.'),
('Dupont', 'Julie', 'julie.dupont@vitacare.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'patient', '0645678901', NULL),
('Moreau', 'Pierre', 'pierre.moreau@vitacare.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'patient', '0656789012', NULL);

-- Services
INSERT INTO services (praticien_id, categorie_id, titre, description, duree_minutes, prix, type, places_max, note_moyenne, nb_avis) VALUES
(2, 1, 'Consultation psychologique individuelle', 'Séance de psychologie clinique pour gérer l\'anxiété, la dépression ou tout autre trouble mental. Approche TCC.', 60, 75.00, 'individuel', 1, 4.9, 128),
(2, 5, 'Programme TCC - 8 séances', 'Programme complet de thérapie cognitivo-comportementale sur 8 semaines. Idéal pour l\'anxiété et les phobies.', 60, 480.00, 'programme', 1, 4.8, 45),
(3, 2, 'Coaching de vie - séance découverte', 'Première séance de coaching pour définir vos objectifs et établir un plan d\'action personnalisé.', 90, 60.00, 'individuel', 1, 4.7, 93),
(3, 4, 'Atelier gestion du stress', 'Atelier en groupe pour apprendre des techniques concrètes de gestion du stress au quotidien.', 120, 35.00, 'groupe', 8, 4.6, 67),
(4, 3, 'Séance de méditation guidée', 'Séance de méditation pleine conscience adaptée aux débutants comme aux pratiquants avancés.', 45, 25.00, 'individuel', 1, 4.8, 112),
(4, 3, 'Programme MBSR - Mindfulness', 'Programme de réduction du stress basé sur la pleine conscience sur 8 semaines.', 120, 280.00, 'programme', 12, 4.9, 58);

-- Créneaux (à partir d'aujourd'hui)
INSERT INTO creneaux (service_id, praticien_id, date_heure_debut, date_heure_fin, places_disponibles) VALUES
(1, 2, DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 1 HOUR), 1),
(1, 2, DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 2 DAY), INTERVAL 1 HOUR), 1),
(3, 3, DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 90 MINUTE), 1),
(5, 4, DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 45 MINUTE), 1),
(5, 4, DATE_ADD(NOW(), INTERVAL 3 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 3 DAY), INTERVAL 45 MINUTE), 1);

-- Activités
INSERT INTO activites (praticien_id, categorie_id, titre, description, date_debut, date_fin, lieu, places_max, places_reservees, prix) VALUES
(4, 3, 'Atelier méditation du matin', 'Démarrez votre journée avec sérénité grâce à cette séance de méditation collective.', DATE_ADD(NOW(), INTERVAL 3 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 3 DAY), INTERVAL 1 HOUR), 'Studio Zen, VitaCare Centre', 15, 8, 20.00),
(3, 4, 'Atelier gestion du stress - Mai', 'Atelier intensif pour apprendre les bases de la gestion du stress.', DATE_ADD(NOW(), INTERVAL 5 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 5 DAY), INTERVAL 2 HOUR), 'Salle Bien-être, VitaCare Centre', 10, 4, 35.00),
(2, 1, 'Conférence : Comprendre l\'anxiété', 'Conférence ouverte sur les mécanismes de l\'anxiété et les solutions thérapeutiques modernes.', DATE_ADD(NOW(), INTERVAL 7 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 7 DAY), INTERVAL 2 HOUR), 'Salle Conférence A', 30, 12, 0.00);

-- Notifications de démo
INSERT INTO notifications (utilisateur_id, titre, message, type, est_lu) VALUES
(5, 'Bienvenue sur VitaCare !', 'Votre compte a été créé avec succès. Explorez nos services de santé mentale et coaching.', 'systeme', 0),
(5, 'Rappel de rendez-vous', 'Vous avez un rendez-vous demain à 10h00 avec Sophie Martin.', 'rappel', 0);

-- ============================================================
-- INDEX pour performances
-- ============================================================
CREATE INDEX idx_reservations_patient ON reservations(patient_id);
CREATE INDEX idx_reservations_statut ON reservations(statut);
CREATE INDEX idx_creneaux_service ON creneaux(service_id);
CREATE INDEX idx_creneaux_date ON creneaux(date_heure_debut);
CREATE INDEX idx_notifications_user ON notifications(utilisateur_id, est_lu);
CREATE INDEX idx_services_categorie ON services(categorie_id);
CREATE INDEX idx_services_praticien ON services(praticien_id);
