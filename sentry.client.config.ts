import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://e56791c031f7f4f4a7c69f9835571486@o4511124980170752.ingest.us.sentry.io/4511663501344769",
  tracesSampleRate: 1.0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration(),
  ],
});
