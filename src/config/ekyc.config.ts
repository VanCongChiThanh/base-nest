import { registerAs } from '@nestjs/config';

/**
 * VNPT eKYC SDK configuration
 */
export default registerAs('ekyc', () => ({
  backendUrl: process.env.VNPT_EKYC_BACKEND_URL || 'https://api.idg.vnpt.vn',
  tokenKey: process.env.VNPT_EKYC_TOKEN_KEY || '',
  tokenId: process.env.VNPT_EKYC_TOKEN_ID || '',
  accessToken: process.env.VNPT_EKYC_ACCESS_TOKEN || '',
  enableGoogleCaptcha: process.env.VNPT_EKYC_ENABLE_GGCAPTCHA === 'true',
  oauthUrl:
    process.env.VNPT_EKYC_OAUTH_URL ||
    'https://api.idg.vnpt.vn/auth/oauth/token',
  username: process.env.VNPT_EKYC_USERNAME || '',
  password: process.env.VNPT_EKYC_PASSWORD || '',
  clientId: process.env.VNPT_EKYC_CLIENT_ID || 'clientapp',
  clientSecret: process.env.VNPT_EKYC_CLIENT_SECRET || 'password',
  grantType: process.env.VNPT_EKYC_GRANT_TYPE || 'password',
  publicKey: process.env.VNPT_EKYC_PUBLIC_KEY || '',
}));
