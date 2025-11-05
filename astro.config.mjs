// @ts-check
import { defineConfig } from 'astro/config';
import { visit } from 'unist-util-visit';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://swhitf.dev',
  base: '/',
  vite: {
    plugins: [tailwindcss()]
  },
  markdown: {
    rehypePlugins: [
      () => {
        return (tree) => {
          visit(tree, 'element', (node, index, parent) => {
            if (node.tagName === 'img' && parent && parent.tagName !== 'a') {
              const link = {
                type: 'element',
                tagName: 'a',
                properties: {
                  href: node.properties.src,
                  target: '_blank',
                  rel: 'noopener noreferrer'
                },
                children: [node]
              };
              parent.children[index] = link;
            }
          });
        };
      }
    ]
  }
});