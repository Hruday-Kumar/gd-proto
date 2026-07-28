// M2 (audit 2026-07-28): global Express error-handling middleware. Must be
// registered LAST, after every router -- Express only routes a 4-arg
// function to the error path. Structured (JSON-line) logging so a real
// failure during a live pilot session shows up in Render's logs instead of
// vanishing into Express's own default HTML error page.
export function createErrorHandler({ logger = console } = {}) {
  return (err, req, res, next) => {
    logger.error(
      JSON.stringify({
        level: 'error',
        message: err.message,
        method: req.method,
        path: req.originalUrl,
        stack: err.stack,
        at: new Date().toISOString(),
      })
    );

    // Express's own documented contract: if a response is already underway,
    // delegate to the built-in handler rather than trying to send a second
    // one (res.status/json would throw ERR_HTTP_HEADERS_SENT).
    if (res.headersSent) return next(err);

    // Only a deliberate, explicitly-tagged client error (err.status < 500)
    // is safe to echo back verbatim -- an unanticipated error's raw
    // message could leak internals (query shape, file paths, etc.), so it
    // stays generic to the client and full-detail only in the log above.
    const status = Number.isInteger(err.status) && err.status < 500 ? err.status : 500;
    const message = status === 500 ? 'Internal server error' : err.message;
    res.status(status).json({ error: message });
  };
}
