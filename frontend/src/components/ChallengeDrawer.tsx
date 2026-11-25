import React from 'react';
import { Box, Button, Container, Header, Modal, SpaceBetween } from '@cloudscape-design/components';

export function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function DescriptionText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <SpaceBetween size="s">
      {blocks.map((block, index) => {
        const lines = block.split('\n').filter(Boolean);
        if (lines.every((line) => line.trim().startsWith('- '))) {
          return (
            <ul key={index}>
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{line.replace(/^-\s*/, '').replace(/\*\*/g, '')}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} style={{ margin: 0 }}>
            {block.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
          </p>
        );
      })}
    </SpaceBetween>
  );
}

export const ChallengeDrawer: React.FC<{
  title: string;
  description: string;
  secondsLeft: number;
  onSubmit: () => void;
  submitting: boolean;
  submitModalOpen: boolean;
  setSubmitModalOpen: (open: boolean) => void;
}> = ({
  title,
  description,
  secondsLeft,
  onSubmit,
  submitting,
  submitModalOpen,
  setSubmitModalOpen,
}) => (
  <SpaceBetween size="l">
    <Container>
      <Header variant="h2">{title}</Header>
      <DescriptionText text={description} />
    </Container>
    <Container>
      <Box textAlign="center">
        <Box variant="h1" fontSize="display-l" color={secondsLeft <= 300 ? 'text-status-error' : 'text-status-info'}>
          {formatCountdown(secondsLeft)}
        </Box>
        <Box variant="small" color="text-body-secondary">Time remaining</Box>
      </Box>
    </Container>
    <Container>
      <Button variant="primary" fullWidth loading={submitting} onClick={() => setSubmitModalOpen(true)}>
        Submit answer
      </Button>
    </Container>
    <Modal
      visible={submitModalOpen}
      onDismiss={() => setSubmitModalOpen(false)}
      header="Submit your answer?"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => setSubmitModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button variant="primary" loading={submitting} onClick={onSubmit}>Submit</Button>
          </SpaceBetween>
        </Box>
      }
    >
      You cannot change anything after submitting.
    </Modal>
  </SpaceBetween>
);
