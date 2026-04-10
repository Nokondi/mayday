import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password.js';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await hashPassword('admin123!');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mayday.local' },
    update: {},
    create: {
      email: 'admin@mayday.local',
      passwordHash: adminPassword,
      name: 'Admin',
      role: 'ADMIN',
      bio: 'Platform administrator',
      location: 'Central',
      skills: ['Community Organization', 'Moderation'],
    },
  });

  // Create sample users
  const userPassword = await hashPassword('password123!');

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      passwordHash: userPassword,
      name: 'Alice Johnson',
      bio: 'Community organizer and mutual aid enthusiast',
      location: 'Downtown',
      latitude: 40.7128,
      longitude: -74.006,
      skills: ['Cooking', 'Driving', 'Tutoring'],
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      passwordHash: userPassword,
      name: 'Bob Smith',
      bio: 'Retired teacher, happy to help neighbors',
      location: 'Midtown',
      latitude: 40.7549,
      longitude: -73.984,
      skills: ['Teaching', 'Gardening', 'Home Repair'],
    },
  });

  // Create sample posts
  await prisma.post.createMany({
    data: [
      {
        type: 'REQUEST',
        title: 'Need groceries delivered',
        description: 'I am recovering from surgery and cannot drive. Would appreciate help getting groceries from the local store once a week for the next month.',
        category: 'Food',
        location: 'Downtown',
        latitude: 40.7128,
        longitude: -74.006,
        urgency: 'HIGH',
        authorId: alice.id,
      },
      {
        type: 'OFFER',
        title: 'Free tutoring for K-12 students',
        description: 'Retired math teacher offering free tutoring sessions for elementary and middle school students. Available weekday afternoons.',
        category: 'Education',
        location: 'Midtown',
        latitude: 40.7549,
        longitude: -73.984,
        urgency: 'LOW',
        authorId: bob.id,
      },
      {
        type: 'OFFER',
        title: 'Can deliver groceries weekly',
        description: 'I drive past the grocery store every Saturday and am happy to pick up and deliver groceries to anyone in the downtown area.',
        category: 'Food',
        location: 'Downtown',
        latitude: 40.715,
        longitude: -74.003,
        urgency: 'MEDIUM',
        authorId: bob.id,
      },
      {
        type: 'REQUEST',
        title: 'Looking for winter clothing for children',
        description: 'Family of four in need of winter coats and boots for two children (ages 5 and 8). Any donations would be greatly appreciated.',
        category: 'Clothing',
        location: 'Uptown',
        latitude: 40.8,
        longitude: -73.95,
        urgency: 'CRITICAL',
        authorId: alice.id,
      },
      {
        type: 'OFFER',
        title: 'Home repair help available',
        description: 'Handy with tools and happy to help with minor home repairs — leaky faucets, squeaky doors, loose shelves, etc. Free of charge for neighbors in need.',
        category: 'Household Items',
        location: 'Midtown',
        latitude: 40.758,
        longitude: -73.985,
        urgency: 'LOW',
        authorId: bob.id,
      },
      {
        type: 'REQUEST',
        title: 'Need a ride to medical appointments',
        description: 'I have weekly physical therapy appointments on Tuesdays at 2pm. Looking for someone who could give me a ride (about 3 miles each way).',
        category: 'Transportation',
        location: 'Downtown',
        latitude: 40.71,
        longitude: -74.008,
        urgency: 'HIGH',
        authorId: alice.id,
      },
    ],
  });

  console.log('Seed data created:');
  console.log(`  Admin: ${admin.email}`);
  console.log(`  Users: ${alice.email}, ${bob.email}`);
  console.log('  6 sample posts created');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
