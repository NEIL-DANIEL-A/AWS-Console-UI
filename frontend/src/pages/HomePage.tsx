import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Cards,
  ContentLayout,
  Header,
  Link,
  SpaceBetween,
} from '@cloudscape-design/components';
import { ConsoleLayout } from '../components/ConsoleLayout';
import { SERVICES, ServiceConfig } from '../config/services';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ConsoleLayout>
      <ContentLayout
        header={
          <Header
            variant="h1"
            description="Local AWS Emulator Console (Account: 000000000000 | Region: us-east-1)"
          >
            Console Home
          </Header>
        }
      >
        <SpaceBetween size="l">
          <Cards
            header={<Header variant="h2">Recently visited</Header>}
            items={SERVICES.filter((s) => s.enabled)}
            cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 3 }]}
            cardDefinition={{
              header: (item: ServiceConfig) => (
                <Link
                  fontSize="heading-m"
                  href={item.path}
                  onFollow={(e) => {
                    e.preventDefault();
                    navigate(item.path);
                  }}
                >
                  {item.name}
                </Link>
              ),
              sections: [
                {
                  id: 'category',
                  header: 'Category',
                  content: (item: ServiceConfig) => item.category,
                },
                {
                  id: 'description',
                  header: 'Description',
                  content: (item: ServiceConfig) => item.description,
                },
              ],
            }}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No services enabled</b>
              </Box>
            }
          />
        </SpaceBetween>
      </ContentLayout>
    </ConsoleLayout>
  );
};
