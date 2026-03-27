import type { ErrorMessage } from '../../types/chat';

interface Props {
  message: ErrorMessage;
}

export default function ErrorBanner({ message }: Props) {
  const isAuthError = /not authenticated|login|auth/i.test(message.text);

  return (
    <div className="error-banner">
      <span className="error-banner-text">{message.text}</span>
      {isAuthError && (
        <span className="error-banner-hint">
          Run <code>claude login</code> in the terminal below to authenticate, then try again.
        </span>
      )}
    </div>
  );
}
