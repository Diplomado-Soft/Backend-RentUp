/**
 * ContractDTO - Data Transfer Object para respuestas de contratos
 */
class ContractDTO {
    constructor(contract) {
        this.id = contract.agreement_id;
        this.property_id = contract.property_id;
        this.tenant_id = contract.tenant_id;
        this.landlord_id = contract.landlord_id;
        this.start_date = contract.start_date;
        this.end_date = contract.end_date;
        this.monthly_rent = contract.monthly_rent;
        this.status = contract.status;
        this.created_at = contract.created_at;
        
        if (contract.direccion_apt) {
            this.property = {
                id: contract.property_id,
                direccion: contract.direccion_apt,
                barrio: contract.barrio,
                status: contract.apt_status
            };
        }
        
        if (contract.tenant_name) {
            this.tenant = {
                name: contract.tenant_name,
                lastname: contract.tenant_lastname,
                email: contract.tenant_email
            };
        }
        
        if (contract.landlord_name) {
            this.landlord = {
                name: contract.landlord_name,
                email: contract.landlord_email
            };
        }
    }

    static fromDatabase(contract) {
        return new ContractDTO(contract);
    }

    static fromDatabaseList(contracts) {
        return contracts.map(c => new ContractDTO(c));
    }
}

module.exports = ContractDTO;
