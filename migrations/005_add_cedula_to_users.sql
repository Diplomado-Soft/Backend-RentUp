ALTER TABLE users ADD COLUMN id_document_url VARCHAR(500) DEFAULT NULL AFTER user_password;
ALTER TABLE users ADD COLUMN id_document_key VARCHAR(500) DEFAULT NULL AFTER id_document_url;
