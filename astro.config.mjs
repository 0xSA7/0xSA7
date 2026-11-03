import { defineConfig } from 'astro/config';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
  site: 'https://0xSA7.github.io',
  base: '/0xSA7',
  integrations: [
    mermaid({
      // Use dark theme when data-theme is 'dark', else use 'default'
      theme: 'default',
      // Override Mermaid colors via themeVariables to match Solarized
      themeVariables: {
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: '14px',
        // Solarized Light backgrounds
        primaryColor: '#FDF6E3',
        primaryTextColor: '#586E75',
        primaryBorderColor: '#268BD2',
        lineColor: '#93A1A1',
        secondaryColor: '#EEE8D5',
        tertiaryColor: '#F5EFD9',
        // Text colors
        textColor: '#586E75',
        // Cluster (subgraph) backgrounds
        clusterBkg: '#EEE8D5',
        clusterBorder: '#D6CFB4',
        // Edge labels
        edgeLabelBackground: '#FDF6E3',
      },
    }),
  ],
});
