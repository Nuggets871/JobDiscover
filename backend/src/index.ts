import { createApp } from './app.ts';

const port = Number(process.env.PORT || 3100);

createApp().listen(port, '0.0.0.0', () =>
  console.log(`JobDiscover backend sur http://127.0.0.1:${port}`),
);