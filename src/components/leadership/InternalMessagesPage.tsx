'use client';

import { CalendarDays, CheckCircle2, ClipboardList, Mail, MailOpen, MessageSquare, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { useBranches } from '@/lib/useBranches';
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
  updated_at: string;
  request: ThreadRequest | null;
  latest_message: ThreadMessage | null;
  unread?: boolean;
  unread_count?: number;
};

// Locking is a manual CSR action (see the "Mark Complete" button) — the ER
// ticket's own status changes still flow in as automatic chat updates, but
// no longer close the conversation on their own.
function isThreadLocked(thread: TicketThread) {
  return thread.status === 'closed';
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
  const [completingThread, setCompletingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const unreadCount = useMemo(
    () => threads.reduce((sum, thread) => sum + (thread.unread ? thread.unread_count ?? 1 : 0), 0),
    [threads],
  );

  const { branches: branchOptions } = useBranches();
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

  async function markThreadComplete() {
    if (!user || !activeThread || completingThread) return;
    const confirmed = window.confirm(
      `Mark this conversation with ${activeThread.request?.full_name || 'this customer'} as complete? This will close messaging for both sides.`,
    );
    if (!confirmed) return;
    setCompletingThread(true);
    try {
      await fetchJsonWithFirebase(user, `/api/messages/threads/${activeThread.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'complete' }),
      });
      await Promise.all([loadMessages(activeThread.id), loadThreads()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete this conversation.');
    } finally {
      setCompletingThread(false);
    }
  }

  async function reopenThread() {
    if (!user || !activeThread || completingThread) return;
    const confirmed = window.confirm(
      `Reopen messaging with ${activeThread.request?.full_name || 'this customer'}?`,
    );
    if (!confirmed) return;
    setCompletingThread(true);
    try {
      await fetchJsonWithFirebase(user, `/api/messages/threads/${activeThread.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reopen' }),
      });
      await Promise.all([loadMessages(activeThread.id), loadThreads()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reopen this conversation.');
    } finally {
      setCompletingThread(false);
    }
  }

  async function toggleThreadRead(thread: TicketThread) {
    if (!user) return;
    const nextUnread = !thread.unread;
    setThreads((current) => current.map((item) => (item.id === thread.id ? { ...item, unread: nextUnread } : item)));
    try {
      await fetchJsonWithFirebase(user, `/api/messages/threads/${thread.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: nextUnread ? 'mark_unread' : 'mark_read' }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update read status.');
      await loadThreads(true);
    }
  }

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    if (activeThread?.id) {
      const openedId = activeThread.id;
      // Clear this one thread's badge the instant it's opened, rather than
      // waiting up to 4s for the next poll to reflect the server-side
      // read-state update — every other thread's count is left untouched.
      setThreads((current) =>
        current.map((item) => (item.id === openedId ? { ...item, unread: false, unread_count: 0 } : item)),
      );
      loadMessages(openedId);
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
    }, 4000);
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
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <section className="leadership-messages-layout ticket-messages-layout">
        <div className="agent-table-panel ticket-thread-panel">
          <h2>
            <MessageSquare size={16} />
            Ticket Conversations
            {unreadCount > 0 ? <span className="cx-unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
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
                className={`${thread.id === activeThread?.id ? 'active' : ''} ${thread.unread ? 'cx-thread-unread' : ''}`}
                key={thread.id}
                onClick={() => setActiveId(thread.id)}
                type="button"
              >
                <span className="cx-thread-row-top">
                  <strong>{thread.request_number}</strong>
                  <span className="cx-thread-row-actions">
                    {thread.unread && thread.unread_count ? (
                      <span className="cx-unread-count">{thread.unread_count > 9 ? '9+' : thread.unread_count}</span>
                    ) : null}
                    <span
                      className="cx-thread-read-toggle"
                      onClick={(event) => {
                        event.stopPropagation();
                        void toggleThreadRead(thread);
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={thread.unread ? 'Mark as read' : 'Mark as unread'}
                      title={thread.unread ? 'Mark as read' : 'Mark as unread'}
                    >
                      {thread.unread ? <Mail size={14} /> : <MailOpen size={14} />}
                    </span>
                  </span>
                </span>
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
                  const isCustomer = message.sender_role === 'customer';
                  return (
                    <div className={`chat-bubble ${isCustomer ? 'received' : 'sent'} ${message.message_type === 'system' || message.message_type === 'ticket_update' ? 'system' : ''}`} key={message.id}>
                      <strong>{message.sender_name}</strong>
                      <p>{message.message_body}</p>
                      <small>{formatDate(message.created_at)}</small>
                    </div>
                  );
                })}
              </div>
              {isThreadLocked(activeThread) ? (
                <div className="ticket-chat-closed-notice">
                  This conversation has been marked complete. Messaging is now closed.
                  <button
                    className="btn btn-secondary ticket-chat-complete-btn"
                    disabled={completingThread}
                    onClick={() => void reopenThread()}
                    title="Reopen this conversation"
                    type="button"
                  >
                    <RotateCcw size={16} /> {completingThread ? 'Reopening...' : 'Unmark Complete'}
                  </button>
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
                  <button
                    className="btn btn-secondary ticket-chat-complete-btn"
                    disabled={completingThread}
                    onClick={() => void markThreadComplete()}
                    title="Mark this conversation as complete and close messaging"
                    type="button"
                  >
                    <CheckCircle2 size={16} /> {completingThread ? 'Completing...' : 'Mark Complete'}
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
