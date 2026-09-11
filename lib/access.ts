// Hardcoded list of usernames allowed to use the schedule selector.
// TODO: swap this for a real role/permission lookup when wiring the live CRM.
const SCHEDULER_USERS = ['mbaker', 'mnagy', 'mcieply', 'kpatel']

export function canAccessScheduler(username: string | null | undefined): boolean {
  if (!username) return false
  return SCHEDULER_USERS.includes(username.trim().toLowerCase())
}
