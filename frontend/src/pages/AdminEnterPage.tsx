import React, { useEffect, useState } from 'react';
import { Alert, Container, ContentLayout, Header, Spinner } from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { adminEnter } from '../api/portal';
import { ApiError } from '../api/client';
import { SITE_URL } from '../config/app';
import { Link } from '@cloudscape-design/components';

export const AdminEnterPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    if (!token) {
      setError('This admin entry link does not contain a login token.');
      return;
    }
    adminEnter(token)
      .then(() => navigate('/admin/events', { replace: true }))
      .catch((err) => setError((err as ApiError).message || 'Unable to enter as admin.'));
  }, [navigate]);

  return (
    <ContentLayout header={<Header variant="h1">Entering admin portal</Header>}>
      <Container>
        {error ? (
          <Alert type="error" header="Unable to enter" action={<Link href={SITE_URL}>Back to the website</Link>}>
            {error}
          </Alert>
        ) : (
          <><Spinner /> Verifying admin entry link...</>
        )}
      </Container>
    </ContentLayout>
  );
};
