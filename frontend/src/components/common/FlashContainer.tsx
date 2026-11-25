import React from "react";
import Flashbar from "@cloudscape-design/components/flashbar";

export interface Flash {
  id: string;
  type: "success" | "error" | "warning" | "info";
  header?: string;
  message: string;
}

interface FlashContainerState {
  flashes: Flash[];
  add: (flash: Omit<Flash, "id">) => void;
  dismiss: (id: string) => void;
}

const FlashContainerContext = React.createContext<FlashContainerState>({
  flashes: [],
  add: () => {},
  dismiss: () => {},
});

export function FlashContainer() {
  const [flashes, setFlashes] = React.useState<Flash[]>([]);

  const add = (flash: Omit<Flash, "id">) => {
    const id = `${flash.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setFlashes((prev) => [...prev, { ...flash, id }]);
    setTimeout(() => {
      setFlashes((prev) => prev.filter((f) => f.id !== id));
    }, 5000);
  };

  const dismiss = (id: string) => {
    setFlashes((prev) => prev.filter((f) => f.id !== id));
  };

  const items = flashes.map((f) => ({
    id: f.id,
    type: f.type,
    header: f.header,
    content: f.message,
    dismissible: true,
    onDismiss: () => dismiss(f.id),
  }));

  return (
    <FlashContainerContext.Provider value={{ flashes, add, dismiss }}>
      <Flashbar
        items={items}
        i18nStrings={{ ariaLabel: "Notifications" }}
      />
    </FlashContainerContext.Provider>
  );
}

export function useFlash() {
  return React.useContext(FlashContainerContext);
}
