'use client';

import { CalendarDays, ClipboardList, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { BRANCHES } from '@/lib/branches';
import { BranchCheckboxDropdown } from '@/components/BranchCheckboxDropdown';
import { useBranchFilter } from '@/lib/useBranchFilter';

type ThreadRequest = {
  id: string;
  request_number: string;
  full_name: string;
  phone_number: string;
  customer_email: string | null;
  city: string | null;
  region: string | null;
  state: string | null;
  zip_code: string | null;
  manual_brand: string | null;
  manual_appliance_type: string | null;
  model_number: string | null;
  serial_number: string | null;
  issue_description: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  verification_status: string;
  er_ticket_id: string | null;
  requested_at: string;
  updated_at: string;
};

type ThreadMessage = {
  id: string;
  thread_id: string;
  sender_profile_id: string | null;
  sender_role: string | null;
  sender_name: string;
  message_body: string;
  message_type: string;
  created_at: string;
};

type TicketThread = {
  id: string;
  request_id: string | null;
  customer_id: string | null;
  request_number: string;
  er_ticket_id: string | null;
  subject: string;
  status: string;
  ticket_status: string | null;
  last_message_at: string | null;
  created_at: string;
  request: ThreadRequest | null;
  latest_message: ThreadMessage | null;
};

const CLOSED_TICKET_STATUSES = new Set([
  'cl-cancelled',
  'cl-claimed',
  'cl-data-closed',
  'cl-ready to complete',
  'cl-need cancel',
]);

function isThreadLocked(thread: TicketThread) {
  return thread.status === 'closed' || CLOSED_TICKET_STATUSES.has((thread.ticket_status ?? '').trim().toLowerCase());
}

function formatDate(value?: string | null) {
  if (!value) return 'No date yet';
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function shortPreview(message?: ThreadMessage | null) {
  if (!message) return 'Ticket conversation is ready.';
  return message.message_body.length > 82 ? `${message.message_body.slice(0, 82)}...` : message.message_body;
}

function productLabel(request?: ThreadRequest | null) {
  return request?.manual_appliance_type || 'Service Request';
}

export function InternalMessagesPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { user, profile } = useAuth();
  const [threads, setThreads] = useState<TicketThread[]>([]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<unknown>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [automatedChatOpen, setAutomatedChatOpen] = useState(false);
  const [automatedChatDraft, setAutomatedChatDraft] = useState('');
  const [automatedChatMessage, setAutomatedChatMessage] = useState<string | null>(null);
  const [automatedTemplates, setAutomatedTemplates] = useState<{ id: string; text: string }[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Scoped per CSR account (keyed by profile id), not shared across whoever
  // else uses this browser.
  const automatedTemplatesKey = profile?.id ? `ushs_automated_chat_templates_${profile.id}` : null;

  useEffect(() => {
    if (!automatedTemplatesKey) return;
    try {
      const saved = window.localStorage.getItem(automatedTemplatesKey);
      setAutomatedTemplates(saved ? JSON.parse(saved) : []);
    } catch {
      // localStorage can throw in private browsing / disabled-storage modes.
      setAutomatedChatMessage('Your browser is blocking local storage, so saved templates won\'t persist here.');
    }
  }, [automatedTemplatesKey]);

  function persistTemplates(next: { id: string; text: string }[]) {
    setAutomatedTemplates(next);
    if (!automatedTemplatesKey) return;
    try {
      window.localStorage.setItem(automatedTemplatesKey, JSON.stringify(next));
    } catch (err) {
      setAutomatedChatMessage(err instanceof Error ? `Unable to save: ${err.message}` : 'Unable to save template.');
      window.setTimeout(() => setAutomatedChatMessage(null), 3000);
    }
  }

  function openNewTemplateForm() {
    setEditingTemplateId(null);
    setAutomatedChatDraft('');
    setAutomatedChatOpen(true);
  }

  function startEditTemplate(template: { id: string; text: string }) {
    setEditingTemplateId(template.id);
    setAutomatedChatDraft(template.text);
    setAutomatedChatOpen(true);
  }

  function saveAutomatedChatTemplate() {
    const text = automatedChatDraft.trim();
    if (!text) return;
    const next = editingTemplateId
      ? automatedTemplates.map((t) => (t.id === editingTemplateId ? { ...t, text } : t))
      : [...automatedTemplates, { id: `${Date.now()}`, text }];
    persistTemplates(next);
    setAutomatedChatMessage(editingTemplateId ? 'Template updated.' : 'Template saved.');
    setAutomatedChatOpen(false);
    setEditingTemplateId(null);
    setAutomatedChatDraft('');
    window.setTimeout(() => setAutomatedChatMessage(null), 3000);
  }

  function deleteTemplate(id: string) {
    persistTemplates(automatedTemplates.filter((t) => t.id !== id));
    if (editingTemplateId === id) {
      setAutomatedChatOpen(false);
      setEditingTemplateId(null);
      setAutomatedChatDraft('');
    }
  }

  async function sendAutomatedChat(text: string) {
    if (!text.trim()) return;
    await sendMessage(text.trim());
  }

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeId) ?? threads[0] ?? null,
    [activeId, threads],
  );

  const branchOptions = useMemo(() => [...BRANCHES], []);
  const { selectedBranches, setSelectedBranches } = useBranchFilter();

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return threads.filter((thread) => {
      const request = thread.request;
      if (!selectedBranches.length || !selectedBranches.includes(request?.region || '')) return false;
      if (!term) return true;
      return [
        thread.request_number,
        thread.subject,
        thread.latest_message?.message_body,
        request?.full_name,
        request?.phone_number,
        request?.customer_email,
        request?.city,
        request?.manual_appliance_type,
        request?.model_number,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [selectedBranches, search, threads]);

  async function loadThreads(silent = false) {
    if (!user) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<{ threads: TicketThread[] }>(user, '/api/messages/threads?limit=150');
      setThreads(data.threads);
      setActiveId((current) => current && data.threads.some((thread) => thread.id === current) ? current : data.threads[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load message threads.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function runDiagnostics() {
    if (!user) return;
    setDiagnosticsLoading(true);
    setDiagnostics(null);
    try {
      const data = await fetchJsonWithFirebase(user, '/api/messages/diagnostics');
      setDiagnostics(data);
    } catch (err) {
      setDiagnostics({ message: err instanceof Error ? err.message : 'Diagnostics failed.' });
    } finally {
      setDiagnosticsLoading(false);
    }
  }

  async function loadMessages(threadId: string, silent = false) {
    if (!user) return;
    if (!silent) setThreadLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<{ messages: ThreadMessage[] }>(user, `/api/messages/threads/${threadId}/messages`);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open message thread.');
    } finally {
      if (!silent) setThreadLoading(false);
    }
  }

  async function sendMessage(override?: string) {
    const message = (override ?? draft).trim();
    if (!user || !activeThread || !message) return;
    if (!override) setDraft('');
    try {
      await fetchJsonWithFirebase(user, `/api/messages/threads/${activeThread.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      await Promise.all([loadMessages(activeThread.id), loadThreads()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
      if (!override) setDraft(message);
    }
  }

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    if (activeThread?.id) {
      loadMessages(activeThread.id);
    } else {
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.id, user?.uid]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      void loadThreads(true);
      if (activeThread?.id) void loadMessages(activeThread.id, true);
    }, 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.id, user?.uid]);

  return (
    <div className="agent-dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="muted">{description}</p>
        </div>
        <button className="btn btn-secondary" disabled={diagnosticsLoading} onClick={() => void runDiagnostics()} type="button">
          {diagnosticsLoading ? 'Running diagnostics...' : 'Run Diagnostics'}
        </button>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {diagnostics ? (
        <div className="message-diagnostics-panel">
          <div className="message-diagnostics-head">
            <strong>Diagnostics</strong>
            <button onClick={() => setDiagnostics(null)} type="button">Close</button>
          </div>
          <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
        </div>
      ) : null}

      <section className="leadership-messages-layout ticket-messages-layout">
        <div className="agent-table-panel ticket-thread-panel">
          <h2>
            <MessageSquare size={16} />
            Ticket Conversations
          </h2>
          <input
            className="ticket-message-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ticket, customer, phone, model..."
            value={search}
          />
          <BranchCheckboxDropdown branches={branchOptions} selectedBranches={selectedBranches} onChange={setSelectedBranches} />
          <div className="leadership-thread-list ticket-thread-list">
            {loading ? <div className="message-empty-state">Loading conversations...</div> : null}
            {!loading && !filteredThreads.length ? (
              <div className="message-empty-state">No approved ticket conversations yet.</div>
            ) : null}
            {filteredThreads.map((thread) => (
              <button
                className={thread.id === activeThread?.id ? 'active' : ''}
                key={thread.id}
                onClick={() => setActiveId(thread.id)}
                type="button"
              >
                <strong>{thread.request_number}</strong>
                <span>{thread.request?.full_name || 'Customer'} • {productLabel(thread.request)}</span>
                <small>{shortPreview(thread.latest_message)}</small>
                <small><CalendarDays size={12} /> {formatDate(thread.last_message_at || thread.created_at)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="agent-table-panel leadership-chat-panel ticket-chat-panel">
          {activeThread ? (
            <>
              <div className="leadership-chat-head ticket-chat-head">
                <div>
                  <strong>{activeThread.request_number}</strong>
                  <span>{activeThread.request?.full_name || 'Customer'} • {activeThread.request?.phone_number || 'No phone'} • {productLabel(activeThread.request)}</span>
                </div>
                <span className="message-thread-pill">Approved Ticket</span>
              </div>
              <div className="leadership-chat-body ticket-chat-body">
                {threadLoading ? <div className="message-empty-state">Opening conversation...</div> : null}
                {!threadLoading && !messages.length ? <div className="message-empty-state">No messages yet.</div> : null}
                {messages.map((message) => {
                  const mine = message.sender_profile_id === profile?.id;
                  return (
                    <div className={`chat-bubble ${mine ? 'sent' : 'received'} ${message.message_type === 'system' ? 'system' : ''}`} key={message.id}>
                      <strong>{message.sender_name}</strong>
                      <p>{message.message_body}</p>
                      <small>{formatDate(message.created_at)}</small>
                    </div>
                  );
                })}
              </div>
              {isThreadLocked(activeThread) ? (
                <div className="ticket-chat-closed-notice">
                  This ticket is completed. Messaging is now closed.
                </div>
              ) : (
                <div className="leadership-chat-compose ticket-chat-compose">
                  <input
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Write a message to the customer..."
                    type="text"
                    value={draft}
                  />
                  <button className="btn btn-primary" disabled={!draft.trim()} onClick={() => void sendMessage()} type="button">
                    <Send size={16} /> Send
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="message-empty-state big">
              <MessageSquare size={42} />
              <strong>Select a ticket conversation</strong>
              <p>Approved customer tickets will appear here after the verification queue creates a message thread.</p>
            </div>
          )}
        </div>

        <div className="agent-table-panel ticket-details-panel">
          <h2>
            <ClipboardList size={16} />
            Ticket Details
          </h2>
          {activeThread ? (
            <div className="ticket-details-box">
              <div className="ticket-details-row"><span>Name</span><strong>{activeThread.request?.full_name || 'N/A'}</strong></div>
              <div className="ticket-details-row"><span>Phone</span><strong>{activeThread.request?.phone_number || 'N/A'}</strong></div>
              <div className="ticket-details-row"><span>Address</span><strong>{[activeThread.request?.city, activeThread.request?.state, activeThread.request?.zip_code].filter(Boolean).join(', ') || 'N/A'}</strong></div>
              <div className="ticket-details-row"><span>Region</span><strong>{activeThread.request?.region || 'N/A'}</strong></div>
              <div className="ticket-details-row"><span>Ticket #</span><strong>{activeThread.request_number || 'N/A'}</strong></div>
              <div className="ticket-details-row"><span>Model</span><strong>{activeThread.request?.model_number || 'N/A'}</strong></div>
              <div className="ticket-details-row"><span>Serial</span><strong>{activeThread.request?.serial_number || 'N/A'}</strong></div>
              <div className="ticket-details-row"><span>Appliance</span><strong>{activeThread.request?.manual_appliance_type || 'N/A'}</strong></div>
              <div className="ticket-details-row"><span>Brand</span><strong>{activeThread.request?.manual_brand || 'N/A'}</strong></div>
            </div>
          ) : (
            <div className="message-empty-state">Select a conversation to see ticket details.</div>
          )}

          <div className="automated-chat-box">
            <button
              className="automated-chat-toggle"
              onClick={() => (automatedChatOpen ? setAutomatedChatOpen(false) : openNewTemplateForm())}
              type="button"
            >
              + Add your customized automated chat
            </button>

            {automatedChatOpen ? (
              <div className="automated-chat-form">
                <textarea
                  onChange={(event) => setAutomatedChatDraft(event.target.value)}
                  placeholder="Write the automated reply you want to reuse across conversations..."
                  rows={4}
                  value={automatedChatDraft}
                />
                <div className="automated-chat-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setAutomatedChatOpen(false);
                      setEditingTemplateId(null);
                      setAutomatedChatDraft('');
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={!automatedChatDraft.trim()}
                    onClick={saveAutomatedChatTemplate}
                    type="button"
                  >
                    {editingTemplateId ? 'Save Changes' : 'Save Template'}
                  </button>
                </div>
              </div>
            ) : null}

            {automatedChatMessage ? <p className="automated-chat-status">{automatedChatMessage}</p> : null}

            <div className="automated-chat-list">
              {automatedTemplates.map((template) => (
                <div className="automated-chat-item" key={template.id}>
                  <button
                    className="automated-chat-item-send"
                    disabled={!activeThread || isThreadLocked(activeThread!)}
                    onClick={() => void sendAutomatedChat(template.text)}
                    title="Send to this conversation"
                    type="button"
                  >
                    <Send size={13} />
                    <span>{template.text}</span>
                  </button>
                  <div className="automated-chat-item-actions">
                    <button aria-label="Edit template" onClick={() => startEditTemplate(template)} type="button">
                      <Pencil size={13} />
                    </button>
                    <button aria-label="Delete template" onClick={() => deleteTemplate(template.id)} type="button">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {!automatedTemplates.length ? <p className="automated-chat-empty">No saved automated chats yet.</p> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
