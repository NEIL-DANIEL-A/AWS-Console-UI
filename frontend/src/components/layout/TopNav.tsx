import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import { useNavigate } from "react-router-dom";
import { REGION } from "../../services";

export function TopNav() {
  const navigate = useNavigate();

  const handleSearch = () => {
    navigate("/s3");
  };

  return (
    <div style={{ padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 64, borderBottom: "1px solid #e0e0e0", background: "#fff" }}>
      <Header variant="h1" secondaryContent={REGION}>
        AWS Console
      </Header>
      <div style={{ flex: 1, maxWidth: 300 }}>
        <Input
          value=""
          onChange={handleSearch}
          type="search"
        />
      </div>
      <Button variant="primary" href="/s3">
        S3
      </Button>
    </div>
  );
}
