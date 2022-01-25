module.exports = {
  ...require( '@wordpress/scripts/config/jest-e2e.config' ),
  setupFilesAfterEnv: [
    './setup-test-framework.js',
    '@wordpress/jest-console',
    'expect-puppeteer',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
};
