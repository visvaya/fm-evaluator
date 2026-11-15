export default {
  extends: ['@commitlint/config-conventional'],
  // The squash merge turns the pull request title into the commit on main; titles stay within 72
  // characters (config-conventional allows 100).
  rules: { 'header-max-length': [2, 'always', 72] }
};
