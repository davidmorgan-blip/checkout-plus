import session from 'express-session';

declare module 'express-session' {
  interface Session {
    user?: {
      email: string;
      name: string;
      picture?: string;
      domain: string;
    };
  }
}
