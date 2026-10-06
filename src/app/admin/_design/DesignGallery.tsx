"use client";

import styled from "styled-components";
import { useState } from "react";
import {
  AdminToastProvider,
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FilterChip,
  IconButton,
  ListRow,
  Modal,
  SearchField,
  SegmentedControl,
  Sheet,
  Skeleton,
  StatTile,
  TrendLine,
  useAdminToast,
} from "@/components/admin-mobile";

const Page = styled.div`
  background: var(--am-bg);
  color: var(--am-ink);
  min-height: 100vh;
  padding: 24px 16px 96px;
  font-family: var(--font-inter), Inter, system-ui, sans-serif;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
`;

const Subtitle = styled.p`
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--am-ink-muted);
`;

const Section = styled.section`
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--am-border);
`;

const SectionTitle = styled.h2`
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--am-ink);
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
`;

const Scroller = styled.div`
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin: 0 -16px;
  padding: 0 16px 8px;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
  & > * {
    flex-shrink: 0;
  }
`;

const List = styled.div`
  background: var(--am-surface);
  border-radius: var(--am-radius-lg);
  overflow: hidden;
  box-shadow: var(--am-shadow-1);
`;

const ThemeToggle = ({
  theme,
  onChange,
}: {
  theme: "light" | "dark";
  onChange: (t: "light" | "dark") => void;
}) => (
  <SegmentedControl
    label="Theme"
    options={[
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ]}
    value={theme}
    onChange={onChange}
    size="sm"
  />
);

function Toasts() {
  const toast = useAdminToast();
  return (
    <Row>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.push({
            tone: "success",
            title: "Donation approved",
            message: "$500 recorded in the ledger.",
            action: { label: "Undo", onClick: () => toast.push({ message: "Undone." }) },
          })
        }
      >
        Success toast
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.push({ tone: "danger", title: "Save failed", message: "Try again." })
        }
      >
        Error toast
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => toast.push({ tone: "info", message: "Report generated." })}
      >
        Info toast
      </Button>
    </Row>
  );
}

export function DesignGallery() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fullSheetOpen, setFullSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <AdminToastProvider>
      <Page data-theme={theme}>
        <Header>
          <div>
            <Title>Admin mobile design system</Title>
            <Subtitle>Milestone 1 · Component library preview</Subtitle>
          </div>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </Header>

        <Section>
          <SectionTitle>Buttons</SectionTitle>
          <Row>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Delete</Button>
            <Button loading>Saving…</Button>
            <Button disabled>Disabled</Button>
          </Row>
          <Row>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <IconButton
              label="Notifications"
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M5 8a5 5 0 0 1 10 0v3l1.5 2.5h-13L5 11z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 15a2 2 0 0 0 4 0"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              }
            />
          </Row>
        </Section>

        <Section>
          <SectionTitle>Badges & avatars</SectionTitle>
          <Row>
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="brand">Brand</Badge>
            <Badge tone="success">Approved</Badge>
            <Badge tone="warning">Pending</Badge>
            <Badge tone="danger">Rejected</Badge>
            <Badge tone="info">Info</Badge>
          </Row>
          <Row>
            <Avatar name="Sarah Mendez" size="sm" />
            <Avatar name="Daniel Okafor" size="md" status="online" />
            <Avatar name="Chinedu Eze" size="lg" status="busy" />
            <Avatar name="Fatima Yusuf" size="md" status="away" />
          </Row>
        </Section>

        <Section>
          <SectionTitle>Stat tiles</SectionTitle>
          <Scroller>
            <StatTile
              label="Donations today"
              value="$24,560"
              delta={{ value: "+15%", direction: "up" }}
              trend={[8, 12, 10, 14, 18, 16, 22, 24]}
            />
            <StatTile
              label="Pending reviews"
              value="3"
              delta={{ value: "-25%", direction: "down" }}
              trend={[9, 7, 6, 5, 4, 3]}
            />
            <StatTile
              label="Active projects"
              value="12"
              delta={{ value: "+8%", direction: "up" }}
              trend={[7, 8, 10, 10, 11, 12]}
            />
            <StatTile
              label="Children sponsored"
              value="482"
              delta={{ value: "0%", direction: "flat" }}
            />
          </Scroller>
        </Section>

        <Section>
          <SectionTitle>Search & filters</SectionTitle>
          <Row style={{ flexDirection: "column", alignItems: "stretch" }}>
            <SearchField
              value={query}
              placeholder="Search users, projects…"
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
            />
          </Row>
          <Row>
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} count={48}>
              All
            </FilterChip>
            <FilterChip
              active={filter === "active"}
              onClick={() => setFilter("active")}
              count={32}
            >
              Active
            </FilterChip>
            <FilterChip
              active={filter === "paused"}
              onClick={() => setFilter("paused")}
              count={16}
            >
              Paused
            </FilterChip>
          </Row>
          <Row style={{ display: "block" }}>
            <SegmentedControl
              label="View"
              options={[
                { value: "pending", label: "Pending", count: 3 },
                { value: "mine", label: "Mine", count: 1 },
                { value: "done", label: "Done" },
              ]}
              value={filter === "paused" ? "mine" : filter === "active" ? "done" : "pending"}
              onChange={() => undefined}
            />
          </Row>
        </Section>

        <Section>
          <SectionTitle>List rows</SectionTitle>
          <List>
            <ListRow
              leading={<Avatar name="Aisha Mohammed" />}
              title="Aisha Mohammed"
              meta="admin · Joined Jan 12, 2025"
              trailing={<Badge tone="brand">Admin</Badge>}
              onClick={() => undefined}
            />
            <ListRow
              leading={<Avatar name="Daniel Okafor" status="online" />}
              title="Daniel Okafor"
              meta="volunteer · Joined Feb 3, 2025"
              trailing={<Badge tone="success">Active</Badge>}
              onClick={() => undefined}
            />
            <ListRow
              leading={<Avatar name="Emily Carter" />}
              title="Emily Carter"
              meta="donor · Joined Feb 18, 2025"
              trailing={<Badge tone="neutral">Donor</Badge>}
              onClick={() => undefined}
              priorityColor="var(--am-warning-600)"
              priorityLabel="Needs review"
            />
            <ListRow
              title="Row with no leading, no trailing"
              meta="Minimal variant"
            />
          </List>
        </Section>

        <Section>
          <SectionTitle>Cards</SectionTitle>
          <Grid>
            <Card>
              <strong>Default card</strong>
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--am-ink-muted)" }}>
                Soft surface with level-1 elevation.
              </p>
            </Card>
            <Card variant="media" padding="none">
              <div
                style={{
                  height: 100,
                  background:
                    "linear-gradient(135deg, var(--am-brand-500), var(--am-accent-500))",
                }}
              />
              <div style={{ padding: 12 }}>
                <strong>Media card</strong>
                <div style={{ fontSize: 13, color: "var(--am-ink-muted)" }}>
                  Clips media to the radius.
                </div>
              </div>
            </Card>
            <Card variant="action" interactive onClick={() => undefined}>
              + New project
            </Card>
          </Grid>
        </Section>

        <Section>
          <SectionTitle>TrendLine</SectionTitle>
          <Row>
            <TrendLine
              values={[4, 6, 5, 8, 7, 10, 12, 11, 14]}
              width={200}
              height={48}
              label="Donations trend"
            />
            <TrendLine
              values={[14, 12, 10, 9, 7, 6, 4]}
              stroke="var(--am-danger-600)"
              width={200}
              height={48}
            />
          </Row>
        </Section>

        <Section>
          <SectionTitle>Sheets, modals, confirms</SectionTitle>
          <Row>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Open bottom sheet
            </Button>
            <Button variant="secondary" onClick={() => setFullSheetOpen(true)}>
              Open full sheet
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Open modal
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Open destructive confirm
            </Button>
          </Row>

          <Sheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Filter users"
            description="Pick the roles you want to see."
            footer={
              <>
                <Button variant="secondary" fullWidth onClick={() => setSheetOpen(false)}>
                  Reset
                </Button>
                <Button fullWidth onClick={() => setSheetOpen(false)}>
                  Apply
                </Button>
              </>
            }
          >
            <Row style={{ padding: "8px 0" }}>
              <FilterChip active>Admins</FilterChip>
              <FilterChip>Volunteers</FilterChip>
              <FilterChip>Donors</FilterChip>
              <FilterChip>Field</FilterChip>
            </Row>
          </Sheet>

          <Sheet
            open={fullSheetOpen}
            onClose={() => setFullSheetOpen(false)}
            variant="full"
            title="Create user"
          >
            <p>Full-screen sheet for multi-step mobile flows.</p>
          </Sheet>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Project details"
            description="Standard centred dialog for tablet and desktop."
            footer={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setModalOpen(false)}>Save</Button>
              </>
            }
          >
            <p>Modal body content.</p>
          </Modal>

          <ConfirmDialog
            open={confirmOpen}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => setConfirmOpen(false)}
            title="Delete donation #2458?"
            description="This will reverse ledger entries 912 and 913. This action cannot be undone."
            confirmLabel="Delete"
            destructive
          />
        </Section>

        <Section>
          <SectionTitle>Banners</SectionTitle>
          <Row style={{ flexDirection: "column", alignItems: "stretch" }}>
            <Banner tone="info" title="MFA active">
              Your session is secured with step-up MFA.
            </Banner>
            <Banner tone="success" title="Report ready" dismissible>
              Q3 financial report has finished generating.
            </Banner>
            <Banner tone="warning" title="Review needed">
              3 projects are waiting on your approval.
            </Banner>
            <Banner tone="danger" title="Payment failed">
              The last two donation imports could not be reconciled.
            </Banner>
          </Row>
        </Section>

        <Section>
          <SectionTitle>Toasts</SectionTitle>
          <Toasts />
        </Section>

        <Section>
          <SectionTitle>Loading & empty</SectionTitle>
          <Grid>
            <Card>
              <Skeleton width={48} height={48} circle />
              <div style={{ marginTop: 12 }}>
                <Skeleton width="60%" height={16} />
                <div style={{ height: 8 }} />
                <Skeleton width="40%" height={12} />
              </div>
            </Card>
            <Card padding="none">
              <EmptyState
                title="No pending reviews"
                description="Nothing to approve right now."
                action={<Button size="sm">Browse projects</Button>}
              />
            </Card>
          </Grid>
        </Section>
      </Page>
    </AdminToastProvider>
  );
}
