import Spinner from "@cloudscape-design/components/spinner";

interface SpinnerProps {
  loading?: boolean;
  message?: string;
}

export function LoadingSpinner({ loading = true, message }: SpinnerProps) {
  if (!loading) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
      <Spinner />
      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
}
