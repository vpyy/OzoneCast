import React, { useState } from 'react';
import { BrainCircuit, Sparkles, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { api } from '../api/apiClient';

export default function PredictionPanel() {
  const [lat, setLat] = useState('10.82'); // Ho Chi Minh City default
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
      alert('Prediction failed: ' + (err.response?.data?.detail || err.message));
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
      alert('Training failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form Card */}
      <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-1 flex items-center space-x-2">
            <BrainCircuit className="h-5 w-5 text-sky-500" />
            <span>Ozone Level Forecaster</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Predict total column ozone in Dobson Units (DU) and assess atmospheric radiation risk.
          </p>

          <form onSubmit={handlePredict} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Latitude (-90 to +90)</label>
              <input
                type="number"
                step="0.001"
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                placeholder="e.g. 10.82 (HCMC)"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Longitude (-180 to +180)</label>
              <input
                type="number"
                step="0.001"
                required
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                placeholder="e.g. 106.63"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Target Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={predicting}
              className="w-full flex items-center justify-center space-x-2 bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition shadow-sm disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>{predicting ? 'Computing Forecast...' : 'Predict Ozone Level'}</span>
            </button>
          </form>
        </div>

        <div className="pt-6 border-t border-slate-100 mt-6">
          <button
            onClick={handleTrain}
            disabled={training}
            className="w-full flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-3 rounded-lg text-xs transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${training ? 'animate-spin text-sky-500' : ''}`} />
            <span>{training ? 'Retraining Model...' : 'Retrain Random Forest Model'}</span>
          </button>
          {trainResult && (
            <p className="text-[11px] text-emerald-600 mt-2 text-center">
              Retrained: MAE={trainResult.mae_du} DU | R²={trainResult.r2_score}
            </p>
          )}
        </div>
      </div>

      {/* Result Card */}
      <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
        {prediction ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Target Location</span>
                <h4 className="text-xl font-bold text-slate-800">
                  Lat: {prediction.latitude}° | Lon: {prediction.longitude}°
                </h4>
                <p className="text-xs text-slate-500">Date: {new Date(prediction.datetime).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Forecast Value</span>
                <div className="text-4xl font-extrabold text-sky-600">
                  {prediction.predicted_ozone_du} <span className="text-lg font-semibold text-slate-500">DU</span>
                </div>
              </div>
            </div>

            {/* Assessment */}
            <div className={`p-4 rounded-xl border ${
              prediction.predicted_ozone_du < 220 
                ? 'bg-rose-50 border-rose-200 text-rose-900' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <div className="flex items-start space-x-3">
                {prediction.predicted_ozone_du < 220 ? (
                  <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h5 className="font-bold text-sm">{prediction.risk_assessment}</h5>
                  <p className="text-xs mt-1 opacity-90">
                    {prediction.predicted_ozone_du < 220
                      ? 'Warning: Total column ozone is below 220 Dobson Units (depletion threshold). Ultraviolet (UV) radiation levels may be high.'
                      : 'Atmospheric ozone layer is at a healthy standard density (280-350 DU), providing adequate UV protection.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Scale Indicator */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>150 DU (Depletion)</span>
                <span>280-330 DU (Normal)</span>
                <span>450 DU (High)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative">
                <div 
                  className="bg-gradient-to-r from-rose-500 via-emerald-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(10, ((prediction.predicted_ozone_du - 100) / 400) * 100))}%` }}
                ></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <BrainCircuit className="h-12 w-12 mx-auto mb-3 opacity-30 text-sky-500" />
            <p className="text-sm font-medium text-slate-600">No prediction generated yet</p>
            <p className="text-xs text-slate-400 mt-1">Enter latitude and longitude coordinates on the left and click "Predict Ozone Level".</p>
          </div>
        )}
      </div>
    </div>
  );
}

