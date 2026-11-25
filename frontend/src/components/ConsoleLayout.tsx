import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AppLayout,
  BreadcrumbGroup,
  BreadcrumbGroupProps,
  Flashbar,
  Input,
  SideNavigation,
  SideNavigationProps,
  TopNavigation,
} from '@cloudscape-design/components';
import { SERVICES } from '../config/services';
import { useFlashbar } from '../context/FlashbarContext';
import { apiFetch } from '../api/client';
import { usePortalConsole } from '../context/PortalConsoleContext';
import { ChallengeDrawer } from './ChallengeDrawer';
import { getPortalMe, PortalMe, submitPortalAnswer } from '../api/portal';

interface HealthResponse {
  status: string;
  emulatorReachable: boolean;
  region: string;
}

interface ConsoleLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbGroupProps.Item[];
}

export const ConsoleLayout: React.FC<ConsoleLayoutProps> = ({ children, breadcrumbs = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { items: flashItems } = useFlashbar();
  const portalConsole = usePortalConsole();
  const { challengeToolsOpen, setChallengeToolsOpen } = portalConsole;
  const [searchValue, setSearchValue] = useState('');
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [emulatorReachable, setEmulatorReachable] = useState<boolean | null>(null);
  const [portalMe, setPortalMe] = useState<PortalMe | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { addFlash } = useFlashbar();

  useEffect(() => {
    if (!challengeToolsOpen) return;
    let stopped = false;
    const poll = async () => {
      try {
        const me = await getPortalMe();
        if (stopped) return;
        setPortalMe(me);
        if (me.participant.status !== 'running') {
          if (me.participant.status === 'submitted' || me.participant.status === 'grading') {
            navigate('/submitted');
          } else if (me.participant.status === 'error') {
            navigate('/lobby');
          }
        }
      } catch (err) {
        if (stopped) return;
        const apiErr = err as { statusCode?: number; errorName?: string; message?: string };
        if (apiErr.statusCode === 401) navigate('/lobby');
      }
    };
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [challengeToolsOpen, navigate]);

  useEffect(() => {
    if (!portalMe) return;
    const serverOffset =
      new Date(portalMe.serverTime).getTime() - Date.now();
    const update = () => {
      if (portalMe.event.endsAt) {
        const left = Math.floor(
          (new Date(portalMe.event.endsAt).getTime() -
            (Date.now() + serverOffset)) /
            1000
        );
        setSecondsLeft(Math.max(0, left));
        if (left <= 0) navigate('/submitted');
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [portalMe, navigate]);

  useEffect(() => {
    if (!portalMe || secondsLeft !== 300) return;
    addFlash({
      type: 'warning',
      header: '5 minutes remaining',
      content: 'Submit your answer soon; changes are locked after submission.',
    });
  }, [secondsLeft, portalMe, addFlash]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitPortalAnswer();
      setSubmitModalOpen(false);
      navigate('/submitted');
    } catch (err) {
      const apiErr = err as { errorName?: string; message?: string };
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Submission failed',
        content: apiErr.message || 'Unable to submit. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    apiFetch<HealthResponse>('/api/health')
      .then((data) => setEmulatorReachable(data.emulatorReachable))
      .catch(() => setEmulatorReachable(false));
  }, [location.pathname]);

  const handleSearchKeyDown = (event: CustomEvent<{ key: string }>) => {
    if (event.detail.key === 'Enter' && searchValue.trim()) {
      const q = searchValue.trim().toLowerCase();
      const match = SERVICES.find(
        (s) =>
          s.enabled &&
          (s.name.toLowerCase().includes(q) ||
            s.shortName.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q))
      );
      if (match) {
        navigate(match.path);
        setSearchValue('');
      }
    }
  };

  const isEc2 = location.pathname.startsWith('/ec2');
  const isS3 = location.pathname.startsWith('/s3');

  let navHeader: { href: string; text: string } = { href: '/', text: 'AWS Console' };
  let navItems: SideNavigationProps.Item[] = [];

  if (isEc2) {
    navHeader = { href: '/ec2/security-groups', text: 'EC2' };
    navItems = [
      { type: 'link', text: 'Security Groups', href: '/ec2/security-groups' },
      { type: 'divider' },
      { type: 'link', text: 'Console Home', href: '/' },
    ];
  } else if (isS3) {
    navHeader = { href: '/s3', text: 'Amazon S3' };
    navItems = [
      { type: 'link', text: 'Buckets', href: '/s3' },
      { type: 'divider' },
      { type: 'link', text: 'Console Home', href: '/' },
    ];
  } else {
    navItems = [
      { type: 'link', text: 'Console Home', href: '/' },
      { type: 'divider' },
      {
        type: 'section',
        text: 'Services',
        items: SERVICES.filter((s) => s.enabled).map((s) => ({
          type: 'link' as const,
          text: s.name,
          href: s.path,
        })),
      },
    ];
  }

  const activeHref = location.pathname;

  return (
    <>
      <div id="top-nav" style={{ position: 'sticky', top: 0, zIndex: 1002 }}>
        <TopNavigation
          identity={{
            href: '/',
            title: 'AWS Console',
            onFollow: (e) => {
              e.preventDefault();
              navigate('/');
            },
          }}
          search={
            <Input
              type="search"
              placeholder="Search for services (e.g. EC2, S3)"
              value={searchValue}
              onChange={({ detail }) => setSearchValue(detail.value)}
              onKeyDown={handleSearchKeyDown}
              ariaLabel="Search services"
            />
          }
          utilities={[
            {
              type: 'menu-dropdown',
              text: 'Services',
              items: SERVICES.filter((s) => s.enabled).map((s) => ({
                id: s.id,
                text: s.name,
                href: s.path,
              })),
              onItemFollow: (event) => {
                event.preventDefault();
                const service = SERVICES.find((s) => s.id === event.detail.id);
                if (service?.enabled) navigate(service.path);
              },
            },
            {
              type: 'button',
              text:
                emulatorReachable === null
                  ? 'Emulator: Checking...'
                  : emulatorReachable
                  ? 'Emulator: Connected'
                  : 'Emulator: Disconnected',
              iconName: emulatorReachable ? 'status-positive' : 'status-warning',
            },
            {
              type: 'button',
              text: 'us-east-1',
              iconName: 'globe',
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#top-nav"
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        navigation={
          <SideNavigation
            activeHref={activeHref}
            header={navHeader}
            onFollow={(e) => {
              e.preventDefault();
              navigate(e.detail.href);
            }}
            items={navItems}
          />
        }
        notifications={<Flashbar items={flashItems} />}
        tools={
          challengeToolsOpen && portalMe?.scenario ? (
            <ChallengeDrawer
              title={portalMe.scenario.title}
              description={portalMe.scenario.description}
              secondsLeft={secondsLeft}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitModalOpen={submitModalOpen}
              setSubmitModalOpen={setSubmitModalOpen}
            />
          ) : undefined
        }
        toolsOpen={challengeToolsOpen}
        onToolsChange={({ detail }) => setChallengeToolsOpen(detail.open)}
        breadcrumbs={
          breadcrumbs.length > 0 ? (
            <BreadcrumbGroup
              items={[{ text: 'AWS Console', href: '/' }, ...breadcrumbs]}
              onFollow={(e) => {
                e.preventDefault();
                navigate(e.detail.href);
              }}
            />
          ) : undefined
        }
        content={children}
        toolsHide={false}
      />
    </>
  );
};
