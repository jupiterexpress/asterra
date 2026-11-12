import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{target:'es2019',outDir:'dist',assetsInlineLimit:0,chunkSizeWarningLimit:900},server:{host:'127.0.0.1',port:4190,strictPort:true,fs:{allow:['.','../node_modules/@fontsource']}}});
