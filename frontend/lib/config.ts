export interface AppConfig {
  apiUrl: string
  environment: 'development' | 'production'
  isDev: boolean
}

export function getConfig(): AppConfig {
  // Determine environment based on window location
  const isDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'dev.fitnessfight.club' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')

  const environment = isDev ? 'development' : 'production'

  // API URLs for each environment
  const apiUrl = isDev
    ? 'https://api.dev.fitnessfight.club/api/v1'
    : 'https://api.fitnessfight.club/api/v1'

  return {
    apiUrl,
    environment,
    isDev,
  }
}
