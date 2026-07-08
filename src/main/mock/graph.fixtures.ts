import type { CalendarEvent, InboxData, GmailInboxData, ChatMessage } from '../../shared/ipc-types'

const now = new Date()
const todayStr = now.toISOString().split('T')[0]

function todayAt(hour: number, minute = 0): string {
  return new Date(`${todayStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).toISOString()
}

export const MOCK_CALENDAR: CalendarEvent[] = [
  {
    id: 'evt-001',
    subject: 'D8 Standup',
    start: todayAt(9, 0),
    end: todayAt(9, 30),
    attendees: ['MJ', 'Connor', 'Priya'],
    webLink: 'https://teams.microsoft.com/l/meetup-join/mock',
  },
  {
    id: 'evt-002',
    subject: 'Q3 Strategy Review',
    start: todayAt(14, 0),
    end: todayAt(15, 0),
    attendees: ['MJ', 'Full team'],
    webLink: 'https://teams.microsoft.com/l/meetup-join/mock2',
    joinUrl: 'https://teams.microsoft.com/l/meetup-join/mock2-online',
  },
  {
    id: 'evt-003',
    subject: '1:1 with MJ',
    start: todayAt(16, 0),
    end: todayAt(16, 30),
    attendees: ['MJ'],
    webLink: 'https://teams.microsoft.com/l/meetup-join/mock3',
  },
  {
    id: 'evt-004',
    subject: 'Kickoff: Phase 2 Scope',
    start: todayAt(17, 0),
    end: todayAt(17, 30),
    attendees: ['Connor', 'Priya'],
    webLink: 'https://teams.microsoft.com/l/meetup-join/mock4',
    isPending: true,
  },
]

const MOCK_CHATS: ChatMessage[] = [
  { chatId: 'chat-1', from: 'MJ', preview: 'Can you send over the updated delivery doc before standup?', receivedAt: new Date(Date.now() - 15 * 60000).toISOString(), webUrl: 'https://teams.microsoft.com/l/chat/mock1' },
  { chatId: 'chat-2', from: 'Connor', preview: 'The client loved the prototype — they want to see Phase 2 scoped out this week.', receivedAt: new Date(Date.now() - 45 * 60000).toISOString(), webUrl: 'https://teams.microsoft.com/l/chat/mock2' },
]

export const MOCK_INBOX: InboxData = {
  outlookUnread: 12,
  outlookTopSubjects: [
    { subject: 'RE: Q3 Plan — need your input', from: 'MJ' },
    { subject: 'FW: Client feedback on Phase 1', from: 'Connor' },
    { subject: 'RE: Sprint review notes', from: 'Priya' },
  ],
  teamsUnread: 4,
  recentChats: MOCK_CHATS,
}

export const MOCK_GMAIL: GmailInboxData[] = [
  {
    email: 'gdogsjunk@gmail.com',
    unread: 7,
    topSubjects: [
      { subject: 'Your Amazon order has shipped', from: 'Amazon' },
      { subject: 'Reminder: dentist appointment tomorrow', from: 'Dr. Chen Office' },
      { subject: 'Weekly digest: 12 new stories', from: 'Substack' },
    ],
  },
  {
    email: 'gregg@buildgreatcourses.com',
    unread: 3,
    topSubjects: [
      { subject: 'Invoice #4521 paid', from: 'Stripe' },
      { subject: 'New client inquiry: onboarding program', from: 'Squarespace Forms' },
    ],
  },
]
