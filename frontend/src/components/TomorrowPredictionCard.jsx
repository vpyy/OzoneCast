import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';

export default function TomorrowPredictionCard() {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadForecast = async () => {
    setLoading(true);
    try {
      const res = await api.getTomorrowPrediction();
      setForecast(res);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast();
  }, []);

  const getStatusColor = (label) => {
    if (!label) return 'bg-green-50 border-green-200 text-green-800';
    if (label.includes('Normal')) return 'bg-green-50 border-green-200 text-green-800';
    if (label.includes('UV')) return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    return 'bg-red-50 border-red-200 text-red-800';
  };

  return (
    <div className="space-y-4">
      {/* Tomorrow Forecast Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Regression */}
        <div className="bg-white p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Tomorrow Ozone Forecast</h3>
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {forecast?.predicted_ozone_du || 290} DU
          </div>
          <p className="text-xs text-gray-600">Random Forest Regression Model</p>
          <p className="text-xs text-gray-500 mt-2">
            Target: {forecast?.target_date || 'Tomorrow'}
          </p>
        </div>

        {/* Classification */}
        <div className={`bg-white p-4 border border-gray-200 ${getStatusColor(forecast?.status_label)}`}>
          <h3 className="text-sm font-semibold mb-3">Risk Assessment</h3>
          <p className="text-sm font-bold mb-2">{forecast?.status_label || 'Normal'}</p>
          <p className="text-xs">
            {forecast?.health_advisory || 'Ozone layer is at healthy density. Safe UV conditions.'}
          </p>
        </div>
      </div>

      {/* Regional Forecasts */}
      {forecast?.regional_forecasts && (
        <div className="bg-white p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Regional Forecast</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {forecast.regional_forecasts.map((rf, idx) => (
              <div key={idx} className="p-3 bg-gray-50 border border-gray-200 text-xs">
                <p className="font-semibold text-gray-900">{rf.location_name}</p>
                <p className="text-lg font-bold text-blue-600 mt-1">{rf.predicted_ozone_du} DU</p>
                <p className="text-gray-600 mt-1">{rf.latitude}°, {rf.longitude}°</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
