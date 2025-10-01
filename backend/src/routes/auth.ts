import express, { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REQUIRED_DOMAIN = 'loopreturns.com';

const getRedirectUri = (): string => {
  if (process.env.OAUTH_REDIRECT_URI) {
    return process.env.OAUTH_REDIRECT_URI;
  }
  
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.REPLIT_DEPLOYMENT_URL) {
      throw new Error('Production requires OAUTH_REDIRECT_URI or REPLIT_DEPLOYMENT_URL to be set');
    }
    return `${process.env.REPLIT_DEPLOYMENT_URL}/auth/google/callback`;
  }
  
  return 'http://localhost:3001/auth/google/callback';
};

router.get('/google', (req: Request, res: Response) => {
  try {
    const state = crypto.randomBytes(32).toString('hex');
    
    if (req.session) {
      req.session.oauthState = state;
    }

    const redirectUri = getRedirectUri();
    
    const oauth2Client = new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['profile', 'email', 'openid'],
      hd: REQUIRED_DOMAIN,
      prompt: 'select_account',
      state: state
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (!code || typeof code !== 'string') {
    return res.redirect('/?error=no_code');
  }

  if (!state || typeof state !== 'string' || state !== req.session?.oauthState) {
    console.error('OAuth state mismatch or missing');
    return res.redirect('/?error=invalid_state');
  }

  delete req.session?.oauthState;

  try {
    const redirectUri = getRedirectUri();
    
    const oauth2Client = new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.redirect('/?error=invalid_token');
    }

    if (payload.hd !== REQUIRED_DOMAIN) {
      console.log(`Access denied for domain: ${payload.hd}, required: ${REQUIRED_DOMAIN}`);
      return res.redirect(`/?error=invalid_domain&domain=${payload.hd}`);
    }

    const userData = {
      email: payload.email!,
      name: payload.name!,
      picture: payload.picture,
      domain: payload.hd!
    };

    req.session?.regenerate((err: Error | undefined) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.redirect('/?error=auth_failed');
      }

      if (req.session) {
        req.session.user = userData;
      }

      req.session?.save((saveErr: Error | undefined) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.redirect('/?error=auth_failed');
        }
        res.redirect('/');
      });
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/?error=auth_failed');
  }
});

router.get('/logout', (req: Request, res: Response) => {
  req.session?.destroy((err: Error | undefined) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.redirect('/');
  });
});

router.get('/user', (req: Request, res: Response) => {
  if (req.session?.user) {
    res.json({ 
      authenticated: true, 
      user: req.session.user 
    });
  } else {
    res.json({ authenticated: false });
  }
});

export default router;
