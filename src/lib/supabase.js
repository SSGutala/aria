import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const MOCK_MODE = !supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co'

const MOCK_USER = {
  id: 'mock-user-id',
  email: 'test@test.com',
  created_at: new Date().toISOString(),
}

let mockSession = JSON.parse(localStorage.getItem('aria_mock_session') || 'null')
const mockListeners = []

function notifyListeners(event, session) {
  mockListeners.forEach(fn => fn(event, session))
}

const mockAuth = {
  getSession: async () => ({ data: { session: mockSession }, error: null }),
  getUser: async () => ({ data: { user: mockSession ? MOCK_USER : null }, error: null }),
  signInWithPassword: async ({ email, password }) => {
    if (email === 'test@test.com' && password === 'password') {
      mockSession = { user: MOCK_USER, access_token: 'mock-token' }
      localStorage.setItem('aria_mock_session', JSON.stringify(mockSession))
      notifyListeners('SIGNED_IN', mockSession)
      return { data: { session: mockSession }, error: null }
    }
    return { data: {}, error: { message: 'Invalid login credentials' } }
  },
  signUp: async ({ email, password }) => {
    if (email && password && password.length >= 6) {
      mockSession = { user: { ...MOCK_USER, email }, access_token: 'mock-token' }
      localStorage.setItem('aria_mock_session', JSON.stringify(mockSession))
      notifyListeners('SIGNED_IN', mockSession)
      return { data: { session: mockSession }, error: null }
    }
    return { data: {}, error: { message: 'Password must be at least 6 characters' } }
  },
  signOut: async () => {
    mockSession = null
    localStorage.removeItem('aria_mock_session')
    notifyListeners('SIGNED_OUT', null)
    return { error: null }
  },
  onAuthStateChange: (callback) => {
    mockListeners.push(callback)
    return { data: { subscription: { unsubscribe: () => {
      const i = mockListeners.indexOf(callback)
      if (i > -1) mockListeners.splice(i, 1)
    }}}}
  },
}

let mockDb = JSON.parse(localStorage.getItem('aria_mock_db') || '{"conversations":[],"messages":[],"generated_apps":[],"app_submissions":[]}')

function saveMockDb() {
  localStorage.setItem('aria_mock_db', JSON.stringify(mockDb))
}

function mockQuery(table) {
  let rows = mockDb[table] ? [...mockDb[table]] : []
  let filters = []
  let insertData = null
  let updateData = null
  let isCount = false
  let isSingle = false
  let orderCol = null
  let orderAsc = true
  let selectCols = '*'

  const q = {
    select: (cols = '*', opts = {}) => {
      selectCols = cols
      if (opts.count === 'exact') isCount = true
      return q
    },
    eq: (col, val) => { filters.push({ col, val }); return q },
    insert: (data) => {
      const arr = Array.isArray(data) ? data : [data]
      arr.forEach(row => {
        const newRow = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...row,
        }
        mockDb[table].push(newRow)
        rows = [...mockDb[table]]
      })
      saveMockDb()
      insertData = arr.length === 1 ? { ...mockDb[table].at(-1) } : null
      return q
    },
    update: (data) => {
      updateData = data
      return q
    },
    order: (col, { ascending = true } = {}) => { orderCol = col; orderAsc = ascending; return q },
    single: () => { isSingle = true; return q },
    head: () => q,
    then: (resolve) => {
      let result = rows

      if (updateData) {
        mockDb[table] = mockDb[table].map(row => {
          const match = filters.every(f => row[f.col] === f.val)
          return match ? { ...row, ...updateData, updated_at: new Date().toISOString() } : row
        })
        saveMockDb()
        result = mockDb[table].filter(row => filters.every(f => row[f.col] === f.val))
      } else {
        result = rows.filter(row => filters.every(f => row[f.col] === f.val))
      }

      if (orderCol) {
        result = [...result].sort((a, b) => {
          const av = a[orderCol], bv = b[orderCol]
          return orderAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
        })
      }

      if (isCount) {
        return resolve({ data: result, count: result.length, error: null })
      }

      if (isSingle) {
        const item = insertData || result[0] || null
        return resolve({ data: item, error: item ? null : { message: 'Not found' } })
      }

      return resolve({ data: result, error: null })
    },
  }
  return q
}

const mockSupabase = {
  auth: mockAuth,
  from: (table) => {
    if (!mockDb[table]) mockDb[table] = []
    return mockQuery(table)
  },
}

export const supabase = MOCK_MODE
  ? mockSupabase
  : createClient(supabaseUrl, supabaseAnonKey)
