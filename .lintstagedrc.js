const path = require('path')

module.exports = {
  // Frontend TypeScript/JavaScript files - use Next.js lint
  'frontend/**/*.{js,jsx,ts,tsx}': (filenames) => {
    // Next.js lint expects to be run from the frontend directory
    // and needs relative paths from there
    const frontendFiles = filenames
      .map((file) => path.relative('frontend', file))
      .join(' ')
    
    return [
      `sh -c "cd frontend && npx next lint --fix --file ${frontendFiles}"`,
      ...filenames.map((file) => `npx prettier --write "${file}"`)
    ]
  },

  // Infrastructure TypeScript files - use ESLint with legacy config
  'infrastructure/**/*.{js,ts}': (filenames) => {
    // For infrastructure, we need to use the compatibility mode
    // Since ESLint v9 doesn't support .eslintrc.json directly, 
    // we'll use Next.js approach or skip ESLint for now
    return filenames.map((file) => `npx prettier --write "${file}"`)
  },

  // Lambda JavaScript files - just use Prettier
  'infrastructure/lambda/**/*.js': (filenames) => {
    return filenames.map((file) => `npx prettier --write "${file}"`)
  },

  // All other files (JSON, MD, YAML, CSS) - use Prettier
  '*.{json,md,yml,yaml,css}': (filenames) => {
    return filenames.map((file) => `npx prettier --write "${file}"`)
  },

  // Package.json files - format with Prettier
  '**/package.json': (filenames) => {
    return filenames.map((file) => `npx prettier --write "${file}"`)
  }
}