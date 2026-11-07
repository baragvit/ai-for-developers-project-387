import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Booking } from '@/api/client'
import { eventType, respond } from '@/test/api'
import { renderApp } from '@/test/render'

const linkedBooking: Booking = {
  id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  eventTypeId: 'linked-call',
  eventTypeName: 'Звонок со ссылкой',
  startAt: '2026-11-10T06:00:00.000Z',
  endAt: '2026-11-10T06:30:00.000Z',
  guestName: 'Ольга Со ссылкой',
  guestEmail: 'olga@example.com',
  createdAt: '2026-11-09T05:00:00.000Z',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
}

const plainBooking: Booking = {
  id: '9b2f3c1e-4a5d-4e6f-8a7b-1c2d3e4f5a6b',
  eventTypeId: eventType.id,
  eventTypeName: eventType.name,
  startAt: '2026-11-10T08:00:00.000Z',
  endAt: '2026-11-10T08:30:00.000Z',
  guestName: 'Иван Без ссылки',
  guestEmail: 'ivan@example.com',
  createdAt: '2026-11-09T05:00:00.000Z',
}

async function rowFor(guestName: string) {
  const rows = await screen.findAllByTestId('booking-row')
  const row = rows.find((candidate) => within(candidate).queryByText(guestName))
  if (!row) throw new Error(`No booking row for ${guestName}`)
  return row
}

describe('Предстоящие встречи владельца', () => {
  it('показывает безопасную ссылку на встречу, если у типа встречи она есть', async () => {
    respond('GET', '/api/admin/bookings', [linkedBooking, plainBooking])
    respond('GET', '/api/event-types', [eventType])
    renderApp('/admin')

    const link = within(await rowFor(linkedBooking.guestName)).getByRole('link', {
      name: 'Подключиться к встрече',
    })
    expect(link).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('оставляет строку без ссылки, если у типа встречи её нет', async () => {
    respond('GET', '/api/admin/bookings', [plainBooking])
    respond('GET', '/api/event-types', [eventType])
    renderApp('/admin')

    const row = await rowFor(plainBooking.guestName)
    expect(within(row).queryByRole('link', { name: 'Подключиться к встрече' })).not.toBeInTheDocument()
    expect(row).toHaveTextContent(plainBooking.guestEmail)
  })
})
