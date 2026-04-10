/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@klyovo/shared$': '<rootDir>/../../packages/shared/dist/index.js',
    '^@klyovo/db$': '<rootDir>/../../packages/db/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, isolatedModules: true }]
  },
  coverageThreshold: {
    global: { lines: 60 },
    './src/services/': { lines: 80 }
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts']
}
