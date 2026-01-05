// =============================================
// NAVIGATION SYSTEM
// =============================================
// Navigation function
function switchSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        section.classList.add('hidden');
    });
    // Show selected section
    const activeSection = document.getElementById(`${sectionName}-section`);
    if (activeSection) {
        activeSection.classList.remove('hidden');
        activeSection.classList.add('active');
    }
    // Update navigation buttons
    document.querySelectorAll('.nav-btn, .nav-btn-mobile').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.section === sectionName) {
            btn.classList.add('active');
        }
    });
    // Close mobile sidebar when navigating
    if (window.innerWidth < 768) {
        toggleSidebar();
    }
    // Refresh map if switching to dashboard
    if (sectionName === 'dashboard' && map) {
        setTimeout(() => {
            map.invalidateSize();
            // Refresh hydrants and hazard roads display if manager is available
            if (typeof hydrantsManager !== 'undefined' && hydrantsManager) {
                hydrantsManager.displayHydrantsOnMap();
                hydrantsManager.displayHazardRoadsOnMap();
            }
        }, 300);
    }
    // Initialize report form when switching to incidents section
    if (sectionName === 'incidents') {
        setTimeout(initializeReportForm, 100);
    }
    // Persist current section to localStorage
    localStorage.setItem('currentSection', sectionName);
}
// =============================================
// ENHANCED FIRE INCIDENT LEARNING SYSTEM WITH LIVE ACCURACY
// =============================================
// Enhanced RealFireIncidentLearner class with working feedback system
class RealFireIncidentLearner {
    constructor() {
        this.model = null;
        this.isTraining = false;
        this.trainingData = [];
        this.modelAccuracy = 0;
        this.backendUrl = 'http://localhost:5000/api';
        // Load existing data and check model status on initialization
        this.loadIncidents();
        this.checkModelStatus();
        // Auto-refresh accuracy every 30 seconds
        setInterval(() => {
            if (this.modelAccuracy > 0) {
                this.checkModelStatus();
            }
        }, 30000);
    }
    // Check current model status from backend
    async checkModelStatus() {
        try {
            const response = await fetch(`${this.backendUrl}/model-status`);
            if (response.ok) {
                const result = await response.json();
                this.modelAccuracy = result.accuracy || result.current_accuracy || 0;
                console.log('Model status checked. Accuracy:', this.modelAccuracy);
                this.updateUI();
            }
        } catch (error) {
            console.error('Error checking model status:', error);
        }
    }
    // Load incidents from backend or local storage
    async loadIncidents() {
        try {
            const response = await fetch(`${this.backendUrl}/incidents`);
            if (response.ok) {
                const result = await response.json();
                this.trainingData = result.incidents || [];
                console.log(`Loaded ${this.trainingData.length} incidents from backend`);
            } else {
                this.trainingData = JSON.parse(localStorage.getItem('fireIncidents') || '[]');
            }
        } catch (error) {
            console.error('Load incidents error:', error);
            this.trainingData = JSON.parse(localStorage.getItem('fireIncidents') || '[]');
        }
        this.updateUI();
        return this.trainingData;
    }
    // Train model with real ML
    async trainModel(incidents) {
        if (incidents.length < 5) {
            this.showNotification(`Need at least 5 incidents. Currently have ${incidents.length}`, true);
            return false;
        }
        this.isTraining = true;
        this.updateUI();
        try {
            const response = await fetch(`${this.backendUrl}/train`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ incidents: incidents })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Training failed');
            }
            this.modelAccuracy = result.accuracy || result.r2 || 0;
    
            let message = `Model trained successfully! Accuracy: ${(this.modelAccuracy * 100).toFixed(1)}%`;
            if (result.baseline_performance && result.baseline_performance.r2) {
                const r2 = (result.baseline_performance.r2 * 100).toFixed(1);
                message += ` (R²: ${r2}%)`;
            }
            this.showNotification(message);
    
            // Get and display training feedback
            const trainingFeedback = await this.getTrainingFeedback();
            this.displayTrainingFeedback(trainingFeedback);
    
            this.updateUI();
            return true;
    
        } catch (error) {
            console.error('Training error:', error);
            this.showNotification(`Training failed: ${error.message}`, true);
            return false;
        } finally {
            this.isTraining = false;
            this.updateUI();
        }
    }
    // Enhanced performance feedback display
    displayComprehensiveFeedback(feedback) {
        console.log('Displaying comprehensive feedback:', feedback);
   
        const container = document.getElementById('performanceFeedback');
        if (!container) {
            console.error('Performance feedback container not found!');
            return;
        }
        const analysis = feedback.performance_analysis;
        const suggestions = feedback.improvement_suggestions || [];
        const trainingRecs = feedback.training_recommendations || [];
        const successes = feedback.success_factors || [];
        const metrics = feedback.comparison_metrics || {};
        let html = '';
        // Performance Summary Card
        html += this.createPerformanceSummary(analysis, metrics);
        // Success Factors (what went well)
        if (successes.length > 0) {
            html += this.createSuccessFactorsSection(successes);
        }
        // Improvement Suggestions
        if (suggestions.length > 0) {
            html += this.createImprovementSuggestionsSection(suggestions);
        }
        // Training Recommendations
        if (trainingRecs.length > 0) {
            html += this.createTrainingRecommendationsSection(trainingRecs);
        }
        // Metrics Overview
        html += this.createMetricsOverview(metrics);
        container.innerHTML = html;
   
        // Replace feather icons
        setTimeout(() => {
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }, 100);
    }
    createPerformanceSummary(analysis, metrics) {
        const colorConfig = {
            'excellent': { bg: 'green', icon: 'award' },
            'good': { bg: 'blue', icon: 'thumbs-up' },
            'average': { bg: 'yellow', icon: 'activity' },
            'needs_improvement': { bg: 'orange', icon: 'alert-circle' },
            'poor': { bg: 'red', icon: 'alert-triangle' }
        };
        const config = colorConfig[analysis.status] || colorConfig.average;
        return `
            <div class="bg-${config.bg}-50 border-l-4 border-${config.bg}-500 p-6 mb-6 rounded-lg">
                <div class="flex items-center mb-4">
                    <i data-feather="${config.icon}" class="w-8 h-8 text-${config.bg}-500 mr-3"></i>
                    <div>
                        <h3 class="text-xl font-bold text-${config.bg}-800">Performance Summary</h3>
                        <p class="text-${config.bg}-700">${analysis.message}</p>
                    </div>
                </div>
           
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-gray-900">${metrics.current_response_time || '--'}</div>
                        <div class="text-sm text-gray-600">Your Time (min)</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-gray-900">${metrics.expected_response_time || '--'}</div>
                        <div class="text-sm text-gray-600">Expected (min)</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold ${metrics.time_difference > 0 ? 'text-red-600' : 'text-green-600'}">
                            ${metrics.time_difference > 0 ? '+' : ''}${metrics.time_difference || '--'}
                        </div>
                        <div class="text-sm text-gray-600">Difference</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-gray-900">${metrics.similar_incidents_count || '--'}</div>
                        <div class="text-sm text-gray-600">Compared With</div>
                    </div>
                </div>
                ${analysis.improvement_opportunity > 0 ? `
                    <div class="mt-4 p-3 bg-${config.bg}-100 rounded">
                        <p class="text-${config.bg}-800 font-semibold">
                            💡 Improvement Opportunity: ${analysis.improvement_opportunity.toFixed(1)} minutes
                        </p>
                    </div>
                ` : ''}
            </div>
        `;
    }
    createSuccessFactorsSection(successes) {
        let html = `
            <div class="bg-green-50 border-l-4 border-green-500 p-6 mb-6 rounded-lg">
                <div class="flex items-center mb-4">
                    <i data-feather="check-circle" class="w-6 h-6 text-green-500 mr-2"></i>
                    <h3 class="text-lg font-bold text-green-800">What Went Well</h3>
                </div>
                <div class="space-y-4">
        `;
        successes.forEach(success => {
            html += `
                <div class="bg-white p-4 rounded-lg border border-green-200">
                    <h4 class="font-semibold text-green-700 mb-2">${success.message}</h4>
                    <div class="mt-3">
                        <h5 class="text-sm font-medium text-green-600 mb-2">Best Practices to Continue:</h5>
                        <ul class="text-sm text-green-700 space-y-1">
                            ${success.best_practices.map(practice => `
                                <li class="flex items-start">
                                    <i data-feather="check" class="w-4 h-4 text-green-500 mr-2 mt-0.5"></i>
                                    <span>${practice}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        });
        html += `</div></div>`;
        return html;
    }
    createImprovementSuggestionsSection(suggestions) {
        let html = `
            <div class="mb-8">
                <div class="flex items-center mb-4">
                    <i data-feather="target" class="w-6 h-6 text-blue-500 mr-2"></i>
                    <h3 class="text-lg font-bold text-gray-800">Improvement Suggestions</h3>
                </div>
                <div class="space-y-4">
        `;
        // Sort by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        suggestions.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
        suggestions.forEach(suggestion => {
            const priorityConfig = {
                high: { color: 'red', badge: '🚨 HIGH PRIORITY' },
                medium: { color: 'yellow', badge: '📊 MEDIUM PRIORITY' },
                low: { color: 'blue', badge: '💡 LOW PRIORITY' }
            };
            const config = priorityConfig[suggestion.priority] || priorityConfig.medium;
            html += `
                <div class="border-l-4 border-${config.color}-500 bg-white p-5 rounded-lg shadow-sm">
                    <div class="flex justify-between items-start mb-3">
                        <h4 class="font-bold text-gray-800 text-lg">${suggestion.title}</h4>
                        <span class="px-3 py-1 text-xs font-semibold rounded-full bg-${config.color}-100 text-${config.color}-800">
                            ${config.badge}
                        </span>
                    </div>
               
                    <p class="text-gray-600 mb-4">${suggestion.description}</p>
               
                    <div class="mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">Actionable Steps:</h5>
                        <ul class="space-y-2">
                            ${suggestion.actionable_steps.map(step => `
                                <li class="flex items-start text-sm text-gray-700">
                                    <i data-feather="check-circle" class="w-4 h-4 text-${config.color}-500 mr-2 mt-0.5"></i>
                                    <span>${step}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
               
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div class="bg-gray-50 p-2 rounded">
                            <span class="font-medium">Expected Impact:</span> ${suggestion.expected_impact}
                        </div>
                        <div class="bg-gray-50 p-2 rounded">
                            <span class="font-medium">Difficulty:</span> ${suggestion.implementation_difficulty}
                        </div>
                        <div class="bg-gray-50 p-2 rounded">
                            <span class="font-medium">Timeline:</span> ${suggestion.time_to_implement}
                        </div>
                    </div>
                </div>
            `;
        });
        html += `</div></div>`;
        return html;
    }
    createTrainingRecommendationsSection(recommendations) {
        let html = `
            <div class="bg-purple-50 border-l-4 border-purple-500 p-6 mb-6 rounded-lg">
                <div class="flex items-center mb-4">
                    <i data-feather="book-open" class="w-6 h-6 text-purple-500 mr-2"></i>
                    <h3 class="text-lg font-bold text-purple-800">Training & Development</h3>
                </div>
                <div class="space-y-4">
        `;
        recommendations.forEach(rec => {
            const priorityColor = rec.priority === 'high' ? 'red' : 'yellow';
       
            html += `
                <div class="bg-white p-4 rounded-lg border border-purple-200">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-semibold text-purple-700">${rec.title}</h4>
                        <span class="px-2 py-1 text-xs rounded-full bg-${priorityColor}-100 text-${priorityColor}-800">
                            ${rec.priority.toUpperCase()} PRIORITY
                        </span>
                    </div>
                    <p class="text-purple-600 mb-3">${rec.description}</p>
                    <div class="mb-3">
                        <h5 class="text-sm font-medium text-purple-600 mb-1">Recommended Actions:</h5>
                        <ul class="text-sm text-purple-700 space-y-1">
                            ${rec.actions.map(action => `
                                <li class="flex items-start">
                                    <i data-feather="check" class="w-4 h-4 text-purple-500 mr-2 mt-0.5"></i>
                                    <span>${action}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    <div class="text-sm text-purple-600">
                        <span class="font-medium">Benefits:</span> ${rec.benefits}
                    </div>
                </div>
            `;
        });
        html += `</div></div>`;
        return html;
    }
    createMetricsOverview(metrics) {
        return `
            <div class="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                <h4 class="font-semibold text-gray-700 mb-3">Analysis Details</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div class="text-center">
                        <div class="text-lg font-bold text-gray-900">${metrics.similar_incidents_count || '--'}</div>
                        <div class="text-gray-600">Incidents Analyzed</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold text-gray-900">${metrics.performance_ratio ? metrics.performance_ratio.toFixed(2) : '--'}</div>
                        <div class="text-gray-600">Performance Ratio</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold ${metrics.time_difference > 0 ? 'text-red-600' : 'text-green-600'}">
                            ${metrics.time_difference > 0 ? '+' : ''}${metrics.time_difference || '--'}
                        </div>
                        <div class="text-gray-600">Time Difference (min)</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold text-gray-900">${new Date().toLocaleDateString()}</div>
                        <div class="text-gray-600">Analysis Date</div>
                    </div>
                </div>
            </div>
        `;
    }
    // Store incident in backend - FIXED FEEDBACK DISPLAY
    async storeIncident(incidentData) {
        try {
            console.log('Storing incident:', incidentData);
            const response = await fetch(`${this.backendUrl}/incidents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(incidentData)
            });
      
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || 'Failed to store incident');
            }
      
            const result = await response.json();
            console.log('Incident stored successfully:', result);
       
            // Add to local training data with proper ID and timestamp
            const newIncident = {
                ...incidentData,
                id: result.id || this.trainingData.length + 1,
                timestamp: result.timestamp || new Date().toISOString()
            };
      
            this.trainingData.push(newIncident);
      
            // Get COMPREHENSIVE performance feedback
            let feedbackResult = null;
            try {
                console.log('Requesting comprehensive performance feedback...');
                const feedbackResponse = await fetch(`${this.backendUrl}/comprehensive-feedback`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        incident_data: {
                            ...newIncident,
                            response_time: newIncident.response_time_min, // Ensure response_time is set
                            distance: newIncident.distance,
                            type: newIncident.type_of_occupancy,
                            weather: newIncident.weather_condition
                        }
                    })
                });
           
                if (feedbackResponse.ok) {
                    feedbackResult = await feedbackResponse.json();
                    console.log('Comprehensive feedback received:', feedbackResult);
                } else {
                    console.warn('Feedback response not OK:', feedbackResponse.status);
                    feedbackResult = {
                        status: 'no_data',
                        message: 'Not enough data for comprehensive analysis yet. Continue recording incidents.'
                    };
                }
            } catch (feedbackError) {
                console.warn('Could not get comprehensive feedback:', feedbackError);
                feedbackResult = {
                    status: 'no_data',
                    message: 'Not enough data for comprehensive analysis yet. Continue recording incidents.'
                };
            }
      
            // Display the comprehensive feedback
            if (feedbackResult) {
                console.log('Displaying comprehensive feedback...');
                this.displayComprehensiveFeedback(feedbackResult);
            }
       
            // Auto-train every 5 incidents
            if (this.trainingData.length >= 5 && this.trainingData.length % 5 === 0) {
                try {
                    await this.trainModel(this.trainingData);
                    console.log(`Auto-trained after ${this.trainingData.length} incidents`);
          
                    // Get updated feedback after training
                    const updatedFeedback = await this.getComprehensiveFeedback(newIncident);
                    if (updatedFeedback) {
                        this.displayComprehensiveFeedback(updatedFeedback);
                    }
                } catch (trainError) {
                    console.warn('Auto-train failed:', trainError);
                }
            }
      
            this.updateUI();
            return result;
      
        } catch (error) {
            console.error('Storage error:', error);
            // Fallback to local storage if backend is unavailable
            const localResult = this.storeIncidentLocally(incidentData);
            this.showNotification('Incident saved locally (backend unavailable)', true);
            return localResult;
        }
    }
    // Get comprehensive feedback from backend - ENHANCED DEBUGGING
    async getComprehensiveFeedback(incidentData) {
        try {
            console.log('Getting comprehensive feedback for incident:', incidentData);
      
            const response = await fetch(`${this.backendUrl}/comprehensive-feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ incident_data: incidentData })
            });
      
            console.log('Feedback response status:', response.status);
      
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Feedback API error:', errorText);
                throw new Error(`Failed to get feedback: ${response.status}`);
            }
      
            const result = await response.json();
            console.log('Comprehensive feedback result:', result);
            return result;
      
        } catch (error) {
            console.error('Error getting comprehensive feedback:', error);
            return {
                status: 'error',
                message: 'Feedback analysis temporarily unavailable'
            };
        }
    }
    // Get training feedback
    async getTrainingFeedback() {
        try {
            const response = await fetch(`${this.backendUrl}/training-feedback`);
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to get training feedback');
            }
            return result;
        } catch (error) {
            console.error('Error getting training feedback:', error);
            return {
                status: 'error',
                message: 'Training feedback unavailable'
            };
        }
    }
    // Display training feedback
    displayTrainingFeedback(feedback) {
        const container = document.getElementById('trainingFeedback');
        if (!container) {
            console.error('Training feedback container not found!');
            return;
        }
        const statusConfig = {
            'excellent': { color: 'green', icon: 'award' },
            'good': { color: 'blue', icon: 'thumbs-up' },
            'fair': { color: 'yellow', icon: 'trending-up' },
            'needs_improvement': { color: 'red', icon: 'alert-triangle' },
            'not_trained': { color: 'gray', icon: 'help-circle' }
        };
        const config = statusConfig[feedback.status] || statusConfig.not_trained;
        let html = `
            <div class="bg-${config.color}-50 border-l-4 border-${config.color}-500 p-4 mb-4">
                <div class="flex items-center mb-2">
                    <i data-feather="${config.icon}" class="w-5 h-5 text-${config.color}-500 mr-2"></i>
                    <h4 class="font-semibold text-${config.color}-800">Model Training Status</h4>
                </div>
                <p class="text-${config.color}-700 mb-3">${feedback.message}</p>
        `;
        if (feedback.metrics) {
            html += `
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="font-medium">Accuracy:</span> ${(feedback.metrics.accuracy * 100).toFixed(1)}%
                    </div>
                    <div>
                        <span class="font-medium">Prediction Quality:</span> ${feedback.metrics.r2_score.toFixed(3)}
                    </div>
                </div>
            `;
        }
        if (feedback.recommendations && feedback.recommendations.length > 0) {
            html += `<div class="mt-3 space-y-2">`;
            feedback.recommendations.forEach(rec => {
                html += `
                    <div class="flex items-start text-sm">
                        <i data-feather="lightbulb" class="w-4 h-4 text-${config.color}-500 mt-0.5 mr-2"></i>
                        <span class="text-${config.color}-700">${rec.suggestion}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
        html += `</div>`;
        container.innerHTML = html;
        // Replace feather icons
        setTimeout(() => {
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }, 100);
    }
    // Fallback local storage
    storeIncidentLocally(incidentData) {
        const incidents = JSON.parse(localStorage.getItem('fireIncidents') || '[]');
        incidentData.id = Date.now();
        incidentData.timestamp = new Date().toISOString();
        incidents.push(incidentData);
        localStorage.setItem('fireIncidents', JSON.stringify(incidents));
        // Update local training data
        this.trainingData = incidents;
        this.updateUI();
        return {
            message: 'Incident stored locally',
            id: incidentData.id,
            local: true
        };
    }
    // Update UI with real metrics
    updateUI() {
        // Update training count
        const trainingCountElement = document.getElementById('trainingCount');
        if (trainingCountElement) {
            trainingCountElement.textContent = `${this.trainingData.length} incidents`;
        }
        // Update progress bar (cap at 100 incidents for visualization)
        const progress = Math.min((this.trainingData.length / 100) * 100, 100);
        const trainingProgressElement = document.getElementById('trainingProgress');
        if (trainingProgressElement) {
            trainingProgressElement.style.width = `${progress}%`;
        }
        // Update model accuracy
        const modelAccuracyElement = document.getElementById('modelAccuracy');
        if (modelAccuracyElement) {
            // Convert to percentage and format
            const accuracyPercent = (this.modelAccuracy * 100).toFixed(1);
            modelAccuracyElement.textContent = `${accuracyPercent}%`;
        }
        const accuracyBarElement = document.getElementById('accuracyBar');
        if (accuracyBarElement) {
            accuracyBarElement.style.width = `${this.modelAccuracy * 100}%`;
        }
        // Update last retrained
        const lastRetrainedElement = document.getElementById('lastRetrained');
        if (lastRetrainedElement) {
            lastRetrainedElement.textContent = new Date().toLocaleString();
        }
        // Update model status
        const statusElement = document.getElementById('modelStatus');
        if (statusElement) {
            if (this.isTraining) {
                statusElement.textContent = 'Training...';
                statusElement.className = 'training-status status-training';
            } else if (this.modelAccuracy > 0) {
                statusElement.textContent = 'Ready';
                statusElement.className = 'training-status status-ready';
            } else {
                statusElement.textContent = 'Needs Training';
                statusElement.className = 'training-status status-error';
            }
        }
        // Update recent incidents
        this.updateRecentIncidents();
    }
    // Update recent incidents display
    updateRecentIncidents() {
        const container = document.getElementById('recentIncidents');
        if (!container) return;
        // Get last 5 incidents
        const recentIncidents = [...this.trainingData]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5);
    
        if (recentIncidents.length === 0) {
            container.innerHTML = `
                <div class="text-center py-2 text-gray-500 text-sm">
                    No incidents recorded yet
                </div>
            `;
            return;
        }
        container.innerHTML = recentIncidents.map(incident => `
            <div class="incident-item recent">
                <div class="flex justify-between items-start">
                    <span class="font-medium text-xs">${incident.type_of_occupancy || incident.type}</span>
                    <span class="text-xs text-gray-500">${this.formatTime(incident.timestamp)}</span>
                </div>
                <div class="text-xs text-gray-600">Response: ${incident.response_time_min || incident.response_time}min</div>
                <div class="text-xs text-gray-500">Distance: ${incident.distance}km</div>
            </div>
        `).join('');
    }
    // Format timestamp for display
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    }
    // Show training notification
    showNotification(message, isError = false) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white z-50 transform transition-transform duration-300 ${
            isError ? 'bg-red-500' : 'bg-green-500'
        }`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i data-feather="${isError ? 'alert-triangle' : 'check-circle'}" class="w-5 h-5 mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(notification);
        // Replace feather icons
        setTimeout(() => {
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }, 100);
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
    // Test function to check backend connection
    async testBackendConnection() {
        try {
            console.log('🔍 Testing backend connection...');
            const response = await fetch(`${this.backendUrl}/test`);
            const result = await response.json();
            console.log('✅ Backend connection test:', result);
            return result;
        } catch (error) {
            console.error('❌ Backend connection failed:', error);
            return { error: error.message };
        }
    }
    // Test function for feedback system
    async testFeedbackSystem() {
        try {
            console.log('🔍 Testing feedback system...');
            const testIncident = {
                location: 'Test Location',
                type_of_occupancy: 'Residential',
                response_time_min: 5,
                distance: 0.2,
                temperature_c: 30,
                humidity_pct: 73,
                wind_speed_kmh: 12.5,
                weather_condition: 'Sunny',
                road_condition: 'Dry'
            };
        
            const response = await fetch(`${this.backendUrl}/test-feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ incident_data: testIncident })
            });
        
            const result = await response.json();
            console.log('✅ Feedback system test:', result);
        
            // Display the test feedback
            this.displayComprehensiveFeedback(result);
            return result;
        } catch (error) {
            console.error('❌ Feedback system test failed:', error);
            return { error: error.message };
        }
    }
}
// =============================================
// MAP AND NAVIGATION SYSTEM (UPDATED FOR AUTO LOCATION)
// =============================================
// Map and navigation variables
let map;
let currentLocationMarker;
let destinationMarker;
let routingControl;
let watchId;
let isTracking = false;
let currentWeatherData = null;
let destinationLatLng = null;
// Current position tracking
let currentPosition = null;
let previousPosition = null;
let currentSpeed = 0;
let currentHeading = 0;
// Hydrant variables
let nearestHydrantMarker = null;
let hydrantLine = null;
// Search variables
let searchTimeout = null;
// Route variables
let currentRouteIndex = 0;
let alternativeRoutes = [];
let routeLayers = [];
// Enhanced Incident Learning System with Real ML
let incidentLearner;
// Define bounding box for Santa Cruz, Laguna area
const SANTA_CRUZ_BOUNDS = {
    southWest: [14.20, 121.35], // Southwest corner (lat, lng)
    northEast: [14.32, 121.45] // Northeast corner (lat, lng)
};
// Fire hydrant data from the CSV
const fireHydrants = [
    {Latitude: 14.280248, Longitude: 121.394529, "Present Condition": "Operational", Remarks: "Low Pressure"},
    {Latitude: 14.280069, Longitude: 121.394703, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.273128, Longitude: 121.400478, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.271956, Longitude: 121.399617, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.271853, Longitude: 121.399576, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.26305, Longitude: 121.40111, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.27774, Longitude: 121.411473, "Present Condition": "Operational", Remarks: "Low Pressure"},
    {Latitude: 14.253727, Longitude: 121.380829, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.248357, Longitude: 121.378854, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.244188, Longitude: 121.403141, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.272753, Longitude: 121.421359, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.250796, Longitude: 121.415993, "Present Condition": "Operational", Remarks: "Low Pressure"},
    {Latitude: 14.278958, Longitude: 121.415888, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.286795, Longitude: 121.411203, "Present Condition": "Operational", Remarks: "Low Pressure"},
    {Latitude: 14.287409, Longitude: 121.411705, "Present Condition": "Operational", Remarks: "Low Pressure"},
    {Latitude: 14.277512, Longitude: 121.419285, "Present Condition": "Unserviceable", Remarks: "Unserviceable"},
    {Latitude: 14.275834, Longitude: 121.419642, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.279892, Longitude: 121.415254, "Present Condition": "Operational", Remarks: "Low pressure"},
    {Latitude: 14.281046, Longitude: 121.416473, "Present Condition": "Operational", Remarks: "Low pressure"},
    {Latitude: 14.281227, Longitude: 121.416456, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.281045, Longitude: 121.416963, "Present Condition": "Operational", Remarks: "Low pressure"},
    {Latitude: 14.28098, Longitude: 121.416969, "Present Condition": "Operational", Remarks: "Low pressure"},
    {Latitude: 14.280987, Longitude: 121.416969, "Present Condition": "Operational", Remarks: "Low pressure"},
    {Latitude: 14.285525, Longitude: 121.414276, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.285548, Longitude: 121.4143, "Present Condition": "Operational", Remarks: "Low pressure"},
    {Latitude: 14.284434, Longitude: 121.414435, "Present Condition": "Unserviceable", Remarks: "Unserviceable"},
    {Latitude: 14.285302, Longitude: 121.412797, "Present Condition": "Unserviceable", Remarks: "Unserviceable"},
    {Latitude: 14.287687, Longitude: 121.411143, "Present Condition": "Unserviceable", Remarks: "Unserviceable"},
    {Latitude: 14.293597, Longitude: 121.407939, "Present Condition": "Operational", Remarks: "High Pressure"},
    {Latitude: 14.289195, Longitude: 121.413264, "Present Condition": "Unserviceable", Remarks: "Unserviceable"},
    {Latitude: 14.281298, Longitude: 121.410662, "Present Condition": "Operational", Remarks: "Low pressure"}
];
// Function to create custom hydrant icons
function createHydrantIcon(condition, isNearest = false) {
    let className = 'hydrant-icon operational';
    if (condition === 'Unserviceable') {
        className = 'hydrant-icon unserviceable';
    }
    if (isNearest) {
        className = 'hydrant-icon nearest';
    }
    const size = isNearest ? 32 : 24;
    // Create SVG for hydrant icon
    const svg = `
        <svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#3B82F6"/>
            <path d="M12 6C10.34 6 9 7.34 9 9C9 10.66 10.34 12 12 12C13.66 12 15 10.66 15 9C15 7.34 13.66 6 12 6Z" fill="white"/>
            <path d="M12 2V6" stroke="white" stroke-width="2"/>
            <path d="M9 9H15" stroke="white" stroke-width="2"/>
        </svg>
    `;
    return L.divIcon({
        className: 'hydrant-marker',
        html: svg,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
}
// Function to add fire hydrants to the map
function addFireHydrants() {
    fireHydrants.forEach(hydrant => {
        const marker = L.marker([hydrant.Latitude, hydrant.Longitude], {
            icon: createHydrantIcon(hydrant["Present Condition"])
        }).addTo(map);
        // Create popup content
        const popupContent = `
            <div class="p-2">
                <h4 class="font-bold text-sm">Fire Hydrant</h4>
                <p class="text-xs mt-1"><strong>Condition:</strong> ${hydrant["Present Condition"]}</p>
                <p class="text-xs"><strong>Remarks:</strong> ${hydrant.Remarks}</p>
                <p class="text-xs text-gray-600 mt-1">
                    <strong>Location:</strong> ${hydrant.Latitude.toFixed(6)}, ${hydrant.Longitude.toFixed(6)}
                </p>
            </div>
        `;
        marker.bindPopup(popupContent);
    });
}
// Function to find nearest hydrant to a given location
function findNearestHydrant(lat, lng) {
    let nearestHydrant = null;
    let minDistance = Infinity;
    fireHydrants.forEach(hydrant => {
        // Skip unserviceable hydrants
        if (hydrant["Present Condition"] === "Unserviceable") return;
        const distance = calculateDistance([lat, lng], [hydrant.Latitude, hydrant.Longitude]);
        if (distance < minDistance) {
            minDistance = distance;
            nearestHydrant = hydrant;
        }
    });
    return { hydrant: nearestHydrant, distance: minDistance };
}
// Function to highlight nearest hydrant - ONLY if within 50ft
function highlightNearestHydrant(lat, lng) {
    // Remove previous nearest hydrant marker and line
    if (nearestHydrantMarker) {
        map.removeLayer(nearestHydrantMarker);
    }
    if (hydrantLine) {
        map.removeLayer(hydrantLine);
    }
    // Find nearest hydrant
    const { hydrant, distance } = findNearestHydrant(lat, lng);
    if (!hydrant) {
        console.log("No operational hydrants found nearby");
        document.getElementById('nearestHydrantCard').classList.add('hidden');
        return;
    }
    // Convert distance to feet for comparison (1 km = 3280.84 feet)
    const distanceInFeet = distance * 3280.84;
    // Only highlight if hydrant is within 50 feet
    const isWithinRange = distanceInFeet <= 50;
    console.log(`Nearest hydrant is ${distanceInFeet.toFixed(0)} feet away - ${isWithinRange ? 'within range, highlighting' : 'too far, not highlighting'}`);
    if (isWithinRange) {
        // Add special marker for nearest hydrant
        nearestHydrantMarker = L.marker([hydrant.Latitude, hydrant.Longitude], {
            icon: createHydrantIcon(hydrant["Present Condition"], true)
        }).addTo(map);
        // Create popup content
        const popupContent = `
            <div class="p-2">
                <h4 class="font-bold text-sm text-green-600">Nearest Fire Hydrant</h4>
                <p class="text-xs mt-1"><strong>Distance:</strong> ${distanceInFeet.toFixed(0)} feet</p>
                <p class="text-xs"><strong>Condition:</strong> ${hydrant["Present Condition"]}</p>
                <p class="text-xs"><strong>Pressure:</strong> ${hydrant.Remarks}</p>
                <p class="text-xs text-gray-600 mt-1">
                    <strong>Location:</strong> ${hydrant.Latitude.toFixed(6)}, ${hydrant.Longitude.toFixed(6)}
                </p>
                <p class="text-xs text-green-600 mt-1 font-semibold">✓ Within 50 feet - Ready for connection</p>
            </div>
        `;
        nearestHydrantMarker.bindPopup(popupContent).openPopup();
        // Add connection line only if within range
        hydrantLine = L.polyline([
            [lat, lng],
            [hydrant.Latitude, hydrant.Longitude]
        ], {
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            dashArray: '5, 10'
        }).addTo(map);
    } else {
        console.log("Hydrant is beyond 50 feet - no highlighting or connection line");
    }
    // Update nearest hydrant info card regardless of distance
    updateNearestHydrantInfo(hydrant, distanceInFeet, isWithinRange);
    // Return whether highlighting was done
    return isWithinRange;
}
// Function to update nearest hydrant information card with distance in feet
function updateNearestHydrantInfo(hydrant, distanceInFeet, isWithinRange) {
    document.getElementById('nearestHydrantCard').classList.remove('hidden');
    document.getElementById('hydrant-distance').textContent = `${distanceInFeet.toFixed(0)} feet`;
    document.getElementById('hydrant-condition').textContent = hydrant["Present Condition"];
    document.getElementById('hydrant-pressure').textContent = hydrant.Remarks;
    document.getElementById('hydrant-coords').textContent = `${hydrant.Latitude.toFixed(4)}, ${hydrant.Longitude.toFixed(4)}`;
    const card = document.getElementById('nearestHydrantCard');
    if (isWithinRange) {
        // Change styling to indicate connection is possible
        card.style.background = '#dbeafe';
        card.style.borderLeft = '4px solid #10b981';
        card.classList.remove('warning');
        // Remove any existing warning message
        const existingWarning = document.getElementById('distance-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
        // Add success message if not already present
        const contentDiv = document.getElementById('nearest-hydrant-content');
        if (!document.getElementById('distance-success')) {
            const successDiv = document.createElement('div');
            successDiv.id = 'distance-success';
            successDiv.className = 'mt-2 p-2 bg-green-50 rounded text-xs text-green-700';
            successDiv.innerHTML = '<i data-feather="check-circle" class="w-3 h-3 inline mr-1"></i> Hydrant is within 50 feet - Ready for connection';
            contentDiv.appendChild(successDiv);
            feather.replace();
        }
    } else {
        // Change styling to indicate connection is NOT possible
        card.style.background = '#fef3c7';
        card.style.borderLeft = '4px solid #f59e0b';
        card.classList.add('warning');
        // Add warning message if not already present
        const contentDiv = document.getElementById('nearest-hydrant-content');
        if (!document.getElementById('distance-warning')) {
            const warningDiv = document.createElement('div');
            warningDiv.id = 'distance-warning';
            warningDiv.className = 'mt-2 p-2 bg-red-50 rounded text-xs text-red-700';
            warningDiv.innerHTML = '<i data-feather="alert-triangle" class="w-3 h-3 inline mr-1"></i> Hydrant is too far for connection (max 50 feet) - Not highlighted on map';
            contentDiv.appendChild(warningDiv);
            feather.replace();
        }
        // Remove success message if present
        const existingSuccess = document.getElementById('distance-success');
        if (existingSuccess) {
            existingSuccess.remove();
        }
    }
}
// Calculate distance between two points in km
function calculateDistance(point1, point2) {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}
// Initialize map with default view (will be updated with user's location)
function initMap() {
    // Check if map container exists
    if (!document.getElementById('map')) {
        console.error('Map container not found');
        return;
    }
    try {
        map = L.map('map').setView([14.272416030761997, 121.4014354512121], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);
        // Add fire hydrants to the map
        addFireHydrants();
        // Add map click handler AFTER map is initialized
        map.on('click', function(e) {
            setDestinationMarker(e.latlng);
        });
        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}
// Set destination marker at specified coordinates and AUTOMATICALLY CALCULATE ROUTE
function setDestinationMarker(latlng) {
    // Remove previous destination marker if exists
    if (destinationMarker) {
        map.removeLayer(destinationMarker);
    }
    // Add new destination marker
    destinationMarker = L.marker(latlng, {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        })
    }).addTo(map);
    destinationMarker.bindPopup(`<b>Incident Location</b><br>Lat: ${latlng.lat.toFixed(4)}, Lng: ${latlng.lng.toFixed(4)}`).openPopup();
    destinationLatLng = latlng;
    // Find and highlight nearest hydrant (only if within 50ft)
    const isHighlighted = highlightNearestHydrant(latlng.lat, latlng.lng);
    console.log('Destination set:', latlng);
    console.log(`Hydrant highlighted: ${isHighlighted ? 'YES (within 50ft)' : 'NO (beyond 50ft)'}`);
    // AUTOMATICALLY CALCULATE ROUTE if current position is available
    if (currentPosition) {
        const currentLatLng = [currentPosition.coords.latitude, currentPosition.coords.longitude];
        calculateRoute(currentLatLng, latlng);
        // Show loading state briefly
        const routeButton = document.getElementById('calculateRoute');
        const originalText = routeButton.innerHTML;
        routeButton.innerHTML = '<i data-feather="loader" class="w-4 h-4 md:w-5 md:h-5 animate-spin"></i><span>Route Calculated</span>';
        routeButton.disabled = true;
        feather.replace();
        // Restore button after delay
        setTimeout(() => {
            routeButton.innerHTML = originalText;
            routeButton.disabled = false;
            feather.replace();
        }, 2000);
    } else {
        // If no current position, show message and prompt for location
        console.log('No current position available for automatic routing');
        // Update button to indicate location is needed
        const routeButton = document.getElementById('calculateRoute');
        routeButton.innerHTML = '<i data-feather="navigation" class="w-4 h-4 md:w-5 md:h-5"></i><span>Enable Location for Route</span>';
        feather.replace();
        // Show brief notification
        showTemporaryNotification('Destination set! Enable location services to see the route.', false);
    }
}
// Show temporary notification
function showTemporaryNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white z-50 transform transition-all duration-300 ${
        isError ? 'bg-red-500' : 'bg-blue-500'
    }`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i data-feather="${isError ? 'alert-triangle' : 'info'}" class="w-5 h-5 mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    feather.replace();
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}
// Calculate route from current location to destination
function calculateRoute(startLatLng, endLatLng) {
    // Remove previous route if exists
    if (routingControl) {
        map.removeControl(routingControl);
    }
    // Clear previous routes
    alternativeRoutes = [];
    routeLayers.forEach(layer => {
        if (layer && map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    routeLayers = [];
    // Add new route
    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(startLatLng),
            L.latLng(endLatLng)
        ],
        routeWhileDragging: false,
        showAlternatives: true, // Enable alternative routes
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        lineOptions: {
            styles: [
                {color: '#b91c1c', opacity: 0.7, weight: 5}, // Main route
                {color: '#3b82f6', opacity: 0.5, weight: 3}, // Alternative 1
                {color: '#10b981', opacity: 0.5, weight: 3} // Alternative 2
            ]
        },
        altLineOptions: {
            styles: [
                {color: '#6b7280', opacity: 0.5, weight: 3, dashArray: '5, 10'},
                {color: '#6b7280', opacity: 0.5, weight: 3, dashArray: '5, 10'}
            ]
        },
        createMarker: function(i, waypoint, n) {
            if (i === 0) {
                return currentLocationMarker;
            }
            return destinationMarker;
        }
    }).addTo(map);
    // Show route info box
    document.getElementById('routeInfo').classList.remove('hidden');
    // Listen for route calculation
    routingControl.on('routesfound', function(e) {
        const routes = e.routes;
        // Store alternative routes
        alternativeRoutes = routes.map(route => ({
            summary: route.summary,
            instructions: route.instructions,
            coordinates: route.coordinates
        }));
        // Display alternative routes
        displayAlternativeRoutes(alternativeRoutes);
        // Select the fastest route by default
        if (alternativeRoutes.length > 0) {
            selectRoute(0);
        }
        // Update current position metrics
        document.getElementById('speed').textContent = currentSpeed.toFixed(1) + ' km/h';
        document.getElementById('heading').textContent = Math.round(currentHeading) + '°';
    });
}
// Display alternative routes
function displayAlternativeRoutes(routes) {
    const container = document.getElementById('alternativeRoutes');
    container.innerHTML = '';
    if (!routes || routes.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-600">No alternative routes available</p>';
        return;
    }
    // Sort routes by time (fastest first)
    routes.sort((a, b) => a.summary.totalTime - b.summary.totalTime);
    routes.forEach((route, index) => {
        const timeMin = Math.round(route.summary.totalTime / 60);
        const distanceKm = (route.summary.totalDistance / 1000).toFixed(1);
        const isFastest = index === 0;
        const routeElement = document.createElement('div');
        routeElement.className = `route-option ${isFastest ? 'fastest' : ''} ${index === currentRouteIndex ? 'active' : ''}`;
        routeElement.innerHTML = `
            <div class="route-details">
                <div>
                    <span class="font-semibold">Route ${index + 1}</span>
                    ${isFastest ? '<span class="fastest-badge">FASTEST</span>' : ''}
                </div>
                <div class="route-stats">
                    <div class="route-stat">
                        <span class="route-stat-value">${timeMin} min</span>
                        <span class="route-stat-label">Time</span>
                    </div>
                    <div class="route-stat">
                        <span class="route-stat-value">${distanceKm} km</span>
                        <span class="route-stat-label">Distance</span>
                    </div>
                </div>
            </div>
        `;
        routeElement.addEventListener('click', () => {
            selectRoute(index);
        });
        container.appendChild(routeElement);
    });
}
// Select a specific route
function selectRoute(routeIndex) {
    if (!alternativeRoutes[routeIndex]) return;
    currentRouteIndex = routeIndex;
    // Update route display
    const routeOptions = document.querySelectorAll('.route-option');
    routeOptions.forEach((option, index) => {
        if (index === routeIndex) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    // Update main route info
    const route = alternativeRoutes[routeIndex];
    const responseTimeMin = Math.round(route.summary.totalTime / 60);
    const distanceKm = (route.summary.totalDistance / 1000).toFixed(1);
    document.getElementById('eta').textContent = responseTimeMin + ' minutes';
    document.getElementById('distance').textContent = distanceKm + ' km';
    // Get first instruction
    if (route.instructions && route.instructions.length > 0) {
        document.getElementById('instructions').textContent = route.instructions[0].text;
    } else {
        document.getElementById('instructions').textContent = 'Follow the route';
    }
    // Highlight the selected route on the map
    highlightSelectedRoute(routeIndex);
}
// Highlight the selected route on the map
function highlightSelectedRoute(routeIndex) {
    // Remove all existing route layers
    routeLayers.forEach(layer => {
        if (layer && map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    routeLayers = [];
    // Add the selected route with highlighted style
    const selectedRoute = alternativeRoutes[routeIndex];
    if (selectedRoute && selectedRoute.coordinates) {
        const routeLayer = L.polyline(selectedRoute.coordinates, {
            color: '#b91c1c',
            weight: 6,
            opacity: 0.9
        }).addTo(map);
        routeLayers.push(routeLayer);
        // Add alternative routes with less prominent style
        alternativeRoutes.forEach((route, index) => {
            if (index !== routeIndex && route.coordinates) {
                const altRouteLayer = L.polyline(route.coordinates, {
                    color: '#6b7280',
                    weight: 3,
                    opacity: 0.5,
                    dashArray: '5, 10'
                }).addTo(map);
                routeLayers.push(altRouteLayer);
            }
        });
    }
}
// Search for locations using GraphHopper Geocoding API with Santa Cruz bounds
async function searchLocations(query) {
    if (!query || query.length < 2) {
        hideSearchResults();
        return;
    }
    showSearchLoading();
    try {
        const apiKey = '92bf00ca-1e51-4739-9e62-4ca42c5ba889';
        // Construct the API URL with bounding box for Santa Cruz, Laguna
        const bbox = `${SANTA_CRUZ_BOUNDS.southWest[1]},${SANTA_CRUZ_BOUNDS.southWest[0]},${SANTA_CRUZ_BOUNDS.northEast[1]},${SANTA_CRUZ_BOUNDS.northEast[0]}`;
        const url = `https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(query)}&locale=en&key=${apiKey}&bbox=${bbox}&limit=8`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        const data = await response.json();
        // Filter results to ensure they're within Santa Cruz bounds
        const filteredHits = data.hits ? data.hits.filter(hit => {
            if (!hit.point) return false;
 
            const lat = hit.point.lat;
            const lng = hit.point.lng;
 
            // Check if the point is within our Santa Cruz bounds
            return lat >= SANTA_CRUZ_BOUNDS.southWest[0] &&
                   lat <= SANTA_CRUZ_BOUNDS.northEast[0] &&
                   lng >= SANTA_CRUZ_BOUNDS.southWest[1] &&
                   lng <= SANTA_CRUZ_BOUNDS.northEast[1];
        }) : [];
        displaySearchResults(filteredHits);
    } catch (error) {
        console.error('Error searching locations:', error);
        displaySearchError('Failed to search locations. Please try again.');
    }
}
// Show search loading indicator
function showSearchLoading() {
    const resultsContainer = document.getElementById('mapSearchResults');
    resultsContainer.innerHTML = `
        <div class="search-loading">
            <i data-feather="loader" class="search-loading-icon w-4 h-4"></i>
            Searching Santa Cruz, Laguna...
        </div>
    `;
    resultsContainer.style.display = 'block';
    feather.replace();
}
// Display search results
function displaySearchResults(results) {
    const resultsContainer = document.getElementById('mapSearchResults');
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="search-loading">No results found in Santa Cruz, Laguna</div>';
        return;
    }
    let html = '';
    // Group by type
    const points = results.filter(r => r.point && (r.name || r.street));
    const cities = results.filter(r => r.city && !r.point);
    if (points.length > 0) {
        points.forEach(result => {
            html += createSearchResultItem(result, 'map-pin');
        });
    }
    if (cities.length > 0) {
        cities.forEach(result => {
            html += createSearchResultItem(result, 'map');
        });
    }
    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
    feather.replace();
}
// Create HTML for a search result item
function createSearchResultItem(result, iconType = 'map-pin') {
    let name = result.name || result.street || '';
    let details = [];
    if (result.housenumber) details.push(result.housenumber);
    if (result.street && result.street !== name) details.push(result.street);
    if (result.city) details.push(result.city);
    if (result.country) details.push(result.country);
    const detailText = details.length > 0 ? details.join(', ') : '';
    return `
        <div class="search-result-item" data-lat="${result.point ? result.point.lat : ''}" data-lng="${result.point ? result.point.lng : ''}">
            <div class="search-result-icon">
                <i data-feather="${iconType}" class="w-4 h-4"></i>
            </div>
            <div class="search-result-content">
                <div class="search-result-name">${name}</div>
                <div class="search-result-details">${detailText}</div>
            </div>
        </div>
    `;
}
// Display search error
function displaySearchError(message) {
    const resultsContainer = document.getElementById('mapSearchResults');
    resultsContainer.innerHTML = `<div class="search-loading">${message}</div>`;
    resultsContainer.style.display = 'block';
}
// Hide search results
function hideSearchResults() {
    const resultsContainer = document.getElementById('mapSearchResults');
    resultsContainer.style.display = 'none';
}
// Update search clear button visibility
function updateSearchClearButton() {
    const searchInput = document.getElementById('mapSearchInput');
    const clearButton = document.getElementById('mapSearchClear');
    if (searchInput.value.length > 0) {
        clearButton.style.display = 'block';
    } else {
        clearButton.style.display = 'none';
    }
}
// Clear search input and results
function clearSearch() {
    const searchInput = document.getElementById('mapSearchInput');
    searchInput.value = '';
    hideSearchResults();
    updateSearchClearButton();
    searchInput.focus();
}
// Show location modal to request user permission
function showLocationModal() {
    const modal = document.getElementById('locationModal');
    modal.classList.remove('hidden');
    // Reset modal content
    document.getElementById('locationRequestContent').classList.remove('hidden');
    document.getElementById('locationDetectingContent').classList.add('hidden');
    document.getElementById('locationErrorContent').classList.add('hidden');
}
// Hide location modal
function hideLocationModal() {
    const modal = document.getElementById('locationModal');
    modal.classList.add('hidden');
}
// Show detecting state in modal
function showDetectingState() {
    document.getElementById('locationRequestContent').classList.add('hidden');
    document.getElementById('locationDetectingContent').classList.remove('hidden');
    document.getElementById('locationErrorContent').classList.add('hidden');
}
// Show error state in modal
function showErrorState() {
    document.getElementById('locationRequestContent').classList.add('hidden');
    document.getElementById('locationDetectingContent').classList.add('hidden');
    document.getElementById('locationErrorContent').classList.remove('hidden');
}
// Automatically detect user location on FIRST VISIT only
function autoDetectLocation() {
    // Check if we've already asked for location
    const locationAsked = localStorage.getItem('locationPermissionAsked');
    if (locationAsked) {
        // We've already asked, don't show modal again
        console.log('Location permission was already requested, skipping modal');
        return;
    }
    if (!navigator.geolocation) {
        console.log('Geolocation is not supported by this browser');
        showErrorState();
        return;
    }
    showLocationModal();
    // Mark that we've asked for location permission
    localStorage.setItem('locationPermissionAsked', 'true');
}
// Function to manually trigger location request (bypasses the one-time check)
function manualLocationRequest() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    showLocationModal();
}
// NEW FUNCTION: Auto-locate user immediately when page loads
function autoLocateUser() {
    if (!navigator.geolocation) {
        console.log('Geolocation is not supported by this browser');
        return;
    }
    console.log('Attempting to automatically locate user...');
    // Show detecting state briefly
    showDetectingState();
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const latlng = [position.coords.latitude, position.coords.longitude];
 
            console.log('User location found:', latlng);
 
            // Update or create current location marker
            if (currentLocationMarker) {
                currentLocationMarker.setLatLng(latlng);
            } else {
                currentLocationMarker = L.marker(latlng, {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34]
                    })
                }).addTo(map);
                currentLocationMarker.bindPopup('<b>Your Current Location</b>').openPopup();
            }
 
            // Center map on user location
            map.setView(latlng, 15);
            updateLocationStatus(true);
            currentPosition = position;
 
            // Hide modal
            hideLocationModal();
 
            // Show success notification
            showTemporaryNotification('Your location has been found and pinned!', false);
 
            console.log('User location pinned successfully');
        },
        function(error) {
            console.error('Error getting location automatically:', error);
 
            // Show modal to let user manually allow location
            showLocationModal();
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}
// Locate user and center map - UPDATED TO AUTO-RECALCULATE ROUTE
function locateUser(isAutomatic = false) {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    if (isAutomatic) {
        showDetectingState();
    }
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const latlng = [position.coords.latitude, position.coords.longitude];
 
            // Update or create current location marker
            if (currentLocationMarker) {
                currentLocationMarker.setLatLng(latlng);
            } else {
                currentLocationMarker = L.marker(latlng, {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34]
                    })
                }).addTo(map);
                currentLocationMarker.bindPopup('<b>Your Current Location</b>').openPopup();
            }
 
            map.setView(latlng, 15);
            updateLocationStatus(true);
            currentPosition = position;
 
            // AUTO-RECALCULATE ROUTE if destination is set
            if (destinationLatLng) {
                calculateRoute(latlng, destinationLatLng);
     
                // Update route button text
                const routeButton = document.getElementById('calculateRoute');
                routeButton.innerHTML = '<i data-feather="navigation" class="w-4 h-4 md:w-5 md:h-5"></i><span>Recalculate Route</span>';
                feather.replace();
            }
 
            // Hide modal if it was automatic detection
            if (isAutomatic) {
                hideLocationModal();
            }
        },
        function(error) {
            console.error('Error getting location:', error);
 
            if (isAutomatic) {
                // For automatic detection, show error state in modal
                showErrorState();
            } else {
                // For manual requests, show alert
                alert('Unable to get your location. Please ensure location services are enabled.');
                updateLocationStatus(false);
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}
// Toggle continuous tracking
function toggleTracking() {
    const button = document.getElementById('toggleTracking');
    if (!isTracking) {
        // Start tracking
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }
        watchId = navigator.geolocation.watchPosition(
            function(position) {
                const latlng = [position.coords.latitude, position.coords.longitude];
     
                // Calculate speed and heading if we have previous position
                if (previousPosition) {
                    calculateMovementMetrics(previousPosition, position);
                }
     
                previousPosition = position;
                currentPosition = position;
     
                // Update marker position
                if (currentLocationMarker) {
                    currentLocationMarker.setLatLng(latlng);
                } else {
                    currentLocationMarker = L.marker(latlng, {
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34]
                        })
                    }).addTo(map);
                }
     
                // If destination is set and we're navigating, update the route
                if (destinationLatLng && routingControl) {
                    updateRoutePosition(latlng);
                }
            },
            function(error) {
                console.error('Error watching position:', error);
                updateLocationStatus(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 2000
            }
        );
        isTracking = true;
        button.innerHTML = '<i data-feather="pause" class="w-4 h-4"></i><span>Stop Tracking</span>';
        button.className = 'px-3 py-2 bg-red-500 text-white rounded-lg text-sm flex items-center space-x-1';
        updateLocationStatus(true);
        // Update mobile button
        const mobileTrackBtn = document.getElementById('mobileTrack');
        mobileTrackBtn.innerHTML = '<i data-feather="pause" class="w-5 h-5 mb-1"></i><span class="text-xs">Stop</span>';
        mobileTrackBtn.className = 'mobile-control-btn bg-red-500 text-white';
    } else {
        // Stop tracking
        navigator.geolocation.clearWatch(watchId);
        isTracking = false;
        button.innerHTML = '<i data-feather="map-pin" class="w-4 h-4"></i><span>Start Tracking</span>';
        button.className = 'px-3 py-2 bg-green-500 text-white rounded-lg text-sm flex items-center space-x-1';
        // Update mobile button
        const mobileTrackBtn = document.getElementById('mobileTrack');
        mobileTrackBtn.innerHTML = '<i data-feather="map-pin" class="w-5 h-5 mb-1"></i><span class="text-xs">Track</span>';
        mobileTrackBtn.className = 'mobile-control-btn bg-green-500 text-white';
    }
    feather.replace();
}
// Calculate movement metrics (speed and heading)
function calculateMovementMetrics(prevPos, currPos) {
    // Calculate distance in meters
    const lat1 = prevPos.coords.latitude;
    const lon1 = prevPos.coords.longitude;
    const lat2 = currPos.coords.latitude;
    const lon2 = currPos.coords.longitude;
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    // Calculate time difference in hours
    const timeDiff = (currPos.timestamp - prevPos.timestamp) / 1000 / 3600;
    // Speed in km/h
    if (timeDiff > 0) {
        currentSpeed = (distance / 1000) / timeDiff;
    }
    // Calculate heading
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    currentHeading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
// Update location status indicator
function updateLocationStatus(active) {
    const statusElement = document.getElementById('location-status');
    if (statusElement) {
        if (active) {
            statusElement.textContent = 'Location Active';
            statusElement.className = 'location-status location-active';
        } else {
            statusElement.textContent = 'Location Off';
            statusElement.className = 'location-status location-inactive';
        }
    }
}
// Update route position during navigation
function updateRoutePosition(currentLatLng) {
    if (routingControl && destinationLatLng) {
        // Remove old route and calculate new one
        map.removeControl(routingControl);
        calculateRoute(currentLatLng, destinationLatLng);
    }
}
// Fetch weather data with fallback
async function fetchWeather() {
    try {
        // Try multiple weather API endpoints as fallback
        const apiKeys = [
            'e480bec2951804e81f84999747008cbb', // Original key
            'demo' // Fallback to demo mode
        ];
        let weatherData = null;
        for (const apiKey of apiKeys) {
            try {
                const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Santa Cruz,Laguna,PH&units=metric&appid=${apiKey}`);
                if (response.ok) {
                    weatherData = await response.json();
                    break;
                }
            } catch (error) {
                console.warn(`Weather API key ${apiKey} failed:`, error);
                continue;
            }
        }
        if (weatherData) {
            document.getElementById('weather-temp').textContent = `${Math.round(weatherData.main.temp)}°C`;
            document.getElementById('weather-condition').textContent = weatherData.weather[0].main;
            document.getElementById('weather-humidity').textContent = `${weatherData.main.humidity}%`;
            document.getElementById('weather-wind').textContent = `${(weatherData.wind.speed * 3.6).toFixed(1)} km/h`;
 
            // Store weather data for prediction
            currentWeatherData = {
                temperature: Math.round(weatherData.main.temp),
                humidity: weatherData.main.humidity,
                windSpeed: (weatherData.wind.speed * 3.6).toFixed(1),
                condition: weatherData.weather[0].main
            };
            console.log('Weather data loaded successfully');
        } else {
            throw new Error('All weather API attempts failed');
        }
    } catch (error) {
        console.error('Error fetching weather data:', error);
        // Set default weather data
        currentWeatherData = {
            temperature: 28,
            humidity: 75,
            windSpeed: 12,
            condition: 'Clear'
        };
        // Update UI with default values
        document.getElementById('weather-temp').textContent = '28°C';
        document.getElementById('weather-condition').textContent = 'Clear';
        document.getElementById('weather-humidity').textContent = '75%';
        document.getElementById('weather-wind').textContent = '12 km/h';
        console.log('Using default weather data');
    }
}
// Update current time
function updateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    document.getElementById('current-time').textContent = now.toLocaleDateString('en-US', options);
}
// Toggle mobile sidebar
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}
// Setup the incident learning system
function setupIncidentLearning() {
    // Manual Training Button
    document.getElementById('manualTrainBtn').addEventListener('click', async function() {
        const button = this;
        const originalText = button.innerHTML;
        button.innerHTML = '<i data-feather="loader" class="w-4 h-4 mr-2 animate-spin"></i>Training...';
        button.disabled = true;
        feather.replace();
        try {
            await incidentLearner.trainModel(incidentLearner.trainingData);
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
            feather.replace();
        }
    });
    // Check Status Button
    document.getElementById('checkStatusBtn').addEventListener('click', function() {
        incidentLearner.checkModelStatus();
        incidentLearner.showNotification('Model status refreshed');
    });
    /*
    // Add event listeners for accuracy refresh and training
    document.getElementById('refreshAccuracy')?.addEventListener('click', () => {
        incidentLearner.checkModelStatus();
        incidentLearner.showNotification('Accuracy refreshed');
    });
    document.getElementById('trainNow')?.addEventListener('click', async () => {
        const button = document.getElementById('trainNow');
        const originalText = button.innerHTML;
        button.innerHTML = '<i data-feather="loader" class="w-4 h-4 mr-2 animate-spin"></i>Training...';
        button.disabled = true;
        feather.replace();
        try {
            await incidentLearner.trainModel(incidentLearner.trainingData);
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
            feather.replace();
        }
    });
    */
    // Remove auto-reporting since we only have detailed reports now
    // setupAutoReporting();
}
// Function to reset location permission (useful for testing)
function resetLocationPermission() {
    localStorage.removeItem('locationPermissionAsked');
    console.log('Location permission reset - modal will show on next page load');
}
// Add this function to calculate response time automatically
function calculateResponseTime() {
    const timeReceived = document.getElementById('time_received').value;
    const timeArrival = document.getElementById('time_arrival').value;
    if (timeReceived && timeArrival) {
        // Convert time strings to minutes since midnight
        const [receivedHours, receivedMinutes] = timeReceived.split(':').map(Number);
        const [arrivalHours, arrivalMinutes] = timeArrival.split(':').map(Number);
        const receivedTotalMinutes = receivedHours * 60 + receivedMinutes;
        const arrivalTotalMinutes = arrivalHours * 60 + arrivalMinutes;
        // Calculate difference (handle overnight cases)
        let diffMinutes = arrivalTotalMinutes - receivedTotalMinutes;
        if (diffMinutes < 0) {
            diffMinutes += 24 * 60; // Add 24 hours if arrival is next day
        }
        document.getElementById('response_time_min').value = diffMinutes;
    }
}
// Add form validation for time logic
function validateTimes() {
    const timeReceived = document.getElementById('time_received').value;
    const timeArrival = document.getElementById('time_arrival').value;
    if (timeReceived && timeArrival) {
        const [receivedHours, receivedMinutes] = timeReceived.split(':').map(Number);
        const [arrivalHours, arrivalMinutes] = timeArrival.split(':').map(Number);
        const receivedTotalMinutes = receivedHours * 60 + receivedMinutes;
        const arrivalTotalMinutes = arrivalHours * 60 + arrivalMinutes;
        let diffMinutes = arrivalTotalMinutes - receivedTotalMinutes;
        if (diffMinutes < 0) {
            diffMinutes += 24 * 60;
        }
        if (diffMinutes <= 0) {
            alert('Error: Arrival time must be after received time');
            document.getElementById('time_arrival').value = '';
            document.getElementById('response_time_min').value = '';
            return false;
        }
        if (diffMinutes > 480) { // 8 hours max
            alert('Warning: Response time seems unusually long. Please verify the times.');
        }
    }
    return true;
}
// Auto-fill current data function
function populateWithCurrentData() {
    // Set current date
    document.getElementById('date_of_response').valueAsDate = new Date();
    // Set current time (rounded to nearest 5 minutes)
    const now = new Date();
    const minutes = Math.round(now.getMinutes() / 5) * 5;
    now.setMinutes(minutes);
    const timeString = now.toTimeString().slice(0, 5);
    document.getElementById('time_received').value = timeString;
    document.getElementById('time_dispatched').value = timeString;
    // Calculate arrival time (5 minutes later)
    const arrivalTime = new Date(now.getTime() + 5 * 60000);
    document.getElementById('time_arrival').value = arrivalTime.toTimeString().slice(0, 5);
    // Auto-calculate response time
    calculateResponseTime();
    // Use current weather data if available
    if (currentWeatherData) {
        document.getElementById('temperature_c').value = currentWeatherData.temperature || 28;
        document.getElementById('humidity_pct').value = currentWeatherData.humidity || 75;
        document.getElementById('wind_speed_kmh').value = currentWeatherData.windSpeed || 12;
        document.getElementById('precipitation_mm').value = 0.0;
        document.getElementById('weather_condition').value = currentWeatherData.condition || 'Clear';
    }
    // Set default values for other fields (leave dropdowns blank)
    document.getElementById('remarks').value = 'Case Closed';
    incidentLearner.showNotification('Form auto-filled with current data');
}
// Initialize form with current date when incidents section is loaded
function initializeReportForm() {
    // Set current date as default
    const dateInput = document.getElementById('date_of_response');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
    // Set default values
    document.getElementById('station').value = 'Santa Cruz, Laguna';
    // Set blank/default values for dropdowns
    document.getElementById('responding_unit').value = '';
    document.getElementById('alarm_status').value = '';
    document.getElementById('type_of_occupancy').value = '';
    document.getElementById('road_condition').value = '';
    document.getElementById('remarks').value = 'Case Closed';
    // Set default numeric values
    document.getElementById('injured_civ').value = 0;
    document.getElementById('injured_bfp').value = 0;
    document.getElementById('death_civ').value = 0;
    document.getElementById('death_bfp').value = 0;
    document.getElementById('precipitation_mm').value = 0.0;
    document.getElementById('response_time_min').value = '';
    document.getElementById('distance').value = '';
    // Add event listeners for automatic response time calculation
    document.getElementById('time_received').addEventListener('change', calculateResponseTime);
    document.getElementById('time_arrival').addEventListener('change', calculateResponseTime);
}
// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...');
    // Initialize map first
    initMap();
    // Set up event listeners after DOM is ready
    document.getElementById('locateMe').addEventListener('click', function() {
        manualLocationRequest();
    });
    document.getElementById('toggleTracking').addEventListener('click', toggleTracking);
    // Location modal event listeners
    document.getElementById('allowLocation').addEventListener('click', function() {
        locateUser(true);
    });
    document.getElementById('denyLocation').addEventListener('click', function() {
        hideLocationModal();
    });
    document.getElementById('closeLocationModal').addEventListener('click', function() {
        hideLocationModal();
    });
    // Mobile control buttons
    document.getElementById('mobileLocate').addEventListener('click', function() {
        manualLocationRequest();
    });
    document.getElementById('mobileTrack').addEventListener('click', toggleTracking);
    document.getElementById('mobileMenu').addEventListener('click', toggleSidebar);
    document.getElementById('mobileNavigate').addEventListener('click', function() {
        if (!destinationLatLng) {
            alert('Please set a destination location first using the search bar or by clicking on the map');
            return;
        }
        if (!currentPosition) {
            alert('Please enable location services and wait for your position to be determined.');
            return;
        }
        const button = document.getElementById('calculateRoute');
        const originalText = button.innerHTML;
        // Show loading state
        button.innerHTML = '<i data-feather="loader" class="w-5 h-5 animate-spin"></i><span>Calculating...</span>';
        button.disabled = true;
        feather.replace();
        // Start tracking if not already
        if (!isTracking) {
            toggleTracking();
        }
        // Calculate route from current position to destination
        const currentLatLng = [currentPosition.coords.latitude, currentPosition.coords.longitude];
        calculateRoute(currentLatLng, destinationLatLng);
        // Restore button after a delay
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
            feather.replace();
        }, 2000);
    });
    // Map search input handling
    const mapSearchInput = document.getElementById('mapSearchInput');
    mapSearchInput.addEventListener('input', function() {
        // Update clear button visibility
        updateSearchClearButton();
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        // Set new timeout to search after user stops typing
        searchTimeout = setTimeout(() => {
            searchLocations(this.value);
        }, 300);
    });
    // Map search clear button
    document.getElementById('mapSearchClear').addEventListener('click', clearSearch);
    // Handle clicks on map search results - UPDATED TO AUTO-CALCULATE ROUTE
    document.getElementById('mapSearchResults').addEventListener('click', function(e) {
        const resultItem = e.target.closest('.search-result-item');
        if (resultItem && resultItem.dataset.lat && resultItem.dataset.lng) {
            const lat = parseFloat(resultItem.dataset.lat);
            const lng = parseFloat(resultItem.dataset.lng);
 
            // Set destination marker at selected location
            setDestinationMarker(L.latLng(lat, lng));
 
            // Center map on selected location
            map.setView([lat, lng], 15);
 
            // Hide search results
            hideSearchResults();
 
            // Clear search input
            mapSearchInput.value = '';
            updateSearchClearButton();
 
            // AUTO-CALCULATE ROUTE if we have current position
            if (currentPosition) {
                const currentLatLng = [currentPosition.coords.latitude, currentPosition.coords.longitude];
                calculateRoute(currentLatLng, [lat, lng]);
            }
        }
    });
    // Close search results when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.map-search-container')) {
            hideSearchResults();
        }
    });
    // Calculate route button
    document.getElementById('calculateRoute').addEventListener('click', function() {
        if (!destinationLatLng) {
            alert('Please set a destination location first using the search bar or by clicking on the map');
            return;
        }
        if (!currentPosition) {
            alert('Please enable location services and wait for your position to be determined.');
            return;
        }
        const button = this;
        const originalText = button.innerHTML;
        // Show loading state
        button.innerHTML = '<i data-feather="loader" class="w-5 h-5 animate-spin"></i><span>Calculating...</span>';
        button.disabled = true;
        feather.replace();
        // Start tracking if not already
        if (!isTracking) {
            toggleTracking();
        }
        // Calculate route from current position to destination
        const currentLatLng = [currentPosition.coords.latitude, currentPosition.coords.longitude];
        calculateRoute(currentLatLng, destinationLatLng);
        // Restore button after a delay
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
            feather.replace();
        }, 2000);
    });
    // Mobile menu button
    document.getElementById('mobileMenuBtn').addEventListener('click', toggleSidebar);
    document.getElementById('closeSidebar').addEventListener('click', toggleSidebar);
    document.getElementById('overlay').addEventListener('click', toggleSidebar);
    // Navigation event listeners
    document.querySelectorAll('.nav-btn, .nav-btn-mobile').forEach(btn => {
        btn.addEventListener('click', function() {
            switchSection(this.dataset.section);
        });
    });
    // Initialize incident learning system
    incidentLearner = new RealFireIncidentLearner();
    setupIncidentLearning();
    // Enhanced form submission with better error handling
    document.getElementById('incidentReportForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('📝 Form submission started...');
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());
        console.log("📊 Form data submitted:", data);
       
        // Convert numeric fields
        const numericFields = ['response_time_min', 'distance', 'injured_civ', 'injured_bfp', 'death_civ', 'death_bfp', 'temperature_c', 'humidity_pct', 'wind_speed_kmh', 'precipitation_mm'];
        numericFields.forEach(field => {
            if (data[field]) {
                data[field] = parseFloat(data[field]) || 0;
            }
        });
       
        // Ensure required fields are present
        if (!data.location || !data.type_of_occupancy) {
            incidentLearner.showNotification('Please fill in all required fields (Location and Type of Occupancy)', true);
            return;
        }
       
        try {
            // Show loading state
            const submitButton = this.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i data-feather="loader" class="w-4 h-4 mr-2 animate-spin"></i>Saving Incident...';
            submitButton.disabled = true;
        
            // Ensure feedback container is visible and show loading
            const feedbackContainer = document.getElementById('performanceFeedback');
            if (feedbackContainer) {
                feedbackContainer.classList.remove('hidden');
                feedbackContainer.innerHTML = `
                    <div class="text-center py-8">
                        <i data-feather="loader" class="w-12 h-12 animate-spin mx-auto text-blue-500 mb-4"></i>
                        <h3 class="text-lg font-semibold text-gray-700">Analyzing Response Performance</h3>
                        <p class="text-sm text-gray-600 mt-2">Comparing with historical data and generating insights...</p>
                    </div>
                `;
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            }
           
            console.log('🚀 Sending incident data to backend...');
        
            // Store the incident
            const response = await fetch(`${incidentLearner.backendUrl}/incidents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            console.log('📨 Backend response status:', response.status);
        
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || `Server error: ${response.status}`);
            }
            const result = await response.json();
            console.log('✅ Incident stored successfully:', result);
        
            // Show success notification
            incidentLearner.showNotification('Incident report saved successfully! Generating performance analysis...');
        
            // DON'T reset form yet - wait for feedback
            // this.reset();
            // initializeReportForm();
           
            // Update the incidents list in the ML system
            await incidentLearner.loadIncidents();
           
            // Now get comprehensive performance feedback with proper data mapping
            console.log('🔄 Requesting comprehensive feedback...');
            try {
                const mlIncidentData = {
                    ...data,
                    response_time: data.response_time_min, // Map to expected field
                    type: data.type_of_occupancy,
                    weather: data.weather_condition,
                    id: result.id,
                    timestamp: result.timestamp
                };
               
                const feedbackResponse = await fetch(`${incidentLearner.backendUrl}/comprehensive-feedback`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        incident_data: mlIncidentData
                    })
                });
               
                console.log('🔍 Feedback response status:', feedbackResponse.status);
               
                if (feedbackResponse.ok) {
                    const feedbackResult = await feedbackResponse.json();
                    console.log('📊 Comprehensive feedback received:', feedbackResult);
                
                    // Display the comprehensive feedback
                    if (feedbackContainer) {
                        console.log('📺 Displaying feedback in container');
                        incidentLearner.displayComprehensiveFeedback(feedbackResult);
                        
                        // Make absolutely sure it's visible
                        feedbackContainer.classList.remove('hidden');
                        feedbackContainer.style.display = 'block';
                        
                        // Scroll to feedback
                        setTimeout(() => {
                            feedbackContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 500);
                        
                        // NOW reset form after feedback is displayed
                        setTimeout(() => {
                            const form = document.getElementById('incidentReportForm');
                            if (form) {
                                form.reset();
                                initializeReportForm();
                            }
                        }, 1000);
                    } else {
                        console.error('❌ Feedback container not found!');
                    }
                
                    incidentLearner.showNotification('Performance analysis complete! Check the feedback above.');
                } else {
                    const errorText = await feedbackResponse.text();
                    console.error('❌ Feedback response error:', errorText);
                    throw new Error(`Failed to get performance feedback: ${feedbackResponse.status}`);
                }
            } catch (feedbackError) {
                console.warn('❌ Could not get comprehensive feedback:', feedbackError);
                console.error('Full error:', feedbackError);
            
                // Show fallback feedback
                if (feedbackContainer) {
                    feedbackContainer.classList.remove('hidden');
                    feedbackContainer.style.display = 'block';
                    feedbackContainer.innerHTML = `
                        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-6">
                            <div class="flex items-center mb-3">
                                <i data-feather="alert-circle" class="w-6 h-6 text-yellow-500 mr-2"></i>
                                <h3 class="text-lg font-semibold text-yellow-800">Analysis Limited</h3>
                            </div>
                            <p class="text-yellow-700">
                                Performance analysis is temporarily unavailable. Your incident has been saved successfully.
                                Continue recording incidents to build better performance insights.
                            </p>
                            <div class="mt-4 p-3 bg-yellow-100 rounded">
                                <p class="text-sm text-yellow-800">
                                    <strong>Next Steps:</strong> Record more incidents to enable detailed performance comparisons.
                                </p>
                            </div>
                        </div>
                    `;
                    feather.replace();
                }
            }
        } catch (error) {
            console.error('❌ Error saving incident report:', error);
            incidentLearner.showNotification(`Failed to save incident report: ${error.message}`, true);
        
            // Show error in feedback container
            const feedbackContainer = document.getElementById('performanceFeedback');
            if (feedbackContainer) {
                feedbackContainer.classList.remove('hidden');
                feedbackContainer.style.display = 'block';
                feedbackContainer.innerHTML = `
                    <div class="bg-red-50 border-l-4 border-red-400 p-6">
                        <div class="flex items-center mb-3">
                            <i data-feather="alert-triangle" class="w-6 h-6 text-red-400 mr-2"></i>
                            <h3 class="text-lg font-semibold text-red-800">Save Failed</h3>
                        </div>
                        <p class="text-red-700">Unable to save incident report. Please check your connection and try again.</p>
                        <p class="text-sm text-red-600 mt-2">Error: ${error.message}</p>
                    </div>
                `;
                feather.replace();
            }
        } finally {
            if (submitButton) {
                submitButton.innerHTML = '<i data-feather="save" class="w-4 h-4 mr-2"></i>Save Incident Report';
                submitButton.disabled = false;
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            }
        }
        
        // CRITICAL: Prevent any form reload
        return false;
    });
    // Fetch weather data
    fetchWeather();
    // Initialize time
    setInterval(updateTime, 1000);
    updateTime();
    // Initialize feather icons and AOS
    feather.replace();
    AOS.init();
    // NEW: Automatically locate user immediately when page loads
    setTimeout(() => {
        autoLocateUser();
    }, 1000);
    // Restore saved section on page load
    const savedSection = localStorage.getItem('currentSection');
    if (savedSection) {
        switchSection(savedSection);
    }
    // Add time validation
    document.getElementById('time_arrival').addEventListener('change', validateTimes);
    console.log('Application initialized successfully');
});