import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Navigation, RefreshCw, Activity } from 'lucide-react';
import { api } from '../api/apiClient';
import { C, F, panelStyle, labelStyle, monoStyle, inputStyle, inputLabelStyle, btnPrimary } from '../theme';

function statusAccent(label) {
  if (!label) return C.success;
  if (label.includes('UV') || label.includes('Cảnh báo')) return C.warning;
  if (label.includes('Nghiêm') || label.includes('Severe')) return C.danger;
  return C.success;
}

function StatusBadge({ label }) {
  const color = statusAccent(label);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 4,
      border: `1px solid ${color}44`,
      background: `${color}12`,
      color, fontSize: 11, fontWeight: 700, fontFamily: F.heading,
    }}>
      {label || 'Bình thường'}
    </span>
  );
}

export default function TomorrowPredictionCard() {
  const [forecast, setForecast]           = useState(null);
  const [loading, setLoading]             = useState(false);
  const [customLat, setCustomLat]         = useState('14.05');
  const [customLon, setCustomLon]         = useState('108.27');
  const [customResult, setCustomResult]   = useState(null);
  const [customLoading, setCustomLoading] = useState(false);

  const loadForecast = async () => {
    setLoading(true);
    try { setForecast(await api.getTomorrowPrediction()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadForecast(); }, []);

  const handleCustomPredict = async (e) => {
    e.preventDefault();
    setCustomLoading(true);
    try { setCustomResult(await api.predictOzone(parseFloat(customLat), parseFloat(customLon))); }
    catch (e) { console.error(e); }
    finally { setCustomLoading(false); }
  };

  const divider = { borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Dual forecast cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Regression */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={labelStyle}>Regression Model</p>
              <p style={{ fontFamily: F.heading, fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: '4px 0 0' }}>
                Ozone Column — Tomorrow
              </p>
              <p style={{ fontFamily: F.opensans, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                {forecast?.target_date || 'Tomorrow'}
              </p>
            </div>
            <Activity size={15} strokeWidth={1.75} style={{ color: C.accent, marginTop: 2 }} />
          </div>
          <div style={divider}>
            <span style={{ fontFamily: F.heading, fontSize: 32, fontWeight: 700, color: C.textPrimary }}>
              {forecast?.predicted_ozone_du ?? 292.4}
            </span>
            <span style={{ fontFamily: F.opensans, fontSize: 12, fontWeight: 600, color: C.textMuted, marginLeft: 6 }}>DU</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: F.opensans, color: C.textMuted }}>
            <span>Random Forest Regressor</span>
            <span>MAE ±{forecast?.mae_du ?? '4.69'} DU</span>
          </div>
        </div>

        {/* Classification */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={labelStyle}>Classification Model</p>
              <p style={{ fontFamily: F.heading, fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: '4px 0 0' }}>
                Status Label — Tomorrow
              </p>
              <p style={{ fontFamily: F.opensans, fontSize: 10, color: C.textMuted, marginTop: 2 }}>UV radiation risk assessment</p>
            </div>
            <button onClick={loadForecast} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0 }}>
              <RefreshCw size={13} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div style={divider}>
            <StatusBadge label={forecast?.status_label} />
            <p style={{ fontFamily: F.opensans, fontSize: 11, color: C.textSecond, marginTop: 8, lineHeight: 1.5 }}>
              {forecast?.health_advisory ?? 'Ozone column within safe range.'}
            </p>
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: F.opensans, color: C.textMuted }}>
            <span>Random Forest Classifier</span>
            <span>Conf. {forecast?.confidence_percent ?? 96.5}%</span>
          </div>
        </div>
      </div>

      {/* Regional forecasts */}
      {forecast?.regional_forecasts && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Navigation size={13} strokeWidth={1.75} style={{ color: C.textMuted }} />
            <p style={{ ...labelStyle, margin: 0 }}>Regional Forecast — Tomorrow</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {forecast.regional_forecasts.map((rf, i) => (
              <div key={i} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: F.heading, fontSize: 11, fontWeight: 700, color: C.textPrimary }}>{rf.location_name}</span>
                  <StatusBadge label={rf.status_label?.split('(')[0]?.trim()} />
                </div>
                <p style={{ ...monoStyle, fontSize: 20, fontWeight: 700, color: C.textPrimary, margin: '4px 0 0' }}>
                  {rf.predicted_ozone_du} <span style={{ fontFamily: F.sans, fontSize: 10, color: C.textMuted }}>DU</span>
                </p>
                <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                  {rf.latitude}°, {rf.longitude}°
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom lookup */}
      <div style={panelStyle}>
        <p style={{ ...labelStyle, marginBottom: 10 }}>Custom Coordinate Forecast</p>
        <form onSubmit={handleCustomPredict} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={inputLabelStyle}>Latitude (−90 → +90)</label>
            <input style={inputStyle} type="number" step="any" value={customLat} onChange={e => setCustomLat(e.target.value)} required />
          </div>
          <div>
            <label style={inputLabelStyle}>Longitude (−180 → +180)</label>
            <input style={inputStyle} type="number" step="any" value={customLon} onChange={e => setCustomLon(e.target.value)} required />
          </div>
          <button type="submit" disabled={customLoading}
            style={{ ...btnPrimary, opacity: customLoading ? 0.6 : 1, padding: '7px 16px', whiteSpace: 'nowrap' }}>
            <RefreshCw size={12} strokeWidth={1.75} className={customLoading ? 'animate-spin' : ''} />
            Predict
          </button>
        </form>

        {customResult && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...monoStyle, fontSize: 20, fontWeight: 700, color: C.textPrimary }}>
                {customResult.predicted_ozone_du} <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>DU</span>
              </span>
              <StatusBadge label={customResult.status_label} />
              <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginLeft: 'auto' }}>
                {customResult.latitude}°, {customResult.longitude}°
              </span>
            </div>
            <p style={{ fontFamily: F.sans, fontSize: 11, color: C.textSecond, marginTop: 6 }}>
              {customResult.health_advisory}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
