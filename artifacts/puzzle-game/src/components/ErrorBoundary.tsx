import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: 18, padding: 28, textAlign: 'center',
        background: 'linear-gradient(135deg, #0f1223, #1a1035)', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ fontSize: 52 }}>🧩</div>
        <div style={{ color: '#e2d9f3', fontWeight: 800, fontSize: 20 }}>앗! 문제가 생겼어요</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.6, maxWidth: 300 }}>
          예상치 못한 오류가 발생했습니다.<br />잠시 후 다시 시도해주세요.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '11px 28px', borderRadius: 10,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(168,85,247,0.45)',
          }}
        >
          새로고침
        </button>
      </div>
    );
  }
}
