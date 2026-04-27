/**
 * Geocoding Service
 * Utiliza Nominatim para geocodificación directa e inversa
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

const geocodeAddress = async (address) => {
    const response = await fetch(
        `${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(address)}&addressdetails=1&limit=1`,
        {
            headers: {
                'Accept-Language': 'es',
                'User-Agent': 'RentUp/1.0'
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('Error en geocodificación');
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
        return null;
    }
    
    return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        display_name: data[0].display_name,
        address: data[0].address
    };
};

const reverseGeocode = async (lat, lon) => {
    const response = await fetch(
        `${NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        {
            headers: {
                'Accept-Language': 'es',
                'User-Agent': 'RentUp/1.0'
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('Error en geocodificación inversa');
    }
    
    const data = await response.json();
    
    if (!data) {
        return null;
    }
    
    const addr = data.address || {};
    
    return {
        lat: parseFloat(data.lat),
        lon: parseFloat(data.lon),
        display_name: data.display_name,
        neighbourhood: addr.neighbourhood || addr.suburb || addr.village || addr.town || addr.city_district || '',
        city: addr.city || addr.town || addr.village || '',
        department: addr.county || addr.administrative || '',
        postcode: addr.postcode || ''
    };
};

module.exports = {
    geocodeAddress,
    reverseGeocode
};