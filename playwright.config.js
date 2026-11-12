import {defineConfig} from '@playwright/test';
// Keep verification isolated from other local Asterra projects.
const port=process.env.ASTERRA_TEST_PORT||4190;
const baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({testDir:'./tests',testMatch:'**/*.spec.js',timeout:180000,workers:1,webServer:{command:`npm run preview -- --port ${port}`,url:baseURL,reuseExistingServer:!process.env.CI,timeout:30000},use:{baseURL,viewport:{width:1440,height:900},launchOptions:{...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}}});
