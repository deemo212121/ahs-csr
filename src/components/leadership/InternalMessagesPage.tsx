'use client';

import { CalendarDays, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';

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
  last_message_at: string | null;
  created_at: string;
  request: ThreadRequest | null;
  latest_message: ThreadMessage | null;
};

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

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeId) ?? threads[0] ?? null,
    [activeId, threads],
  );

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter((thread) => {
      const request = thread.request;
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
  }, [search, threads]);

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

  async function sendMessage() {
    if (!user || !activeThread || !draft.trim()) return;
    const message = draft.trim();
    setDraft('');
    try {
      await fetchJsonWithFirebase(user, `/api/messages/threads/${activeThread.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      await Promise.all([loadMessages(activeThread.id), loadThreads()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
      setDraft(message);
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
        <button className="btn btn-secondary" onClick={() => void loadThreads()} type="button">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

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
              <div className="ticket-chat-details">
                <span><b>Address:</b> {[activeThread.request?.city, activeThread.request?.state, activeThread.request?.zip_code].filter(Boolean).join(', ') || 'N/A'}</span>
                <span><b>Model:</b> {activeThread.request?.model_number || 'N/A'}</span>
                <span><b>ER Ticket:</b> {activeThread.er_ticket_id || 'Pending/none'}</span>
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
                <button className="btn btn-primary" disabled={!draft.trim()} onClick={sendMessage} type="button">
                  <Send size={16} /> Send
                </button>
              </div>
            </>
          ) : (
            <div className="message-empty-state big">
              <MessageSquare size={42} />
              <strong>Select a ticket conversation</strong>
              <p>Approved customer tickets will appear here after the verification queue creates a message thread.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
