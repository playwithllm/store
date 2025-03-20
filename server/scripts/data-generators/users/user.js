const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const short = require('short-uuid');
const User = require('../../../src/domains/user/schema');


async function populateUsers() {
    console.log('Populating users...');
    for(let i = 0; i < 100; i++) {
        const user = new User({
            githubId: short.generate(),
            nodeId: short.generate(),
            displayName: faker.person.fullName(),
            username: faker.internet.userName(),
            profileUrl: faker.internet.url(),
            avatarUrl: faker.image.avatar(),
            apiUrl: faker.internet.url(),
            company: faker.company.name(),
            blog: faker.internet.url(),
            location: faker.location.city(),
            email: faker.internet.email(),
            
            bio: faker.lorem.sentence(),
            public_repos: faker.number.int({min: 0, max: 100}),
            public_gists: faker.number.int({min: 0, max: 100}),
            followers: faker.number.int({min: 0, max: 100}),
            following: faker.number.int(),
            created_at: faker.date.past(),
            updated_at: faker.date.recent(),
            isDemo: true,
            isVerified: false
        });

        await user.save();
        console.log(`User ${i} created`);
    }

    console.log('Data populated');
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pwllmdb';

mongoose.connect(MONGODB_URI).then(() => {
    console.log('Connected to MongoDB');
    populateUsers().then(() => {
      mongoose.connection.close();
  });
});
