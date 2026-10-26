import type { Protocol } from './data'

export type EndpointDetails = {
  host: string
  database?: string
  protocol?: Protocol
  apiVersion?: string
}

export function readEndpoint(value: string): EndpointDetails {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('Enter an HTTPS server address or FileMaker API URL.')
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Use HTTPS without embedded credentials, query parameters, or a fragment.',
    )
  const parts = url.pathname.split('/').filter(Boolean)
  if (!parts.length) return { host: url.origin }
  let details: EndpointDetails
  if (
    parts[0] === 'fmi' &&
    parts[1] === 'data' &&
    ['v1', 'v2', 'vLatest'].includes(parts[2]) &&
    parts[3] === 'databases' &&
    parts[4]
  ) {
    details = {
      host: url.origin,
      database: parts[4],
      protocol: 'Data API',
      apiVersion: parts[2],
    }
  } else if (
    parts[0] === 'fmi' &&
    parts[1] === 'odata' &&
    parts[2] === 'v4' &&
    parts[3]
  ) {
    details = { host: url.origin, database: parts[3], protocol: 'OData' }
  } else
    throw new Error(
      'Use a server address, a /fmi/data/…/databases/… URL, or a /fmi/odata/v4/… URL.',
    )
  try {
    details.database = decodeURIComponent(details.database!)
  } catch {
    throw new Error('The database name in that URL has invalid encoding.')
  }
  validateDatabaseName(details.database!)
  return details
}

export function validateDatabaseName(value: string) {
  if (
    !value.trim() ||
    value.trim().length > 200 ||
    /[\u0000-\u001f/\\]/.test(value)
  )
    throw new Error(
      'Enter the exact hosted database name, without slashes or control characters.',
    )
}

export function connectionRequest(
  protocol: Protocol,
  host: string,
  database: string,
) {
  let endpoint: EndpointDetails | undefined
  try {
    if (host.trim()) endpoint = readEndpoint(host)
  } catch {
    /* Never copy an unvalidated address that might contain a secret. */
  }
  let safeDatabase = endpoint?.database ?? database.trim()
  try {
    validateDatabaseName(safeDatabase)
  } catch {
    safeDatabase = '[exact hosted database name]'
  }
  const api = endpoint?.protocol ?? protocol
  return `FileMaker read-only integration test\n\nI'd like to inspect the API-visible schema and run bounded record reads using FM API Explorer locally.\n\nServer: ${endpoint?.host ?? '[HTTPS server address]'}\nDatabase: ${safeDatabase}\nAPI: ${api}\n\nPlease confirm this database is hosted, reachable over HTTPS, and available through the selected API. Provide a test account authorized only for the metadata and records we should inspect, or an appropriate existing token. Please deliver credentials through your approved secure channel, not in this request.\n\nWe will inspect exposed resources, read a small record page, save a schema baseline, and run one representative integration check. No record writes or explicit script execution are offered by the app. Please review any server/layout-trigger behavior before authorizing reads.\n\nWe have not connected or verified this endpoint yet.`
}
