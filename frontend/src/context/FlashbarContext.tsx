import React, { createContext, useCallback, useContext, useState } from 'react';
import { FlashbarProps } from '@cloudscape-design/components';

interface FlashbarContextValue {
  items: FlashbarProps.MessageDefinition[];
  addFlash: (item: Omit<FlashbarProps.MessageDefinition, 'id' | 'dismissible' | 'onDismiss'>) => void;
  dismissFlash: (id: string) => void;
}

const FlashbarContext = createContext<FlashbarContextValue | undefined>(undefined);

export const FlashbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);

  const dismissFlash = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addFlash = useCallback(
    (item: Omit<FlashbarProps.MessageDefinition, 'id' | 'dismissible' | 'onDismiss'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [
        {
          ...item,
          id,
          dismissible: true,
          onDismiss: () => dismissFlash(id),
        },
        ...prev,
      ]);
    },
    [dismissFlash]
  );

  return (
    <FlashbarContext.Provider value={{ items, addFlash, dismissFlash }}>
      {children}
    </FlashbarContext.Provider>
  );
};

export function useFlashbar() {
  const ctx = useContext(FlashbarContext);
  if (!ctx) {
    throw new Error('useFlashbar must be used within a FlashbarProvider');
  }
  return ctx;
}
