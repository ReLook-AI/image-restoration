import React, { useState } from 'react';

// =============================================================================
// SUB-COMPONENTS (Bootstrap 5 Redesign)
// =============================================================================

export function StatCard({ icon, value, label }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body text-center d-flex flex-column justify-content-center p-3">
        <div className="fs-3 mb-1">{icon}</div>
        <div className="fs-4 fw-bold text-primary">{value}</div>
        <div className="small text-muted">{label}</div>
      </div>
    </div>
  )
}

export function Toggle({ label, value, onChange }) {
  return (
    <div className="form-check form-switch mb-3 d-flex justify-content-between align-items-center px-0">
      <label className="form-check-label fw-medium text-secondary" style={{ fontSize: '0.9rem' }}>{label}</label>
      <input 
        className="form-check-input ms-3 mt-0" 
        type="checkbox" 
        role="switch" 
        checked={value} 
        onChange={e => onChange(e.target.checked)} 
        style={{ cursor: 'pointer', width: '2.5em', height: '1.25em' }}
      />
    </div>
  )
}

export function SliderParam({ label, value, min, max, display, onChange }) {
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between mb-1">
        <label className="fw-medium text-secondary" style={{ fontSize: '0.9rem' }}>{label}</label>
        <span className="fw-bold text-primary" style={{ fontSize: '0.9rem' }}>{display}</span>
      </div>
      <input
        type="range"
        className="form-range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function PanelHeader({ title, badge, badgeColor, badgeText }) {
  return (
    <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom bg-light">
      <span className="fw-bold text-primary" style={{ fontSize: '0.85rem' }}>{title}</span>
      {badge && (
        <span className="badge rounded-pill px-3 py-1 bg-primary text-white" style={{ backgroundColor: badgeColor || '#0d6efd', color: badgeText || '#fff' }}>
          {badge}
        </span>
      )}
    </div>
  )
}

export function DropZone() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center h-100 p-5 text-center dropzone-area rounded-3 w-100">
      <i className="bi bi-cloud-arrow-up text-primary mb-3" style={{ fontSize: '3.5rem', opacity: 0.8 }}></i>
      <h5 className="fw-bold text-dark mb-2">Drag & drop or click to upload</h5>
      <p className="small text-muted mb-0">Supports PNG, JPG, TIFF, BMP, WEBP (Max 16MB)</p>
    </div>
  )
}

export function EmptyOutput() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center h-100 p-5 text-center bg-light rounded-3 w-100">
      <i className="bi bi-image text-muted mb-3" style={{ fontSize: '3rem', opacity: 0.5 }}></i>
      <h6 className="fw-bold text-secondary mb-2">No result yet</h6>
      <p className="small text-muted mb-0">Upload an image and click "Run U-Net"</p>
    </div>
  )
}

export function ProcessingOverlay({ step }) {
  return (
    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center" 
         style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(3px)', zIndex: 10 }}>
      <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
        <span className="visually-hidden">Loading...</span>
      </div>
      <h6 className="fw-bold text-dark mb-1">{step.label}</h6>
      <p className="small text-muted mb-3">{step.sub}</p>
      <div className="progress w-50" style={{ height: '8px' }}>
        <div className="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
             role="progressbar" 
             style={{ width: `${step.pct}%` }}>
        </div>
      </div>
    </div>
  )
}

export function ImageSlider({ beforeSrc, afterSrc }) {
  const [sliderPos, setSliderPos] = useState(50);
  
  return (
    <div className="range-slider-wrapper">
      {/* Background/After image */}
      <img src={afterSrc} alt="After" className="range-slider-img" style={{ padding: 8 }} />
      
      {/* Foreground/Before image with moving clip path */}
      <img src={beforeSrc} alt="Before" className="range-slider-overlay" 
           style={{ padding: 8, clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }} />
      
      <input 
        type="range" min="0" max="100" value={sliderPos}
        onChange={(e) => setSliderPos(e.target.value)}
        className="range-slider-input" 
      />
      <div className="slider-handle" style={{ left: `${sliderPos}%` }}></div>
      <span className="badge bg-dark position-absolute bottom-0 start-0 m-3 opacity-75" style={{ zIndex: 25 }}>Before</span>
      <span className="badge bg-primary position-absolute bottom-0 end-0 m-3 opacity-75" style={{ zIndex: 25 }}>After</span>
    </div>
  )
}
