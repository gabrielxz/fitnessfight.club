import { Amplify } from 'aws-amplify'

const userPoolId = process.env.NEXT_PUBLIC_USER_POOL_ID || ''
const userPoolClientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || ''

if (!userPoolId || !userPoolClientId) {
  console.warn('Cognito configuration missing. Authentication features will not work.')
}

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId,
      userPoolClientId,
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
      },
    },
  },
})

export default Amplify
