// =============================================
// FIRE HYDRANTS MANAGEMENT SYSTEM
// =============================================
class HydrantsManager {
    constructor() {
        this.backendUrl = 'http://localhost:5000/api';
        this.hydrants = [];
        this.hazardRoads = [];
        this.hydrantMarkers = [];
        this.hazardRoadLayers = [];
        this.init();
    }

    async init() {
        await this.loadHydrants();
        await this.loadHazardRoads();
        this.setupEventListeners();
        this.renderHydrantsTable();
        
        // Wait for map to be initialized before displaying markers
        this.waitForMapAndDisplay();
    }
    
    waitForMapAndDisplay() {
        // Check if map exists and is a valid Leaflet map with addLayer method
        if (typeof map !== 'undefined' && map && typeof map.addLayer === 'function') {
            console.log('Map is ready, displaying hydrants and hazard roads');
            this.displayHydrantsOnMap();
            this.displayHazardRoadsOnMap();
        } else {
            // Wait and try again
            console.log('Map not ready yet, waiting...');
            setTimeout(() => this.waitForMapAndDisplay(), 100);
        }
    }

    setupEventListeners() {
        // Add Hydrant Button
        document.getElementById('addHydrantBtn')?.addEventListener('click', () => {
            this.showHydrantForm();
        });

        // Cancel Button
        document.getElementById('cancelHydrantBtn')?.addEventListener('click', () => {
            this.hideHydrantForm();
        });

        // Hydrant Form Submit
        document.getElementById('hydrantForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveHydrant();
        });

        // Search and Filter
        document.getElementById('hydrantSearch')?.addEventListener('input', () => {
            this.filterHydrants();
        });

        document.getElementById('hydrantStatusFilter')?.addEventListener('change', () => {
            this.filterHydrants();
        });
    }

    showHydrantForm(hydrant = null) {
        const formContainer = document.getElementById('hydrantFormContainer');
        const formTitle = document.getElementById('formTitle');
        const submitBtnText = document.getElementById('submitBtnText');
        
        formContainer.classList.remove('hidden');
        
        if (hydrant) {
            formTitle.textContent = 'Edit Hydrant';
            submitBtnText.textContent = 'Update Hydrant';
            document.getElementById('hydrantId').value = hydrant.id;
            document.getElementById('hydrantNumber').value = hydrant.number;
            document.getElementById('hydrantStatus').value = hydrant.status;
            document.getElementById('hydrantAddress').value = hydrant.address;
            document.getElementById('hydrantLat').value = hydrant.latitude;
            document.getElementById('hydrantLng').value = hydrant.longitude;
            document.getElementById('hydrantRemarks').value = hydrant.remarks || '';
        } else {
            formTitle.textContent = 'Add New Hydrant';
            submitBtnText.textContent = 'Save Hydrant';
            document.getElementById('hydrantForm').reset();
            document.getElementById('hydrantId').value = '';
        }
        
        formContainer.scrollIntoView({ behavior: 'smooth' });
    }

    hideHydrantForm() {
        document.getElementById('hydrantFormContainer').classList.add('hidden');
        document.getElementById('hydrantForm').reset();
    }

    async saveHydrant() {
        const hydrantId = document.getElementById('hydrantId').value;
        const data = {
            number: document.getElementById('hydrantNumber').value,
            address: document.getElementById('hydrantAddress').value,
            latitude: document.getElementById('hydrantLat').value,
            longitude: document.getElementById('hydrantLng').value,
            status: document.getElementById('hydrantStatus').value,
            remarks: document.getElementById('hydrantRemarks').value
        };

        try {
            let response;
            if (hydrantId) {
                // Update existing hydrant
                response = await fetch(`${this.backendUrl}/hydrants/${hydrantId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            } else {
                // Add new hydrant
                response = await fetch(`${this.backendUrl}/hydrants`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }

            if (response.ok) {
                await this.loadHydrants();
                this.renderHydrantsTable();
                this.displayHydrantsOnMap();
                this.hideHydrantForm();
                this.showNotification(hydrantId ? 'Hydrant updated successfully!' : 'Hydrant added successfully!');
            } else {
                throw new Error('Failed to save hydrant');
            }
        } catch (error) {
            console.error('Error saving hydrant:', error);
            this.showNotification('Error saving hydrant. Please try again.', true);
        }
    }

    async loadHydrants() {
        try {
            const response = await fetch(`${this.backendUrl}/hydrants`);
            if (response.ok) {
                const result = await response.json();
                this.hydrants = result.hydrants || [];
                console.log(`Loaded ${this.hydrants.length} hydrants`);
            }
        } catch (error) {
            console.error('Error loading hydrants:', error);
            this.hydrants = [];
        }
    }

    async deleteHydrant(id) {
        if (!confirm('Are you sure you want to delete this hydrant?')) {
            return;
        }

        try {
            const response = await fetch(`${this.backendUrl}/hydrants/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadHydrants();
                this.renderHydrantsTable();
                this.displayHydrantsOnMap();
                this.showNotification('Hydrant deleted successfully!');
            } else {
                throw new Error('Failed to delete hydrant');
            }
        } catch (error) {
            console.error('Error deleting hydrant:', error);
            this.showNotification('Error deleting hydrant. Please try again.', true);
        }
    }

    renderHydrantsTable() {
        const tbody = document.getElementById('hydrantsTableBody');
        if (!tbody) return;

        if (this.hydrants.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                        <i data-feather="droplet" class="w-12 h-12 mx-auto mb-2 text-gray-300"></i>
                        <p>No hydrants found. Click "Add Hydrant" to get started.</p>
                    </td>
                </tr>
            `;
            if (typeof feather !== 'undefined') feather.replace();
            return;
        }

        tbody.innerHTML = this.hydrants.map(hydrant => `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3 font-semibold">${hydrant.number}</td>
                <td class="px-4 py-3 text-sm">${hydrant.address}</td>
                <td class="px-4 py-3 text-sm">${hydrant.latitude.toFixed(6)}, ${hydrant.longitude.toFixed(6)}</td>
                <td class="px-4 py-3">
                    <span class="status-badge status-${hydrant.status}">
                        ${hydrant.status.toUpperCase()}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm">${hydrant.remarks || '-'}</td>
                <td class="px-4 py-3 text-center">
                    <button onclick="hydrantsManager.showHydrantForm(${JSON.stringify(hydrant).replace(/"/g, '&quot;')})"
                        class="text-blue-600 hover:text-blue-800 mr-2">
                        <i data-feather="edit-2" class="w-4 h-4 inline"></i>
                    </button>
                    <button onclick="hydrantsManager.deleteHydrant(${hydrant.id})"
                        class="text-red-600 hover:text-red-800">
                        <i data-feather="trash-2" class="w-4 h-4 inline"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        if (typeof feather !== 'undefined') feather.replace();
    }

    filterHydrants() {
        const searchTerm = document.getElementById('hydrantSearch')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('hydrantStatusFilter')?.value || 'all';

        const filtered = this.hydrants.filter(hydrant => {
            const matchesSearch = 
                hydrant.number.toLowerCase().includes(searchTerm) ||
                hydrant.address.toLowerCase().includes(searchTerm) ||
                (hydrant.remarks && hydrant.remarks.toLowerCase().includes(searchTerm));
            
            const matchesStatus = statusFilter === 'all' || hydrant.status === statusFilter;

            return matchesSearch && matchesStatus;
        });

        const tbody = document.getElementById('hydrantsTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                        <p>No hydrants match your search criteria.</p>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = filtered.map(hydrant => `
                <tr class="border-b hover:bg-gray-50">
                    <td class="px-4 py-3 font-semibold">${hydrant.number}</td>
                    <td class="px-4 py-3 text-sm">${hydrant.address}</td>
                    <td class="px-4 py-3 text-sm">${hydrant.latitude.toFixed(6)}, ${hydrant.longitude.toFixed(6)}</td>
                    <td class="px-4 py-3">
                        <span class="status-badge status-${hydrant.status}">
                            ${hydrant.status.toUpperCase()}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-sm">${hydrant.remarks || '-'}</td>
                    <td class="px-4 py-3 text-center">
                        <button onclick="hydrantsManager.showHydrantForm(${JSON.stringify(hydrant).replace(/"/g, '&quot;')})"
                            class="text-blue-600 hover:text-blue-800 mr-2">
                            <i data-feather="edit-2" class="w-4 h-4 inline"></i>
                        </button>
                        <button onclick="hydrantsManager.deleteHydrant(${hydrant.id})"
                            class="text-red-600 hover:text-red-800">
                            <i data-feather="trash-2" class="w-4 h-4 inline"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        if (typeof feather !== 'undefined') feather.replace();
    }

    displayHydrantsOnMap() {
        if (typeof map === 'undefined' || !map) {
            console.warn('Map not available for displaying hydrants');
            return;
        }

        // Clear existing markers
        this.hydrantMarkers.forEach(marker => map.removeLayer(marker));
        this.hydrantMarkers = [];

        console.log(`Displaying ${this.hydrants.length} hydrants on map`);

        // Add hydrant markers
        this.hydrants.forEach(hydrant => {
            const icon = L.divIcon({
                html: `<div style="background-color: ${this.getStatusColor(hydrant.status)}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                className: 'hydrant-marker',
                iconSize: [24, 24]
            });

            try {
                const marker = L.marker([hydrant.latitude, hydrant.longitude], { icon })
                    .bindPopup(`
                        <div class="p-2">
                            <h4 class="font-bold text-blue-800 mb-1">🚰 ${hydrant.number}</h4>
                            <p class="text-sm mb-1"><strong>Address:</strong> ${hydrant.address}</p>
                            <p class="text-sm mb-1"><strong>Status:</strong> 
                                <span class="status-badge status-${hydrant.status}">${hydrant.status}</span>
                            </p>
                            ${hydrant.remarks ? `<p class="text-sm"><strong>Remarks:</strong> ${hydrant.remarks}</p>` : ''}
                        </div>
                    `);

                // Check if map is a valid Leaflet map before adding marker
                if (map && typeof map.addLayer === 'function') {
                    marker.addTo(map);
                    this.hydrantMarkers.push(marker);
                } else {
                    console.error('Map is not a valid Leaflet map object');
                }
            } catch (error) {
                console.error(`Error adding hydrant ${hydrant.number}:`, error);
            }
        });
    }

    getStatusColor(status) {
        const normalized = (status || '').toLowerCase();
        const colors = {
            operational: '#2563eb', // blue for working hydrants
            maintenance: '#f59e0b',
            damaged: '#ef4444',
            inactive: '#6b7280',
            unserviceable: '#ef4444' // treat unserviceable as red
        };
        return colors[normalized] || '#6b7280';
    }

    // =============================================
    // HAZARD ROADS MANAGEMENT
    // =============================================
    async loadHazardRoads() {
        try {
            const response = await fetch(`${this.backendUrl}/hazard-roads`);
            if (response.ok) {
                const result = await response.json();
                this.hazardRoads = result.hazard_roads || [];
                console.log(`Loaded ${this.hazardRoads.length} hazard roads`);
            }
        } catch (error) {
            console.error('Error loading hazard roads:', error);
            this.hazardRoads = [];
        }
    }

    displayHazardRoadsOnMap() {
        if (typeof map === 'undefined' || !map) {
            console.warn('Map not available for displaying hazard roads');
            return;
        }

        // Clear existing layers
        this.hazardRoadLayers.forEach(layer => map.removeLayer(layer));
        this.hazardRoadLayers = [];

        console.log(`Displaying ${this.hazardRoads.length} hazard roads on map`);

        // Add hazard road polylines
        this.hazardRoads.forEach(road => {
            const color = road.severity === 'high' ? '#ef4444' : 
                          road.severity === 'medium' ? '#f59e0b' : '#6b7280';

            const polyline = L.polyline(road.coordinates, {
                color: color,
                weight: 6,
                opacity: 0.7,
                dashArray: '10, 10'
            }).bindPopup(`
                <div class="p-2">
                    <h4 class="font-bold text-red-800 mb-1">⚠️ ${road.name}</h4>
                    <p class="text-sm mb-1"><strong>Reason:</strong> ${road.reason}</p>
                    <p class="text-sm"><strong>Severity:</strong> 
                        <span class="status-badge status-${road.severity}">${road.severity.toUpperCase()}</span>
                    </p>
                </div>
            `);

            // Check if map is a valid Leaflet map before adding polyline
            if (map && typeof map.addLayer === 'function') {
                polyline.addTo(map);
                this.hazardRoadLayers.push(polyline);
            } else {
                console.error('Map is not a valid Leaflet map object for hazard roads');
            }
        });
    }

    showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.className = `fixed top-20 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${
            isError ? 'bg-red-500' : 'bg-green-500'
        } text-white`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize hydrants manager when DOM is ready
let hydrantsManager;
document.addEventListener('DOMContentLoaded', () => {
    hydrantsManager = new HydrantsManager();
});
