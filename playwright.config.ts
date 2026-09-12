import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'**/*.spec.ts',fullyParallel:false,use:{baseURL:'http://127.0.0.1:5188'},webServer:{command:'npm run dev -- --port 5188',url:'http://127.0.0.1:5188',reuseExistingServer:false}});
