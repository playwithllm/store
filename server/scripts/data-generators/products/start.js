const { run } = require('./migrate');

const filePath = "./products-light.csv";
console.log('Starting data generator...');
run(filePath).then(() => {
  console.log('Data generator complete.');
}).catch(error => {
  console.error('Error during data generation:', error);
});
