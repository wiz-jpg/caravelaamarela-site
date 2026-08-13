import { resolve } from 'path';

export default {
  server: {
    host: '0.0.0.0'
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        wildchains: resolve(__dirname, 'wildchains.html'),
        devil: resolve(__dirname, 'devil-of-a-woman.html'),
        forArtists: resolve(__dirname, 'for-artists.html')
      }
    }
  }
};
