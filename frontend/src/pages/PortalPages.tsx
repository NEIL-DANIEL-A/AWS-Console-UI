import React, { useEffect, useState } from 'react';
import {
  Alert,
  AppLayout,
  Box,
  Button,
  Container,
  ContentLayout,
  Form,
  FormField,
  Header,
  Input,
  Link,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Flashbar,
  TopNavigation,
} from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { useFlashbar } from '../context/FlashbarContext';
import {
  enterPortal,
  enterSingleUserPortal,
  getPortalMe,
  getPortalResult,
  PortalMe,
  PortalResultResponse,
} from '../api/portal';
import { ApiError } from '../api/client';
import { SITE_URL } from '../config/app';
import { formatCountdown } from '../components/ChallengeDrawer';

function PortalShell({ children }: { children: React.ReactNode }) {
  const { items } = useFlashbar();
  return (
    <>
      <TopNavigation identity={{ href: '/lobby', title: 'AWS Console Challenge' }} utilities={[]} />
      <AppLayout
        headerSelector="#top-nav"
        navigationHide
        toolsHide
        notifications={<Flashbar items={items} />}
        content={children}
      />
    </>
  );
}

export const EnterPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    if (!token) return;
    setVerifyingToken(true);
    enterPortal(token)
      .then((result) => {
        if (result.role === 'admin') navigate('/admin/events', { replace: true });
        else navigate('/lobby', { replace: true });
      })
      .catch((err) => {
        const apiErr = err as ApiError;
        const friendly: Record<string, { title: string; message: string }> = {
          TokenReused: { title: 'Link already used', message: 'This entry link has already been used.' },
          InvalidToken: { title: 'Link expired or invalid', message: 'Ask the event organizer for a new link.' },
          ForbiddenDomain: { title: 'Email domain not allowed', message: 'Use an account from the event website.' },
          EventNotOpen: { title: 'Event is not open', message: 'Check the lobby again when the event opens.' },
          EventEnded: { title: 'Event has ended', message: 'This event is no longer accepting participants.' },
        };
        setError(friendly[apiErr.errorName] || {
          title: 'Unable to enter',
          message: apiErr.message || 'Please check your connection and try again.',
        });
      })
      .finally(() => {
        setVerifyingToken(false);
      });
  }, [navigate]);

  const handleLogin = async () => {
    setError(null);
    setLoggingIn(true);
    try {
      await enterSingleUserPortal(username, password);
      navigate('/lobby', { replace: true });
    } catch (err) {
      const apiErr = err as ApiError;
      setError({
        title: apiErr.errorName === 'EventNotOpen' ? 'Event not available' :
          apiErr.errorName === 'InvalidCredentials' ? 'Login failed' : 'Unable to enter',
        message: apiErr.message || 'Please check your connection and try again.',
      });
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <PortalShell>
      <ContentLayout header={<Header variant="h1">{verifyingToken ? 'Entering event' : 'User login'}</Header>}>
        {verifyingToken ? (
          <Container><Spinner size="large" /> <Box variant="p">Verifying your entry link...</Box></Container>
        ) : (
          <SpaceBetween size="l">
            {error && (
              <Alert type="error" header={error.title} action={<Link href={SITE_URL}>Back to the website</Link>}>
                {error.message}
              </Alert>
            )}
            <Container>
              <Box variant="p">Sign in with the account configured by the administrator to join the current event.</Box>
              <Form
                actions={
                  <Button variant="primary" loading={loggingIn} onClick={handleLogin}>
                    Sign in and enter event
                  </Button>
                }
              >
                <SpaceBetween size="l">
                  <FormField label="Username">
                    <Input value={username} onChange={({ detail }) => setUsername(detail.value)} />
                  </FormField>
                  <FormField label="Password">
                    <Input type="password" value={password} onChange={({ detail }) => setPassword(detail.value)} />
                  </FormField>
                </SpaceBetween>
              </Form>
            </Container>
          </SpaceBetween>
        )}
      </ContentLayout>
    </PortalShell>
  );
};

export const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [networkError, setNetworkError] = useState('');

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const data = await getPortalMe();
        if (stopped) return;
        setMe(data);
        setNetworkError('');
        if (data.participant.status === 'running') navigate('/console');
        if (data.participant.status === 'submitted') navigate('/submitted');
        if (data.participant.status === 'grading') navigate('/submitted');
      } catch (err) {
        if (stopped) return;
        const apiErr = err as ApiError;
        if (apiErr.statusCode === 401) navigate('/enter');
        else setNetworkError(apiErr.message || 'Unable to reach the platform.');
      }
    };
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [navigate]);

  const startsAt = me?.event.startsAt ? new Date(me.event.startsAt).getTime() : null;
  const startedAt = me?.event.startedAt ? new Date(me.event.startedAt).getTime() : null;
  const [nowOffset, setNowOffset] = useState(0);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  useEffect(() => {
    if (!me) return;
    const offset = new Date(me.serverTime).getTime() - Date.now();
    setNowOffset(offset);
  }, [me]);

  useEffect(() => {
    if (!startsAt) return;
    const update = () => setCountdownSeconds(Math.max(0, Math.floor((startsAt - (Date.now() + nowOffset)) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startsAt, nowOffset]);

  const countdown = startsAt ? formatCountdown(countdownSeconds) : '';

  const status = me?.participant.status;
  return (
    <PortalShell>
      <ContentLayout
        header={
          <Header variant="h1" description={me?.participant.displayName}>
            {me?.event.name || 'Event lobby'}
          </Header>
        }
      >
        {networkError && <Alert type="error" header="Connection problem">{networkError}</Alert>}
        {!me ? (
          <Container><Spinner /> Loading lobby...</Container>
        ) : (
          <SpaceBetween size="l">
            <Container>
              <SpaceBetween size="m">
                <StatusIndicator type={status === 'running' ? 'success' : status === 'error' ? 'error' : 'in-progress'}>
                  {status === 'entered' ? 'Waiting for the event to start' :
                   status === 'preparing' ? 'Preparing your environment' :
                   status === 'running' ? 'Environment ready' :
                   status === 'grading' ? 'Grading in progress' :
                   status === 'submitted' ? 'Submitted' :
                   status === 'error' ? 'Environment error' : status}
                </StatusIndicator>
                {status === 'entered' && me.event.status === 'draft' && (
                  <Box>The lobby will open when the organizer announces the event.</Box>
                )}
                {status === 'entered' && me.event.status === 'open' && countdown && (
                  <Box variant="h2">Starts in {countdown}</Box>
                )}
                {status === 'preparing' && <Spinner /> }
                {status === 'error' && (
                  <Alert type="error" header="Tell a volunteer">Your environment could not be prepared. {me.participant.errorMessage || ''}</Alert>
                )}
                {me.event.status === 'running' && status === 'entered' && (
                  <Alert type="warning">The event is full or provisioning is still queued.</Alert>
                )}
              </SpaceBetween>
            </Container>
          </SpaceBetween>
        )}
      </ContentLayout>
    </PortalShell>
  );
};

export const SubmittedPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PortalResultResponse | null>(null);
  const [networkError, setNetworkError] = useState('');

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const result = await getPortalResult();
        if (stopped) return;
        setData(result);
        setNetworkError('');
      } catch (err) {
        if (stopped) return;
        const apiErr = err as ApiError;
        if (apiErr.statusCode === 401) navigate('/enter');
        else setNetworkError(apiErr.message || 'Unable to reach the platform.');
      }
    };
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [navigate]);

  return (
    <PortalShell>
      <ContentLayout header={<Header variant="h1">Submission</Header>}>
        {networkError && <Alert type="error" header="Connection problem">{networkError}</Alert>}
        {!data ? <Container><Spinner /> Loading submission status...</Container> : (
          <SpaceBetween size="l">
            <Container>
              {data.status === 'grading' ? (
                <Alert type="info" header="Grading in progress"><Spinner /> Your answer is still being graded.</Alert>
              ) : (
                <Alert type="success" header="Your answer has been submitted" />
              )}
            </Container>
            {data.resultsReleased ? (
              data.result ? (
                <Container>
                  <Header
                    variant="h2"
                    description={`Graded ${new Date(data.result.gradedAt).toLocaleString()}`}
                  >
                    Score: {data.result.score}/{data.result.maxScore}
                  </Header>
                  <SpaceBetween size="s">
                    {data.result.checks.map((check, index) => (
                      <Alert key={check.id || index} type={check.passed ? 'success' : 'error'} header={check.description || check.id || `Check ${index + 1}`}>
                        {check.details || `${(check as { earned?: number; awarded?: number }).earned ?? (check as { awarded?: number }).awarded ?? 0}/${check.points ?? 0} points`}
                      </Alert>
                    ))}
                  </SpaceBetween>
                </Container>
              ) : <Alert type="info">No result is available yet.</Alert>
            ) : (
              <Container><Box>Scores and check details are waiting for the organizer to release results.</Box></Container>
            )}
            <Button href={SITE_URL}>Back to the website</Button>
          </SpaceBetween>
        )}
      </ContentLayout>
    </PortalShell>
  );
};
