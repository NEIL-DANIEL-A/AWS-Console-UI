import Container from "@cloudscape-design/components/container";
import TextContent from "@cloudscape-design/components/text-content";
import { SERVICES, REGION } from "../services";
import { useNavigate } from "react-router-dom";

export function Home() {
  const navigate = useNavigate();

  return (
    <Container>
      <TextContent>
        <h1>AWS Console</h1>
        <p>
          Local AWS Console connected to the AWS Emulator at{" "}
          <code>https://127.0.0.1:9297</code> (region <code>{REGION}</code>).
          All requests go to the emulator, never to real AWS.
        </p>
      </TextContent>

      <TextContent>
        <h2>Recently visited</h2>
        <p>Pick a service to get started.</p>
      </TextContent>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}>
        {SERVICES.map((s: any) => (
          <div key={s.id} style={{ padding: 16, border: "1px solid #ccc", borderRadius: 8, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }} onClick={() => navigate(s.path)}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{s.label}</div>
            <div style={{ fontSize: 14, color: "#666" }}>{s.description}</div>
          </div>
        ))}
      </div>
    </Container>
  );
}
