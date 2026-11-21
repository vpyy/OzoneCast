import React, { useState } from 'react';
import { api } from '../api/apiClient';

export default function PredictionPanel() {
  const [lat, setLat] = useState('10.82');
  const [lon, setLon] = useState('106.63');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [predicting, setPredicting] = useState(false);
  const [training, setTraining] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [trainResult, setTrainResult] = useState(null);

  const handlePredict = async (e) => {
    e.preventDefault();
    setPredicting(true);
    setPrediction(null);
    try {
      const dt = date ? new Date(date).toISOString() : null;
      const res = await api.predictOzone(parseFloat(lat), parseFloat(lon), dt);
      setPrediction(res);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setPredicting(false);
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    setTrainResult(null);
    try {
      const res = await api.trainModel();
      setTrainResult(res);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form */}
      <div className="lg:col-span-1 bg-white p-4 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Ozone Forecast</h3>

        <form onSubmit={handlePredict} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Latitude</label>
            <input
              type="number"
              step="0.001"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Longitude</label>
            <input
              type="number"
              step="0.001"
              required
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={predicting}
            className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {predicting ? 'Predicting...' : 'Predict'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={handleTrain}
            disabled={training}
            className="w-full px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            {training ? 'Training...' : 'Retrain Model'}
          </button>
          {trainResult && (
            <p className="text-xs text-green-600 mt-2 text-center">
              MAE: {trainResult.mae_du} DU | R²: {trainResult.r2_score}
            </p>
          )}
        </div>
      </div>

      {/* Result */}
      <div className="lg:col-span-2 bg-white p-4 border border-gray-200">
        {prediction ? (
          <div className="space-y-4">
            <div className="pb-4 border-b border-gray-200">
              <p className="text-xs text-gray-500">Location: {prediction.latitude}°, {prediction.longitude}°</p>
              <p className="text-xs text-gray-500">Date: {new Date(prediction.datetime).toLocaleDateString()}</p>
              <div className="mt-2">
                <span className="text-xs text-gray-600">Ozone Level: </span>
                <span className="text-3xl font-bold text-blue-600">{prediction.predicted_ozone_du} DU</span>
              </div>
            </div>

            <div className={`p-3 text-xs ${
              prediction.predicted_ozone_du < 220 
                ? 'bg-red-50 border border-red-200 text-red-800' 
                : 'bg-green-50 border border-green-200 text-green-800'
            }`}>
              <p className="font-semibold">{prediction.risk_assessment}</p>
              <p className="mt-1">
                {prediction.predicted_ozone_du < 220
                  ? 'Warning: Ozone level is below 220 DU (depletion). High UV radiation risk.'
                  : 'Safe: Ozone level is normal (280-350 DU). Good UV protection.'}
              </p>
            </div>

            {/* Scale */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>150 DU</span>
                <span>300 DU</span>
                <span>450 DU</span>
              </div>
              <div className="w-full bg-gray-200 h-2 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    prediction.predicted_ozone_du < 220 ? 'bg-red-600' :
                    prediction.predicted_ozone_du < 280 ? 'bg-yellow-600' :
                    prediction.predicted_ozone_du < 350 ? 'bg-green-600' :
                    'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(10, ((prediction.predicted_ozone_du - 100) / 400) * 100))}%` }}
                ></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Enter coordinates and click Predict</p>
          </div>
        )}
      </div>
    </div>
  );
}
