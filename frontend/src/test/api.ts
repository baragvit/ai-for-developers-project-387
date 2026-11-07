import type { EventType, Owner } from '@/api/client'

type Route = { method: string; path: string; status: number; body: unknown }
type Handled = { method: string; path: string; body: unknown }

let routes: Route[] = []
let handled: Handled[] = []

export function installFetchMock() {
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    const { pathname } = new URL(request.url)
    const text = await request.text()
    handled.push({ method: request.method, path: pathname, body: text ? JSON.parse(text) : undefined })
    const route = routes.find((candidate) => candidate.method === request.method && candidate.path === pathname)
    if (!route) {
      return Response.json({ code: 'NOT_FOUND', message: `Unexpected ${request.method} ${pathname}` }, { status: 404 })
    }
    return Response.json(route.body, { status: route.status })
  }
}

export function resetApi() {
  routes = []
  handled = []
}

export function wasRequested(method: string, path: string): boolean {
  return handled.some((call) => call.method === method && call.path === path)
}

/** The body of the last request to the method and path, or `undefined` if none was sent. */
export function requestBody(method: string, path: string): unknown {
  return handled.findLast((call) => call.method === method && call.path === path)?.body
}

/** A later call for the same method and path replaces the earlier answer. */
export function respond(method: string, path: string, body: unknown, status = 200) {
  routes = routes.filter((route) => !(route.method === method && route.path === path))
  routes.push({ method, path, status, body })
}

export const owner: Owner = {
  name: 'Анна Смирнова',
  timezone: 'Europe/Moscow',
  workdayStart: '09:00',
  workdayEnd: '18:00',
  workingDays: [1, 2, 3, 4, 5],
  bookingWindowDays: 14,
}

export const eventType: EventType = {
  id: 'intro-call',
  name: 'Знакомство',
  description: 'Короткий звонок, чтобы познакомиться',
  durationMinutes: 30,
}
