/** Configuration Jest — tests unitaires (domaine) et d'intégration (infrastructure/API). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '<rootDir>/test/unit/**/*.spec.ts',
    '<rootDir>/test/integration/**/*.spec.ts',
  ],
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: [
    'src/**/domain/**/*.ts',
    'src/**/application/**/*.ts',
    '!src/**/*.module.ts',
  ],
  coverageDirectory: './coverage',
  setupFilesAfterEnv: [],
  clearMocks: true,
};
