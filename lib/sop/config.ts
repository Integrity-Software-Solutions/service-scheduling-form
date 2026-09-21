import type { SopBranch, SopQuestion } from '@/lib/sop/types'

/** Map warranty productid labels → SOP question branch. */
export const PRODUCT_BRANCH_MAP: Record<string, SopBranch> = {
  'Roof (Res)': 'roofing',
  'Roof (Met)': 'roofing',
  'Ins (Roof)': 'roofing',
  'SFP (Res)': 'repairs',
  'SFP (Com)': 'repairs',
  'Ins (Rep)': 'repairs',
  Gutters: 'gutters',
  'Ins (Gut)': 'gutters',
  Windows: 'windows',
  WindowONLY: 'windows',
  'Ins (Win)': 'windows',
  Doors: 'doors',
  'Ins (Dor)': 'doors',
  Siding: 'siding',
  'Ins (Sid)': 'siding',
}

export const BRANCH_LABELS: Record<SopBranch, string> = {
  roofing: 'Roofing',
  repairs: 'Repairs',
  gutters: 'Gutters',
  windows: 'Windows',
  doors: 'Doors',
  siding: 'Siding',
  unknown: 'Other',
}

const LOCATION: SopQuestion = {
  id: 'location',
  prompt: 'Where on the house is this located?',
  type: 'text',
  required: true,
  placeholder: 'e.g. back left corner, front elevation…',
}

const ACTIVE_LEAK: SopQuestion = {
  id: 'activeLeak',
  prompt: 'Is there an active leak?',
  type: 'yesno',
  required: true,
}

const LEAK_LOCATION: SopQuestion = {
  id: 'leakLocation',
  prompt: 'Where is the leak?',
  type: 'text',
  required: true,
  visibleWhen: (a) => a.activeLeak === true,
  placeholder: 'e.g. kitchen ceiling, master bedroom…',
}

const PRODUCT_OFF: SopQuestion = {
  id: 'productOff',
  prompt: 'Did any product come off the house?',
  type: 'yesno',
  required: true,
}

const WHAT_FELL_OFF: SopQuestion = {
  id: 'whatFellOff',
  prompt: 'What fell off?',
  type: 'text',
  required: true,
  visibleWhen: (a) => a.productOff === true,
  placeholder: 'e.g. shingles, gutter section, siding panel…',
}

const REUSABLE: SopQuestion = {
  id: 'reusable',
  prompt: 'Do you think it is able to be re-used?',
  type: 'yesno',
  required: true,
  visibleWhen: (a) => a.productOff === true,
}

const REUSABLE_SIDING: SopQuestion = {
  id: 'reusable',
  prompt: 'Do you think it is able to be re-used?',
  type: 'yesno',
  required: true,
}

const MATERIAL_SCRIPT: SopQuestion = {
  id: 'materialScriptExplained',
  prompt:
    'Confirm you explained that service will be scheduled ~2 weeks out so material can be ordered first.',
  type: 'yesno',
  required: true,
  visibleWhen: (a) => a.reusable === false,
  helpText: 'Required when the product cannot be re-used.',
}

const HOME_CONFIRMED: SopQuestion = {
  id: 'homeConfirmed',
  prompt: 'Homeowner must be home — confirmed?',
  type: 'yesno',
  required: true,
  helpText: 'Windows/Doors appointments require the homeowner to be present.',
}

const HOME_CONFIRMED_FOR_LEAK: SopQuestion = {
  id: 'homeConfirmed',
  prompt: 'Homeowner must be home — confirmed?',
  type: 'yesno',
  required: true,
  visibleWhen: (a) => a.activeLeak === true,
  helpText: 'Active leaks require the homeowner to be present.',
}

/** Shared intake question before product-specific follow-ups. */
export const ISSUE_QUESTION: SopQuestion = {
  id: 'issue',
  prompt: 'What seems to be going on?',
  type: 'text',
  required: true,
  placeholder: 'Listen and capture details helpful for the service tech…',
}

export const BRANCH_QUESTIONS: Record<Exclude<SopBranch, 'unknown'>, SopQuestion[]> = {
  roofing: [
    LOCATION,
    ACTIVE_LEAK,
    LEAK_LOCATION,
    HOME_CONFIRMED_FOR_LEAK,
    PRODUCT_OFF,
    WHAT_FELL_OFF,
    REUSABLE,
  ],
  repairs: [
    LOCATION,
    ACTIVE_LEAK,
    LEAK_LOCATION,
    HOME_CONFIRMED_FOR_LEAK,
    PRODUCT_OFF,
    WHAT_FELL_OFF,
    REUSABLE,
  ],
  gutters: [
    LOCATION,
    ACTIVE_LEAK,
    LEAK_LOCATION,
    HOME_CONFIRMED_FOR_LEAK,
    PRODUCT_OFF,
    WHAT_FELL_OFF,
    REUSABLE,
  ],
  windows: [LOCATION, HOME_CONFIRMED],
  doors: [LOCATION, HOME_CONFIRMED],
  siding: [
    LOCATION,
    PRODUCT_OFF,
    WHAT_FELL_OFF,
    REUSABLE_SIDING,
    MATERIAL_SCRIPT,
  ],
}

export const UNKNOWN_QUESTIONS: SopQuestion[] = [LOCATION]

export const SIDING_MATERIAL_LEAD_DAYS = 14
