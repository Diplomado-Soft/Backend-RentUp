ALTER TABLE rental_agreements 
MODIFY COLUMN status ENUM('active', 'expired', 'terminated', 'pending', 'signed') 
DEFAULT 'pending';
