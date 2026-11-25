import SideNavigation from "@cloudscape-design/components/side-navigation";
import { useNavigate } from "react-router-dom";
import { SERVICES } from "../../services";

export function SideNav() {
  const navigate = useNavigate();

  const items = SERVICES.map((s) => ({
    type: "link" as const,
    text: s.label,
    href: s.path,
    id: s.id,
  }));

  const handleFollow = (event: any) => {
    event.preventDefault();
    navigate(event.detail.href);
  };

  return (
    <SideNavigation
      header={{ text: "AWS Console", href: "/" }}
      items={items}
      onFollow={handleFollow}
    />
  );
}
