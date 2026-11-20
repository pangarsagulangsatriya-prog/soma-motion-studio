import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages publishes the main SOMA app from main. The approved MAT-03
// research snapshot is built separately with githubpages-mat03 mode so only
// its isolated HTML entry and hashed assets can be copied into that site.
export default defineConfig(({mode})=>({
  base: mode.startsWith('githubpages') ? '/soma-motion-studio/' : '/',
  plugins:[react()],
  define:{global:'globalThis'},
  server:{allowedHosts:['terminal.local']},
  build:{
    target:'es2022',
    ...(mode==='githubpages-mat03'
      ?{rollupOptions:{input:'gpu02-lab.html'}}
      :{})
  }
}));