// Hardcoded list of usernames allowed to use the schedule selector.
// TODO: swap this for a real role/permission lookup when wiring the live CRM.
const SCHEDULER_USERS = ['2740', '1185', '1126', '2718', 'kpatel', 'mnagy', 'mcieply', 'mbaker']

export function canAccessScheduler(username: string | null | undefined): boolean {
  if (!username) return false
  return SCHEDULER_USERS.includes(username.trim().toLowerCase())
}
