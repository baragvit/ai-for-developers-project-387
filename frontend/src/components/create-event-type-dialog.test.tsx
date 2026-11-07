import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { EventType } from '@/api/client'
import { eventType, requestBody, respond, wasRequested } from '@/test/api'
import { renderApp } from '@/test/render'

const created: EventType = {
  id: 'mentor-session',
  name: 'Менторская сессия',
  description: 'Разбор карьерных вопросов',
  durationMinutes: 45,
}

async function openDialog() {
  renderApp('/admin')
  await userEvent.click(screen.getByRole('button', { name: 'Новый тип встречи' }))
  return within(await screen.findByRole('dialog'))
}

async function fill(dialog: ReturnType<typeof within>, values: Partial<Record<string, string>>) {
  for (const [label, value] of Object.entries(values)) {
    const field = dialog.getByLabelText(new RegExp(`^${label}`))
    await userEvent.clear(field)
    if (value) await userEvent.type(field, value)
  }
}

describe('Диалог создания типа встречи', () => {
  beforeEach(() => {
    respond('GET', '/api/admin/bookings', [])
    respond('GET', '/api/event-types', [eventType])
  })

  it('создаёт тип встречи и показывает его в списке', async () => {
    const dialog = await openDialog()
    await fill(dialog, { Название: created.name, Идентификатор: created.id, Описание: created.description })
    await userEvent.click(dialog.getByRole('button', { name: '45 мин' }))

    respond('POST', '/api/admin/event-types', created, 201)
    respond('GET', '/api/event-types', [eventType, created])
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(await screen.findByText('Тип встречи «Менторская сессия» создан')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(requestBody('POST', '/api/admin/event-types')).not.toHaveProperty('meetingUrl')
    await userEvent.click(screen.getByRole('tab', { name: /Типы встреч/ }))
    const cards = await screen.findAllByTestId('admin-event-type')
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining('Знакомство'),
      expect.stringContaining('Менторская сессия'),
    ])
  })

  it('создаёт тип встречи со ссылкой на онлайн-встречу', async () => {
    const linked: EventType = {
      id: 'linked-call',
      name: 'Звонок со ссылкой',
      description: '',
      durationMinutes: 30,
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    }
    const dialog = await openDialog()
    await fill(dialog, {
      Название: linked.name,
      Идентификатор: linked.id,
      'Ссылка на встречу': linked.meetingUrl!,
    })

    respond('POST', '/api/admin/event-types', linked, 201)
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(await screen.findByText('Тип встречи «Звонок со ссылкой» создан')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(requestBody('POST', '/api/admin/event-types')).toMatchObject({ meetingUrl: linked.meetingUrl })
  })

  it('обрезает пробелы вокруг ссылки на встречу перед проверкой и отправкой', async () => {
    const linked: EventType = {
      id: 'trimmed-call',
      name: 'Звонок с пробелами',
      description: '',
      durationMinutes: 30,
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    }
    const dialog = await openDialog()
    await fill(dialog, {
      Название: linked.name,
      Идентификатор: linked.id,
      'Ссылка на встречу': `  ${linked.meetingUrl} `,
    })

    respond('POST', '/api/admin/event-types', linked, 201)
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(await screen.findByText('Тип встречи «Звонок с пробелами» создан')).toBeInTheDocument()
    expect(requestBody('POST', '/api/admin/event-types')).toMatchObject({ meetingUrl: linked.meetingUrl })
  })

  it.each([
    ['без схемы', 'meet.google.com/abc-defg-hij'],
    ['с недопустимой схемой', 'javascript:alert(1)'],
    ['без хоста', 'https://'],
    ['с пробелом', 'https://meet.google.com/abc def'],
  ])('показывает ошибку ссылки %s до отправки', async (_, meetingUrl) => {
    const dialog = await openDialog()
    await fill(dialog, { Название: 'Созвон', 'Ссылка на встречу': meetingUrl })
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(dialog.getByLabelText(/^Ссылка на встречу/)).toHaveAccessibleDescription(
      'Укажите ссылку http или https',
    )
    expect(wasRequested('POST', '/api/admin/event-types')).toBe(false)
  })

  it('показывает ошибки у полей до отправки', async () => {
    const dialog = await openDialog()
    await fill(dialog, { Идентификатор: 'Bad id', 'Длительность, минут': '7', Описание: 'я'.repeat(501) })
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(dialog.getByLabelText('Название')).toHaveAccessibleDescription('Укажите название')
    expect(dialog.getByLabelText(/^Идентификатор/)).toHaveAccessibleDescription(
      'Только латиница в нижнем регистре, цифры и дефисы',
    )
    expect(dialog.getByLabelText('Длительность, минут')).toHaveAccessibleDescription(
      'Длительность должна быть кратна 5 минутам',
    )
    expect(dialog.getByLabelText(/^Описание/)).toHaveAccessibleDescription('Не длиннее 500 символов')
    expect(wasRequested('POST', '/api/admin/event-types')).toBe(false)
  })

  it.each([
    ['4', 'Целое число от 5 до 240 минут'],
    ['245', 'Целое число от 5 до 240 минут'],
    ['12.5', 'Целое число от 5 до 240 минут'],
  ])('не принимает длительность %s', async (duration, message) => {
    const dialog = await openDialog()
    await fill(dialog, { Название: 'Созвон', 'Длительность, минут': duration })
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(dialog.getByLabelText('Длительность, минут')).toHaveAccessibleDescription(message)
  })

  it('показывает серверные ошибки валидации у соответствующих полей', async () => {
    const dialog = await openDialog()
    await fill(dialog, { Название: 'Созвон' })

    respond(
      'POST',
      '/api/admin/event-types',
      {
        code: 'VALIDATION_ERROR',
        message: 'Проверьте правильность заполнения полей',
        details: [{ field: 'durationMinutes', message: 'Должно быть кратно 5' }],
      },
      400,
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(await dialog.findByText('Должно быть кратно 5')).toBeInTheDocument()
    expect(dialog.getByLabelText('Длительность, минут')).toHaveAccessibleDescription('Должно быть кратно 5')
  })

  it('показывает серверную ошибку ссылки у поля «Ссылка на встречу»', async () => {
    const dialog = await openDialog()
    await fill(dialog, { Название: 'Созвон', 'Ссылка на встречу': 'https://meet.google.com/abc-defg-hij' })

    respond(
      'POST',
      '/api/admin/event-types',
      {
        code: 'VALIDATION_ERROR',
        message: 'Проверьте правильность заполнения полей',
        details: [{ field: 'meetingUrl', message: 'Укажите ссылку http или https' }],
      },
      400,
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(await dialog.findByText('Укажите ссылку http или https')).toBeInTheDocument()
    expect(dialog.getByLabelText(/^Ссылка на встречу/)).toHaveAccessibleDescription(
      'Укажите ссылку http или https',
    )
  })

  it('показывает занятый id у поля «Идентификатор» и не закрывается', async () => {
    const dialog = await openDialog()
    await fill(dialog, { Название: 'Знакомство', Идентификатор: eventType.id })

    respond(
      'POST',
      '/api/admin/event-types',
      { code: 'EVENT_TYPE_ALREADY_EXISTS', message: 'Тип встречи с таким id уже существует' },
      409,
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(await dialog.findByText('Такой id уже занят — придумайте другой')).toBeInTheDocument()
    expect(dialog.getByLabelText(/^Идентификатор/)).toHaveAccessibleDescription(
      'Такой id уже занят — придумайте другой',
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
