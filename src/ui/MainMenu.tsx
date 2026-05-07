import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { usePWAInstall } from '../utils/usePWAInstall';

function IOSInstallTooltip({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        paddingBottom: 32,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16, padding: '20px 24px', maxWidth: 320,
          textAlign: 'center', color: '#fff',
        }}
        onClick={e => e.stopPropagation()}
      >
        <p style={{ margin: 0, fontSize: 28 }}>📲</p>
        <p style={{ margin: '10px 0 4px', fontWeight: 700, fontSize: 16 }}>Add to Home Screen</p>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6 }}>
          Tap <strong style={{ color: '#fff' }}>Share ↑</strong> at the bottom of Safari,<br />
          then choose <strong style={{ color: '#fff' }}>"Add to Home Screen"</strong>
        </p>
        <button
          onClick={onClose}
          style={{
            marginTop: 16, width: '100%', padding: '10px 0',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, color: '#fff', fontSize: 14, cursor: 'pointer',
          }}
        >
          Got it
        </button>
      </div>
      {/* Arrow pointing down toward iOS share bar */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '10px solid transparent',
        borderRight: '10px solid transparent',
        borderTop: '12px solid #1c1c1e',
      }} />
    </div>
  );
}

export function MainMenu() {
  const { initEngine } = useGameStore();
  const { installState, install } = usePWAInstall();
  const [showIOS, setShowIOS] = useState(false);

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: '#050505',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', touchAction: 'none',
      }}
    >
      {/* Background atmosphere */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 30% 40%, rgba(120,0,0,0.18) 0%, transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(0,30,0,0.1) 0%, transparent 55%)',
      }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(10px, 2.5vh, 24px)', textAlign: 'center', padding: '0 24px' }}>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <p style={{ margin: '0 0 4px', color: '#f59e0b', fontWeight: 700, fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase' }}>
            🐜 הגנת המטבח · 10 גלים
          </p>
          <div style={{ lineHeight: 0.92, letterSpacing: '-0.03em' }}>
            <span style={{ display: 'block', color: '#fff', fontWeight: 900, fontSize: 'clamp(32px, 8vw, 64px)', textShadow: '0 0 60px rgba(245,158,11,0.5), 0 2px 4px rgba(0,0,0,0.8)' }}>BUG</span>
            <span style={{ display: 'block', color: '#f59e0b', fontWeight: 900, fontSize: 'clamp(32px, 8vw, 64px)', textShadow: '0 0 70px rgba(245,158,11,0.8), 0 2px 4px rgba(0,0,0,0.8)' }}>OFF!</span>
          </div>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 1.5, maxWidth: 260 }}>
            נמלים פולשות לבית! הצב מלכודות ועצור אותן.
          </p>
        </div>

        {/* CTA */}
        <button
          onPointerDown={() => initEngine()}
          style={{
            background: '#d97706', color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
            fontWeight: 900, fontSize: 17, letterSpacing: '0.08em',
            padding: 'clamp(10px,2vh,15px) 48px', minHeight: 48, borderRadius: 14,
            boxShadow: '0 8px 32px rgba(217,119,6,0.5)',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}
        >
          🛡 להגנה!
        </button>

        {/* Tips */}
        <div style={{ display: 'flex', gap: 8, maxWidth: 360 }}>
          {[
            { icon: '🪲', label: 'הצב מלכודות' },
            { icon: '🌊', label: '10 גלי חרקים' },
            { icon: '🏠', label: 'הגן על הבית' },
          ].map(({ icon, label }) => (
            <div key={label} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 8px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ color: '#f3f4f6', fontSize: 10, fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Install button */}
        {installState === 'ready' && (
          <button
            onPointerDown={install}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600,
              padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 18 }}>📲</span>
            Install App
          </button>
        )}

        {installState === 'ios-manual' && (
          <button
            onPointerDown={() => setShowIOS(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600,
              padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 18 }}>📲</span>
            Add to Home Screen
          </button>
        )}

        {installState === 'installed' && (
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, margin: 0 }}>✓ Installed</p>
        )}
      </div>

      {showIOS && <IOSInstallTooltip onClose={() => setShowIOS(false)} />}
    </div>
  );
}
