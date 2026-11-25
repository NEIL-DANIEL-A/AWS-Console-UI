import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, AppLayout, Box, BreadcrumbGroup, Button, ColumnLayout, Container,
  ContentLayout, Flashbar, Form, FormField, Header, Input, Link, Modal,
  Select, SpaceBetween, StatusIndicator, Table, Tabs, TextFilter, Toggle, TopNavigation,
} from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router-dom';
import { useFlashbar } from '../context/FlashbarContext';
import { ApiError } from '../api/client';
import {
  AdminChallenge, AdminEvent, AdminParticipant, PortalResult,
  adminLogin, createAdminEvent, endAdminEvent, getAdminEvent, getAdminResults,
  listAdminChallenges, listAdminEvents, openAdminEvent, restartAdminParticipant,
  setAdminResultsRelease, startAdminEvent, updateAdminEvent,
} from '../api/portal';

function AdminShell({ breadcrumbs, children }: { breadcrumbs?: Array<{ text: string; href: string }>; children: React.ReactNode }) {
  const { items } = useFlashbar();
  return (
    <>
      <TopNavigation identity={{ href: '/admin/events', title: 'AWS Console Admin' }} utilities={[]} />
      <AppLayout
        headerSelector="#top-nav"
        navigationHide
        toolsHide
        notifications={<Flashbar items={items} />}
        breadcrumbs={breadcrumbs ? (
          <BreadcrumbGroup
            items={[{ text: 'Admin', href: '/admin/events' }, ...breadcrumbs]}
            onFollow={(event) => { event.preventDefault(); window.location.href = event.detail.href; }}
          />
        ) : undefined}
        content={children}
      />
    </>
  );
}

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = async () => {
    setLoading(true);
    setError('');
    try {
      await adminLogin(password);
      navigate('/admin/events', { replace: true });
    } catch (err) {
      setError((err as ApiError).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };
  return (
    <AdminShell>
      <ContentLayout header={<Header variant="h1">Admin login</Header>}>
        <Container>
          {error && <Alert type="error" header="Login failed">{error}</Alert>}
          <Form actions={<SpaceBetween direction="horizontal" size="xs"><Button variant="primary" loading={loading} onClick={login}>Sign in</Button></SpaceBetween>}>
            <FormField label="Password"><Input type="password" value={password} onChange={({ detail }) => setPassword(detail.value)} /></FormField>
          </Form>
        </Container>
      </ContentLayout>
    </AdminShell>
  );
};

export const AdminEventsPage: React.FC = () => {
  const navigate = useNavigate();
  const { addFlash } = useFlashbar();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [timeLimit, setTimeLimit] = useState(15);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eventData, challengeData] = await Promise.all([listAdminEvents(), listAdminChallenges()]);
      setEvents(eventData.events);
      setChallenges(challengeData.challenges);
      if (!challengeId && challengeData.challenges[0]) setChallengeId(challengeData.challenges[0].id);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.statusCode === 401) navigate('/admin/login');
      else addFlash({ type: 'error', header: 'Unable to load events', content: apiErr.message });
    } finally {
      setLoading(false);
    }
  }, [addFlash, navigate, challengeId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim() || !challengeId || timeLimit <= 0) return;
    setCreating(true);
    try {
      const result = await createAdminEvent({ name: name.trim(), description, challengeId, timeLimitMinutes: timeLimit });
      setShowCreate(false);
      setName('');
      setDescription('');
      await load();
      navigate(`/admin/events/${encodeURIComponent(result.event.id)}`);
    } catch (err) {
      addFlash({ type: 'error', header: 'Event not created', content: (err as ApiError).message });
    } finally {
      setCreating(false);
    }
  };

  const statusType = (status: string): 'success' | 'info' | 'warning' | 'error' => {
    if (status === 'running') return 'success';
    if (status === 'ended') return 'error';
    if (status === 'open') return 'info';
    return 'warning';
  };

  return (
    <AdminShell breadcrumbs={[{ text: 'Events', href: '/admin/events' }]}>
      <ContentLayout header={<Header variant="h1" actions={<Button variant="primary" onClick={() => setShowCreate(true)}>Create event</Button>}>Events</Header>}>
        <Table
          loading={loading}
          loadingText="Loading events..."
          filter={<TextFilter filteringText={filter} filteringPlaceholder="Filter events" onChange={({ detail }) => setFilter(detail.filteringText)} />}
          items={events.filter((event) => event.name.toLowerCase().includes(filter.toLowerCase()))}
          trackBy="id"
          empty={<Box textAlign="center"><b>No events</b><br />Create an event to get started.</Box>}
          columnDefinitions={[
            { id: 'name', header: 'Name', cell: (item) => <Link href={`/admin/events/${item.id}`} onFollow={(event) => { event.preventDefault(); navigate(`/admin/events/${item.id}`); }}>{item.name}</Link> },
            { id: 'status', header: 'Status', cell: (item) => <StatusIndicator type={statusType(item.status)}>{item.status}</StatusIndicator> },
            { id: 'participants', header: 'Participants', cell: (item) => item.participantCount ?? 0 },
            { id: 'challenge', header: 'Challenge', cell: (item) => item.challengeId },
            { id: 'timeLimit', header: 'Time limit', cell: (item) => `${item.timeLimitMinutes} min` },
          ]}
        />
      </ContentLayout>
      <Modal visible={showCreate} onDismiss={() => setShowCreate(false)} header="Create event"
        footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button onClick={() => setShowCreate(false)}>Cancel</Button><Button variant="primary" loading={creating} onClick={create}>Create</Button></SpaceBetween></Box>}
      >
        <Form>
          <SpaceBetween size="l">
            <FormField label="Name" constraintText="Required"><Input value={name} onChange={({ detail }) => setName(detail.value)} /></FormField>
            <FormField label="Description"><Input value={description} onChange={({ detail }) => setDescription(detail.value)} /></FormField>
            <FormField label="Challenge">
              <Select
                selectedOption={challenges.find((item) => item.id === challengeId) ? { label: challenges.find((item) => item.id === challengeId)?.title, value: challengeId } : null}
                options={challenges.map((item) => ({ label: item.title, value: item.id }))}
                onChange={({ detail }) => setChallengeId(detail.selectedOption.value || '')}
              />
            </FormField>
            <FormField label="Time limit (minutes)"><Input type="number" value={String(timeLimit)} onChange={({ detail }) => setTimeLimit(Number(detail.value) || 0)} /></FormField>
          </SpaceBetween>
        </Form>
      </Modal>
    </AdminShell>
  );
};

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export const AdminEventDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { addFlash } = useFlashbar();
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [results, setResults] = useState<Array<PortalResult & { email: string; displayName: string }>>([]);
  const [resultsReleased, setResultsReleased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(15);
  const [actionModal, setActionModal] = useState<'open' | 'start' | 'end' | null>(null);
  const [selectedResult, setSelectedResult] = useState<(PortalResult & { email: string; displayName: string }) | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTabId, setActiveTabId] = useState('details');

  const load = useCallback(async () => {
    try {
      const data = await getAdminEvent(id);
      setEvent(data.event);
      setParticipants(data.participants);
      if (data.event.status === 'ended' || data.participants.some((participant) => participant.status === 'submitted')) {
        const resultData = await getAdminResults(id);
        setResults(resultData.results);
        setResultsReleased(resultData.resultsReleased);
      }
      setName(data.event.name);
      setDescription(data.event.description);
      setTimeLimit(data.event.timeLimitMinutes);
      setResultsReleased(Boolean(data.event.resultsReleased));
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.statusCode === 401) navigate('/admin/login');
      else addFlash({ type: 'error', header: 'Unable to load event', content: apiErr.message });
    } finally {
      setLoading(false);
    }
  }, [id, navigate, addFlash]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [load]);

  const loadResults = useCallback(async () => {
    try {
      const data = await getAdminResults(id);
      setResults(data.results);
      setResultsReleased(data.resultsReleased);
    } catch (err) {
      addFlash({ type: 'error', header: 'Unable to load results', content: (err as ApiError).message });
    }
  }, [id, addFlash]);

  useEffect(() => { loadResults(); }, [loadResults]);

  const saveDetails = async () => {
    try {
      const data = await updateAdminEvent(id, { name, description, timeLimitMinutes: timeLimit });
      setEvent(data.event);
      addFlash({ type: 'success', header: 'Event details saved' });
    } catch (err) {
      addFlash({ type: 'error', header: 'Unable to save details', content: (err as ApiError).message });
    }
  };

  const runAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      if (actionModal === 'open') await openAdminEvent(id);
      if (actionModal === 'start') await startAdminEvent(id);
      if (actionModal === 'end') await endAdminEvent(id);
      setActionModal(null);
      await load();
    } catch (err) {
      addFlash({ type: 'error', header: 'Event action failed', content: (err as ApiError).message });
    } finally {
      setActionLoading(false);
    }
  };

  const restartParticipant = async (participant: AdminParticipant) => {
    try {
      await restartAdminParticipant(id, participant.websiteUserId);
      addFlash({ type: 'success', header: `Environment restarted for ${participant.displayName}` });
      await load();
    } catch (err) {
      addFlash({ type: 'error', header: 'Restart failed', content: (err as ApiError).message });
    }
  };

  const toggleRelease = async (released: boolean) => {
    try {
      await setAdminResultsRelease(id, released);
      setResultsReleased(released);
      addFlash({ type: 'success', header: released ? 'Results released' : 'Results hidden' });
    } catch (err) {
      addFlash({ type: 'error', header: 'Unable to update results', content: (err as ApiError).message });
    }
  };

  const downloadCsv = () => { window.location.href = `/api/admin/events/${encodeURIComponent(id)}/results.csv`; };
  const downloadSnapshot = () => {
    if (!selectedResult) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(selectedResult.snapshot, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedResult.websiteUserId}-snapshot.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const statusCounts = participants.reduce<Record<string, number>>((counts, participant) => {
    counts[participant.status] = (counts[participant.status] || 0) + 1;
    return counts;
  }, {});
  const modalCopy = actionModal === 'open'
    ? ['Open the lobby?', 'Participants will be able to enter before the event starts.']
    : actionModal === 'start'
    ? ['Start the event?', 'The countdown begins and environments are provisioned.']
    : ['End the event?', 'All remaining environments will be graded and stopped.'];

  return (
    <AdminShell breadcrumbs={[{ text: 'Events', href: '/admin/events' }, { text: event?.name || id, href: `/admin/events/${id}` }]}>
      <ContentLayout header={
        <Header variant="h1" description={event?.challengeId} actions={
          <SpaceBetween direction="horizontal" size="xs">
            {event?.status === 'draft' && <Button onClick={() => setActionModal('open')}>Open lobby</Button>}
            {(event?.status === 'draft' || event?.status === 'open') && <Button variant="primary" onClick={() => setActionModal('start')}>Start</Button>}
            {event?.status === 'running' && <Button variant="primary" onClick={() => setActionModal('end')}>End</Button>}
          </SpaceBetween>
        }>{event?.name || id}</Header>
      }>
        <Tabs
          activeTabId={activeTabId}
          onChange={({ detail }) => {
            setActiveTabId(detail.activeTabId);
            if (detail.activeTabId === 'results') loadResults();
          }}
          tabs={[
          {
            id: 'details', label: 'Details',
            content: (
              <Container>
                {event?.status === 'running' || event?.status === 'ended'
                  ? <Alert type="info">Details are locked after the event starts.</Alert>
                  : <Form actions={<Button variant="primary" onClick={saveDetails}>Save changes</Button>}>
                      <SpaceBetween size="l">
                        <FormField label="Name"><Input value={name} onChange={({ detail }) => setName(detail.value)} /></FormField>
                        <FormField label="Description"><Input value={description} onChange={({ detail }) => setDescription(detail.value)} /></FormField>
                        <FormField label="Time limit (minutes)"><Input type="number" value={String(timeLimit)} onChange={({ detail }) => setTimeLimit(Number(detail.value) || 0)} /></FormField>
                      </SpaceBetween>
                    </Form>}
              </Container>
            ),
          },
          {
            id: 'control', label: 'Control',
            content: (
              <SpaceBetween size="l">
                <Container>
                  <Header variant="h2">Participant counts</Header>
                  <ColumnLayout columns={4}>
                    {['entered', 'preparing', 'running', 'submitted', 'grading', 'error'].map((status) => (
                      <Container key={status}><Box variant="awsui-key-label">{status}</Box><Box variant="h2">{statusCounts[status] || 0}</Box></Container>
                    ))}
                  </ColumnLayout>
                </Container>
                <Table
                  loading={loading}
                  loadingText="Loading participants..."
                  empty={<Box textAlign="center"><b>No participants</b></Box>}
                  items={participants}
                  trackBy="websiteUserId"
                  columnDefinitions={[
                    { id: 'name', header: 'Participant', cell: (item) => item.displayName },
                    { id: 'email', header: 'Email', cell: (item) => item.email },
                    { id: 'status', header: 'Status', cell: (item) => <StatusIndicator type={item.status === 'running' ? 'success' : item.status === 'error' ? 'error' : item.status === 'submitted' ? 'success' : 'in-progress'}>{item.status}</StatusIndicator> },
                    { id: 'time', header: 'Time left', cell: (item) => item.timeLeftSeconds ? formatSeconds(item.timeLeftSeconds) : '-' },
                    { id: 'grade', header: 'Grade', cell: (item) => item.grade ? `${item.grade.score}/${item.grade.maxScore}` : item.status === 'grading' ? 'Grading…' : '-' },
                    { id: 'actions', header: 'Actions', cell: (item) => <Button disabled={event?.status !== 'running'} onClick={() => restartParticipant(item)}>Restart environment</Button> },
                  ]}
                />
              </SpaceBetween>
            ),
          },
          {
            id: 'results', label: 'Results',
            content: (
              <SpaceBetween size="l">
                <Container>
                  <ColumnLayout columns={2}>
                    <Box><Toggle checked={resultsReleased} onChange={({ detail }) => toggleRelease(detail.checked)}>Release results</Toggle></Box>
                    <Box textAlign="right"><Button iconName="download" onClick={downloadCsv}>Export CSV</Button></Box>
                  </ColumnLayout>
                </Container>
                <Table
                  items={results}
                  trackBy="websiteUserId"
                  onSelectionChange={({ detail }) => setSelectedResult(detail.selectedItems[0] || null)}
                  onRowClick={({ detail }) => setSelectedResult(detail.item)}
                  selectionType="single"
                  empty={<Box textAlign="center"><b>No results</b></Box>}
                  columnDefinitions={[
                    { id: 'rank', header: 'Rank', cell: (item) => results.findIndex((result) => result.websiteUserId === item.websiteUserId) + 1 },
                    { id: 'name', header: 'Participant', cell: (item) => item.displayName },
                    { id: 'score', header: 'Score', cell: (item) => `${item.score}/${item.maxScore}` },
                    { id: 'time', header: 'Time', cell: (item) => item.timeTakenSeconds ?? '-' },
                    { id: 'reason', header: 'Reason', cell: (item) => item.reason },
                  ]}
                />
                {selectedResult && (
                  <Container>
                    <Header variant="h2" actions={<Button iconName="download" onClick={downloadSnapshot}>Download snapshot JSON</Button>}>
                      {selectedResult.displayName} - check breakdown
                    </Header>
                    <SpaceBetween size="s">
                      {selectedResult.checks.map((check, index) => (
                        <Alert key={check.id || index} type={check.passed ? 'success' : 'error'} header={check.description || check.id || `Check ${index + 1}`}>
                          {check.details || `${check.awarded ?? check.earned ?? 0}/${check.points ?? 0} points`}
                        </Alert>
                      ))}
                    </SpaceBetween>
                  </Container>
                )}
              </SpaceBetween>
            ),
          },
        ]} />
      </ContentLayout>
      <Modal visible={Boolean(actionModal)} onDismiss={() => setActionModal(null)} header={modalCopy[0]}
        footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button onClick={() => setActionModal(null)} disabled={actionLoading}>Cancel</Button><Button variant="primary" loading={actionLoading} onClick={runAction}>{actionModal === 'open' ? 'Open lobby' : actionModal === 'start' ? 'Start' : 'End event'}</Button></SpaceBetween></Box>}
      >{modalCopy[1]}</Modal>
    </AdminShell>
  );
};
