-- Migración: Crear tabla de visitas para el Calendario de Visitas
-- Ejecutar: mysql -u usuario -p rentup < migrations/002_create_visits_table.sql

CREATE TABLE IF NOT EXISTS visits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    tenant_id INT NOT NULL,
    landlord_id INT NOT NULL,
    visit_date DATETIME NOT NULL,
    status ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES apartments(id_apt) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (landlord_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_visits_landlord (landlord_id, status),
    INDEX idx_visits_tenant (tenant_id, status),
    INDEX idx_visits_property_date (property_id, visit_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
