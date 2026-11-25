import React, { createContext, useContext, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PortalConsoleValue {
  challengeToolsOpen: boolean;
  setChallengeToolsOpen: (open: boolean) => void;
}

const PortalConsoleContext = createContext<PortalConsoleValue>({
  challengeToolsOpen: false,
  setChallengeToolsOpen: () => {},
});

export const PortalConsoleProvider: React.FC<{ enabled: boolean; children: React.ReactNode }> = ({
  enabled,
  children,
}) => {
  const location = useLocation();
  const [challengeToolsOpen, setChallengeToolsOpen] = useState(true);
  const [portalEnabled, setPortalEnabled] = React.useState(false);

  React.useEffect(() => {
    const portalRoute =
      location.pathname === '/console' ||
      location.pathname.startsWith('/s3') ||
      location.pathname.startsWith('/ec2');
    if (!portalRoute) {
      setPortalEnabled(false);
      return;
    }
    let stopped = false;
    fetch('/api/portal/me')
      .then((response) => {
        if (!stopped) setPortalEnabled(response.ok);
      })
      .catch(() => {
        if (!stopped) setPortalEnabled(false);
      });
    return () => { stopped = true; };
  }, [location.pathname]);

  const valueEnabled = enabled && portalEnabled;
  return (
    <PortalConsoleContext.Provider
      value={{
        challengeToolsOpen: valueEnabled ? challengeToolsOpen : false,
        setChallengeToolsOpen,
      }}
    >
      {children}
    </PortalConsoleContext.Provider>
  );
};

export function usePortalConsole() {
  return useContext(PortalConsoleContext);
}
