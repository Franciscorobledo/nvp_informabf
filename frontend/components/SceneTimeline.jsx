import React, { useState } from 'react';
import '../src/netflix-movie.css';

/**
 * Timeline visual de escenas estilo Netflix
 */
const SceneTimeline = ({ scenes = [], currentIndex = 0, onSceneClick }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const progress = scenes.length > 0 ? ((currentIndex + 1) / scenes.length) * 100 : 0;

    return (
        <div className="scene-timeline">
            {/* Track de fondo */}
            <div className="timeline-track">
                <div
                    className="timeline-progress"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Dots por escena */}
            <div className="timeline-dots">
                {scenes.map((scene, idx) => (
                    <div
                        key={idx}
                        className={`timeline-dot ${idx === currentIndex ? 'active' : ''} ${idx < currentIndex ? 'completed' : ''}`}
                        onClick={() => onSceneClick(idx)}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        {/* Preview card al hover */}
                        {hoveredIndex === idx && (
                            <div className="scene-preview-card glass-effect animate-fade-zoom">
                                <div className="preview-icon">{getSceneIcon(scene.type)}</div>
                                <p className="preview-title">{scene.title || getSceneLabel(scene.type)}</p>
                                <span className="preview-number">Escena {idx + 1}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Helper functions
const getSceneIcon = (type) => {
    const icons = {
        intro: '🎬',
        timeline: '📈',
        ranking: '🏆',
        comparison: '⚖️',
        distribution: '📊',
        correlation: '🔗',
        anomalies: '⚠️',
        trend: '📉',
        concentration: '🎯',
        risks: '🚨',
        outro: '✨'
    };
    return icons[type] || '📌';
};

const getSceneLabel = (type) => {
    const labels = {
        intro: 'Introducción',
        timeline: 'Línea de Tiempo',
        ranking: 'Ranking',
        comparison: 'Comparativa',
        distribution: 'Distribución',
        correlation: 'Correlación',
        anomalies: 'Anomalías',
        trend: 'Tendencia',
        concentration: 'Concentración',
        risks: 'Alertas',
        outro: 'Cierre'
    };
    return labels[type] || 'Escena';
};

export default SceneTimeline;
