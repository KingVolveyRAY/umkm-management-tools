import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      onLog(level, log, report) {
        // This is a client-only build. The dependency directives only matter for server components.
        if (log.code === 'MODULE_LEVEL_DIRECTIVE' && log.id?.includes('/node_modules/')) return;
        report(level, log);
      },
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-runtime', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'animation', test: /node_modules[\\/](gsap|lenis|framer-motion|motion|motion-dom|motion-utils)[\\/]/ },
          ],
        },
      },
    },
  },
});
