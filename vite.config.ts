import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>({base: mode === 'githubpages' ? '/soma-motion-studio/' : '/',plugins:[react()],define:{global:'globalThis'},server:{allowedHosts:['terminal.local']},build:{target:'es2022'}}));
