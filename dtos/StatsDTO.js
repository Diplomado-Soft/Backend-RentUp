/**
 * StatsDTO - Data Transfer Object para respuestas de estadísticas
 * Estandariza respuestas de reportes y estadísticas
 */
class StatsDTO {
    constructor(data, type = 'general') {
        this.type = type;
        this.generated_at = new Date();
        
        if (type === 'apartments_by_barrio') {
            this.data = data.map(item => ({
                barrio: item.barrio,
                total_apartments: item.total_apartments || item.count || 0
            }));
        } else if (type === 'apartments_by_status') {
            this.data = data.map(item => ({
                status: item.status || item.publication_status,
                count: item.count || 0
            }));
        } else if (type === 'revenue') {
            this.data = data;
            this.total_revenue = data.reduce((sum, item) => sum + (item.revenue || 0), 0);
        } else {
            this.data = data;
        }
    }

    static fromDatabase(data, type = 'general') {
        return new StatsDTO(data, type);
    }
}

module.exports = StatsDTO;
