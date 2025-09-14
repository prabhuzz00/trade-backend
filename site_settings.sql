-- SQL to create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(64) NOT NULL UNIQUE,
  value TEXT
);