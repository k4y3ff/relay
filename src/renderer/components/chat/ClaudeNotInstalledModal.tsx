export default function ClaudeNotInstalledModal() {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2 className="modal-title">Claude Code not found</h2>
        <p className="modal-body">
          Relay requires the Claude Code CLI. Install it with:
        </p>
        <pre className="modal-code">npm install -g @anthropic-ai/claude-code</pre>
        <p className="modal-body modal-body-muted">
          Then restart Relay. If Claude Code is already installed in a custom location,
          make sure it's on your <code>$PATH</code>.
        </p>
      </div>
    </div>
  );
}
