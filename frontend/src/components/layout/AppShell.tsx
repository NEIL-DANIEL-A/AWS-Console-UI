import React from "react";
import AppLayout from "@cloudscape-design/components/app-layout";
import { FlashContainer } from "../common/FlashContainer";
import { TopNav } from "./TopNav";
import { SideNav } from "./SideNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [navigationOpen, setNavigationOpen] = React.useState(true);

  return (
    <AppLayout
      navigation={<SideNav />}
      notifications={<FlashContainer />}
      content={
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
          <TopNav />
          <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
            {children}
          </div>
        </div>
      }
      navigationOpen={navigationOpen}
      onNavigationChange={(event: any) => setNavigationOpen(event.detail.open)}
      ariaLabels={{
        navigation: "Service navigation",
        navigationToggle: "Toggle navigation",
        navigationClose: "Close navigation",
      }}
    />
  );
}
