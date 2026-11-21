import React, { useState } from 'react';
import { BrainCircuit, RefreshCw, MapPin, Calendar, CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import { api } from '../api/apiClient';
import { C, F, panelStyle, labelStyle, monoStyle, inputStyle, inputLabelStyle, btnPrimary, btnSecondary } from '../theme';

const PRESETS = [
  { name: 'Ho Chi Minh City',  lat: '10.82',  lon: '106.63' },
  { name: 'Ha Noi',            lat: '21.03',  lon: '105.85' },
  { name: 'Antarctic Station', lat: '-68.50', lon: '0.00'   },
  { name: 'Equatorial SEA',    lat: '0.00',   lon: '105.00' },
];

function statusAccent(c) {
  if (c === 'red')    return C.danger;
  if (c === 'amber')  return C.warning;
  if (c === 'purple') return C.purple;
  return C.success;
}

function StatusIcon({ color, size = 14 }) {
  const c = statusAccent(color);
  if (color === 'red')   return <AlertOctagon  size={size} strokeWidth={1.75} style={{ color: c }} />;
  if (color === 'amber') return <AlertTriangle size={size} strokeWidth={1.75} style={{ color: c }} />;
  return <CheckCircle size={size} strokeWidth={1.75} style={{ color: c }} />;
}

export default function PredictionPanel() {
  const [lat, setLat]               = useState('10.82');
  const [lon, setLon]               = useState('106.63');
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [predicting, setPredicting] = useState(false);
  const [training, setTraining]     = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [trainResult, setTrainResult] = useState(null);

  const handlePredict = async (e) => {
    if (e) e.preventDefault();
    setPredicting(true);
    try {
      const dt = date ? new Date(date).toISOString() : null;
      setPrediction(await api.predictOzone(parseFloat(lat), parseFloat(lon), dt));
    } catch (err) {
      alert('Prediction failed: ' + (err.response?.data?.detail || err.message));
    } finally { setPredicting(false); }
  };

  const handleTrain = async () => {
    setTraining(true); setTrainResult(null);
    try { setTrainResult(await api.trainModel()); }
    catch (err) { alert('Training failed: ' + (err.response?.data?.detail || err.message)); }
    finally { setTraining(false); }
  };

  const accent = prediction ? statusAccent(prediction.badge_color) : C.accent;
  const divider = { borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BrainCircuit size={15} strokeWidth={1.75} style={{ color: C.accent }} />
          <div>
            <p style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.textPrimary, margin: 0 }}>
              Ozone Forecast &amp; UV Risk Assessment
            </p>
            <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              Random Forest Regressor + Classifier · WMO Classification
            </p>
          </div>
        </div>
        <button onClick={handleTrain} disabled={training}
          style={{ ...btnSecondary, opacity: training ? 0.6 : 1 }}>
          <RefreshCw size={12} strokeWidth={1.75} className={training ? 'animate-spin' : ''} />
          {training ? 'Training...' : 'Retrain Model'}
        </button>
      </div>

      {/* Train result */}
      {trainResult && (
        <div style={{ ...panelStyle, padding: '10px 14px', border: `1px solid ${C.success}44`, background: `${C.success}08`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={13} strokeWidth={1.75} style={{ color: C.success, flexShrink: 0 }} />
          <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textSecond }}>Model retrained — </span>
          <span style={{ ...monoStyle, fontSize: 11, color: C.textMuted }}>
            MAE: {trainResult.mae_du} DU &nbsp;·&nbsp; R²: {trainResult.r2_score}
            {trainResult.classification_accuracy && ` · Acc: ${trainResult.classification_accuracy}%`}
          </span>
        </div>
      )}

      {/* 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 12 }}>

        {/* Input panel */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <MapPin size={13} strokeWidth={1.75} style={{ color: C.textMuted }} />
            <p style={{ ...labelStyle, margin: 0 }}>Configure Forecast Target</p>
          </div>

          {/* Presets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => { setLat(p.lat); setLon(p.lon); }}
                style={{
                  textAlign: 'left', padding: '7px 9px',
                  background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4,
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 500, color: C.textPrimary }}>{p.name}</div>
                <div style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>{p.lat}°, {p.lon}°</div>
              </button>
            ))}
          </div>

          <form onSubmit={handlePredict} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={inputLabelStyle}>Latitude</label>
                <input style={inputStyle} type="number" step="0.001" min="-90" max="90" required value={lat} onChange={e => setLat(e.target.value)} placeholder="−90 to 90" />
              </div>
              <div>
                <label style={inputLabelStyle}>Longitude</label>
                <input style={inputStyle} type="number" step="0.001" min="-180" max="180" required value={lon} onChange={e => setLon(e.target.value)} placeholder="−180 to 180" />
              </div>
            </div>
            <div>
              <label style={{ ...inputLabelStyle, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} strokeWidth={1.75} /> Target Date
              </label>
              <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <button type="submit" disabled={predicting}
              style={{ ...btnPrimary, width: '100%', opacity: predicting ? 0.6 : 1 }}>
              <RefreshCw size={12} strokeWidth={1.75} className={predicting ? 'animate-spin' : ''} />
              {predicting ? 'Computing...' : 'Run Prediction'}
            </button>
          </form>
        </div>

        {/* Result panel */}
        <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', justifyContent: prediction ? 'flex-start' : 'center', minHeight: 300 }}>
          {prediction ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Location */}
              <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                <p style={labelStyle}>Prediction Result</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <MapPin size={12} strokeWidth={1.75} style={{ color: C.textMuted }} />
                  <span style={{ ...monoStyle, fontSize: 12, color: C.textPrimary }}>
                    {prediction.latitude}°, {prediction.longitude}°
                  </span>
                  <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginLeft: 'auto' }}>
                    {new Date(prediction.datetime || prediction.target_datetime).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { label: 'Ozone Column', value: prediction.predicted_ozone_du, unit: 'DU', big: true },
                  { label: 'Confidence',   value: `${prediction.confidence_percent}`, unit: '%', big: true },
                  { label: 'Risk Level',   value: prediction.risk_assessment || '—', unit: '', big: false },
                ].map(({ label, value, unit, big }, i) => (
                  <div key={i} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
                    <p style={{ ...labelStyle, marginBottom: 4 }}>{label}</p>
                    <p style={{ fontFamily: F.mono, fontSize: big ? 20 : 13, fontWeight: 700, color: i === 0 ? accent : C.textPrimary, margin: 0 }}>
                      {value}<span style={{ fontFamily: F.sans, fontSize: 10, color: C.textMuted, marginLeft: 2 }}>{unit}</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Status */}
              <div style={{ background: C.surfaceAlt, border: `1px solid ${accent}44`, borderRadius: 4, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <StatusIcon color={prediction.badge_color} size={14} />
                <div>
                  <p style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, color: accent, margin: 0 }}>
                    {prediction.status_label}
                  </p>
                  <p style={{ fontFamily: F.sans, fontSize: 11, color: C.textSecond, marginTop: 4, lineHeight: 1.5 }}>
                    {prediction.health_advisory}
                  </p>
                </div>
              </div>

              {/* Input features */}
              <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
                <p style={{ ...labelStyle, marginBottom: 6 }}>Input Features</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px' }}>
                  {[
                    ['Latitude',           `${prediction.latitude}°`],
                    ['Longitude',          `${prediction.longitude}°`],
                    ['Reflectivity',       prediction.input_features?.reflectivity ? `${prediction.input_features.reflectivity.toFixed(1)}%` : '—'],
                    ['Solar Zenith Angle', prediction.input_features?.solar_zenith_angle ? `${prediction.input_features.solar_zenith_angle.toFixed(1)}°` : '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.mono, fontSize: 10, padding: '2px 0' }}>
                      <span style={{ color: C.textMuted }}>{k}</span>
                      <span style={{ color: C.textSecond }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: C.textDisabled }}>
              <BrainCircuit size={28} strokeWidth={1} style={{ margin: '0 auto 8px' }} />
              <p style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>Configure coordinates and run prediction</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
