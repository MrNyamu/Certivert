import { defineConfig } from "vitest/config";
import {
  vitestSetupFilePath,
  getClarinetVitestsArgv,
} from "@stacks/clarinet-sdk/vitest";

/*
  Clarinet-only configuration for smart contract tests.
  API tests are handled separately by Jest in api/package.json
*/

export default defineConfig({
  test: {
    // Only run smart contract tests in tests/ directory
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['api/**/*'], // Exclude API tests - handled by Jest
    // use vitest-environment-clarinet for smart contract tests
    environment: "clarinet",
    pool: "forks",
    // clarinet handles test isolation by resetting the simnet between tests
    isolate: false,
    maxWorkers: 1,
    setupFiles: [
      vitestSetupFilePath,
    ],
    environmentOptions: {
      clarinet: {
        ...getClarinetVitestsArgv(),
      },
    },
  },
});

