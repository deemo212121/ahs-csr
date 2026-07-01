'use client';

import { CalendarDays, MessageCircle, RefreshCw, Send } from 'lucide-react';
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

const quickReplies = [
  'Can I get an update on my schedule?',
  'I need to update my service address.',
  'Can someone call me about this ticket?',
  'I want to add more appliance details.',
];

function statusLabel(status?: string | null) {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Cancelled';
  return 'New Request';
}

function serviceLabel(request?: ThreadRequest | null) {
  return `${request?.manual_appliance_type || 'Service'} Repair`;
}

function formatDate(value?: string | null) {
  if (!value) return 'No date yet';
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function preview(message?: ThreadMessage | null) {
  if (!message) return 'Approved ticket conversation is ready.';
  return message.message_body.length > 74 ? `${message.message_body.slice(0, 74)}...` : message.message_body;
}

export function CustomerMessagesPage() {
  const { user, profile } = useAuth();
  const [threads, setThreads] = useState<TicketThread[]>([]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedId) ?? threads[0] ?? null,
    [threads, selectedId],
  );

  async function loadThreads(silent = false) {
    if (!user) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<{ threads: TicketThread[] }>(user, '/api/messages/threads?limit=100');
      setThreads(data.threads);

      const requestId = new URLSearchParams(window.location.search).get('request');
      const requestedThread = requestId ? data.threads.find((thread) => thread.request_id === requestId || thread.er_ticket_id === requestId || thread.request_number === requestId) : null;
      setSelectedId((current) => {
        if (requestedThread) return requestedThread.id;
        if (current && data.threads.some((thread) => thread.id === current)) return current;
        return data.threads[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load conversations.');
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
      setError(err instanceof Error ? err.message : 'Unable to open conversation.');
    } finally {
      if (!silent) setThreadLoading(false);
    }
  }

  async function sendMessage(messageOverride?: string) {
    if (!user || !selectedThread) return;
    const message = (messageOverride ?? draft).trim();
    if (!message) return;
    setDraft('');
    try {
      await fetchJsonWithFirebase(user, `/api/messages/threads/${selectedThread.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      await Promise.all([loadMessages(selectedThread.id), loadThreads()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
      if (!messageOverride) setDraft(message);
    }
  }

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    if (selectedThread?.id) {
      loadMessages(selectedThread.id);
    } else {
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id, user?.uid]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      void loadThreads(true);
      if (selectedThread?.id) void loadMessages(selectedThread.id, true);
    }, 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id, user?.uid]);

  return (
    <div className="customer-page-shell cx-messages-page">
      {error ? <div className="customer-alert">{error}</div> : null}
      <section className="customer-messages-layout cx-messages-layout">
        <aside className="customer-message-requests cx-message-requests">
          <div className="customer-message-head">
            <div>
              <strong>Approved Ticket Chats</strong>
              <span>Chat with support about an approved ticket.</span>
            </div>
            <button className="customer-icon-btn" onClick={() => void loadThreads()} type="button"><RefreshCw size={15} /></button>
          </div>
          <div className="customer-message-list cx-message-list">
            {loading ? <div className="customer-message-empty">Loading conversations...</div> : null}
            {!loading && !threads.length ? (
              <div className="customer-message-empty">
                No approved ticket messages yet. Once your request is approved, a chat will appear here automatically.
              </div>
            ) : null}
            {threads.map((thread) => (
              <button
                className={selectedThread?.id === thread.id ? 'active' : ''}
                key={thread.id}
                onClick={() => setSelectedId(thread.id)}
                type="button"
              >
                <span className={`cx-status-pill ${statusLabel(thread.request?.verification_status).toLowerCase()}`}>
                  {statusLabel(thread.request?.verification_status)}
                </span>
                <strong>#{thread.request_number}</strong>
                <span>{serviceLabel(thread.request)}</span>
                <small>{preview(thread.latest_message)}</small>
                <small><CalendarDays size={13} /> {formatDate(thread.last_message_at || thread.created_at)}</small>
              </button>
            ))}
          </div>
        </aside>
        <div className="customer-chat-panel cx-chat-panel">
          {selectedThread ? (
            <>
              <div className="customer-chat-head">
                <div>
                  <strong>{selectedThread.request_number}</strong>
                  <span>{serviceLabel(selectedThread.request)} • {selectedThread.request?.city || 'Service area pending'}</span>
                </div>
                <span className={`cx-status-pill ${statusLabel(selectedThread.request?.verification_status).toLowerCase()}`}>
                  {statusLabel(selectedThread.request?.verification_status)}
                </span>
              </div>
              <div className="customer-chat-ticket-summary">
                <span><b>Model:</b> {selectedThread.request?.model_number || 'N/A'}</span>
                <span><b>Preferred date:</b> {selectedThread.request?.preferred_date || 'N/A'}</span>
                <span><b>Phone:</b> {selectedThread.request?.phone_number || profile?.phone_number || 'N/A'}</span>
              </div>
              <div className="customer-chat-body">
                {threadLoading ? <div className="customer-message-empty">Opening chat...</div> : null}
                {!threadLoading && !messages.length ? <div className="customer-message-empty">No messages yet.</div> : null}
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
              {isThreadLocked(selectedThread) ? (
                <div className="ticket-chat-closed-notice">
                  This ticket is completed. Messaging is now closed.
                </div>
              ) : (
                <>
                  {messages.length <= 1 ? (
                    <div className="customer-quick-replies">
                      <span>Quick message:</span>
                      {quickReplies.map((reply) => (
                        <button key={reply} onClick={() => setDraft(reply)} type="button">{reply}</button>
                      ))}
                    </div>
                  ) : null}
                  <div className="customer-chat-compose">
                    <input
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Type a message about this ticket..."
                      value={draft}
                    />
                    <button className="btn btn-primary" disabled={!draft.trim()} onClick={() => sendMessage()} type="button"><Send size={16} /> Send</button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="customer-empty cx-chat-empty">
              <span><MessageCircle size={42} /></span>
              <strong>No approved ticket chat selected</strong>
              <p>Approved service requests will automatically create a customer support chat.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
