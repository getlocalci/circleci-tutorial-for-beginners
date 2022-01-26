module.exports = {
  ...require( '@wordpress/scripts/config/jest-e2e.config' ),
  setupFilesAfterEnv: [
    '@wordpress/jest-console',
    'expect-puppeteer',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
};
