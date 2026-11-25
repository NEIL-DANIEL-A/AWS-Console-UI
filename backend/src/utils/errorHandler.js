/**
 * Formats AWS SDK v3 errors for the frontend, preserving AWS error names and messages.
 * Explicitly flags HTTP 501 responses as not implemented in the emulator.
 */
export function handleAwsError(res, err) {
  const statusCode = err?.$metadata?.httpStatusCode || err?.statusCode || 500;
  const errorName = err?.name || err?.Code || 'InternalError';
  const rawMessage = err?.message || 'An unexpected error occurred';

  if (statusCode === 501) {
    return res.status(501).json({
      error: errorName,
      message: `Not implemented in emulator: ${rawMessage}`,
      statusCode: 501,
    });
  }

  return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: errorName,
    message: rawMessage,
    statusCode,
  });
}
