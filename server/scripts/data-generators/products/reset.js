const { cleanup } = require('./migrate');

console.log('Resetting database...');
cleanup().then(() => {
  console.log('Database reset complete.');
});
