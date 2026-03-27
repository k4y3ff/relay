import { ReactNode } from 'react';
import { useChat } from '../../context/ChatContext';

export default function ClaudeValidationGate({ children }: { children: ReactNode }) {
  const { claudeAvailable } = useChat();

  if (claudeAvailable === false) {
    return (
      <>
        {children}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-mac-surface)',
              border: '1px solid var(--color-mac-border)',
              borderRadius: 12,
              padding: '28px 32px',
              maxWidth: 420,
              width: '90%',
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--color-mac-text)' }}>
              Claude Code not found
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-mac-muted)', lineHeight: 1.6, marginBottom: 16 }}>
              Relay requires the Claude Code CLI to be installed and available on your{' '}
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: 'var(--color-mac-surface2)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  fontSize: 13,
                }}
              >
                $PATH
              </code>
              .
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-mac-muted)', marginBottom: 8 }}>
              Install it by running:
            </p>
            <pre
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                backgroundColor: 'var(--color-mac-bg)',
                borderRadius: 6,
                padding: '10px 14px',
                color: 'var(--color-mac-text)',
                marginBottom: 20,
                userSelect: 'text',
              }}
            >
              npm install -g @anthropic-ai/claude-code
            </pre>
            <p style={{ fontSize: 13, color: 'var(--color-mac-muted)' }}>
              Then relaunch Relay.
            </p>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
